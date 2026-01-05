import { Hono } from 'hono';
import Stripe from 'stripe';
import { createDb } from '../db';
import { products, posOrders, posOrderItems, tenantMembers, giftCards, users } from 'db/src/schema';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    RESEND_API_KEY: string;
};

type Variables = {
    auth: { userId: string };
    tenant: any;
    member?: any;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /products - List available inventory
app.get('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const list = await db.select().from(products)
        .where(eq(products.tenantId, tenant.id))
        .orderBy(desc(products.createdAt))
        .all();

    return c.json({ products: list });
});

// POST /products - Add new product with Stripe Sync
app.post('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();

    const id = crypto.randomUUID();
    let stripeProductId = null;
    let stripePriceId = null;

    // Create in Stripe
    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
        try {
            // 1. Create Product
            const prod = await stripe.createProduct({
                name: body.name,
                description: body.description,
                images: body.imageUrl ? [body.imageUrl] : [],
                metadata: { tenantId: tenant.id, localId: id }
            }, tenant.stripeAccountId);
            stripeProductId = prod.id;

            // 2. Create Price
            if (body.price > 0) {
                const price = await stripe.createPrice({
                    productId: prod.id,
                    unitAmount: body.price,
                    currency: tenant.currency || 'usd'
                }, tenant.stripeAccountId);
                stripePriceId = price.id;
            }
        } catch (e) {
            console.error("Stripe Product Sync Failed", e);
            // Proceed to create local anyway? Yes, graceful degradation.
        }
    }

    await db.insert(products).values({
        id,
        tenantId: tenant.id,
        name: body.name,
        description: body.description,
        category: body.category,
        sku: body.sku,
        price: body.price,
        currency: tenant.currency || 'usd',
        stockQuantity: body.stockQuantity || 0,
        imageUrl: body.imageUrl,
        isActive: true,
        stripeProductId: stripeProductId || undefined,
        stripePriceId: stripePriceId || undefined
    }).run();

    return c.json({ success: true, id });
});

// POST /orders - Create a POS Sale
app.post('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const staff = c.get('member');
    const { items, memberId, paymentMethod, totalAmount, redeemGiftCardCode, redeemAmount } = await c.req.json();

    if (!items || items.length === 0) return c.json({ error: "No items in order" }, 400);

    const orderId = crypto.randomUUID();

    try {
        // --- 1. Validate & Redeem Gift Card (Integrated) ---
        let giftCardRedemptionId: string | null = null;
        if (redeemGiftCardCode && redeemAmount > 0) {
            const { FulfillmentService } = await import('../services/fulfillment');
            const fulfillment = new FulfillmentService(db, c.env.RESEND_API_KEY);

            // Check card
            const card = await db.select().from(giftCards).where(and(
                eq(giftCards.tenantId, tenant.id),
                eq(giftCards.code, redeemGiftCardCode),
                eq(giftCards.status, 'active')
            )).get();

            if (!card) return c.json({ error: "Invalid Gift Card Code" }, 400);
            if (card.currentBalance < redeemAmount) return c.json({ error: "Insufficient Gift Card Balance" }, 400);

            // Redeem logic
            await fulfillment.redeemGiftCard(card.id, redeemAmount, orderId);
            // We don't have the transaction ID returned easily from fulfillment service helper, 
            // but the service logs the transaction linked to this orderId.
        }

        // --- 2. Create Order ---
        const orderValues = {
            id: orderId,
            tenantId: tenant.id,
            memberId: memberId || null,
            staffId: staff?.id || null,
            totalAmount: totalAmount,
            status: 'completed' as const,
            paymentMethod: paymentMethod || 'card'
        };

        const itemInserts = items.map((it: any) => ({
            id: crypto.randomUUID(),
            orderId: orderId,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.unitPrice * it.quantity
        }));

        await db.insert(posOrders).values(orderValues).run();

        for (const item of itemInserts) {
            await db.insert(posOrderItems).values(item).run();
        }

        // --- 3. Atomic Stock Deduction (Raw SQL) ---
        for (const item of items) {
            // Using sql template tag for safe parameter injection
            await db.run(sql`UPDATE products SET stock_quantity = stock_quantity - ${item.quantity} WHERE id = ${item.productId} AND tenant_id = ${tenant.id}`);
        }

        return c.json({ success: true, orderId });
    } catch (e: any) {
        console.error("POS Order Failed:", e);
        // Simple rollback attempt? D1 doesn't support full rollback easily across requests yet.
        // In real non-MVP, we'd want robust transaction handling.
        return c.json({ error: e.message }, 500);
    }
});

// GET /orders - History
app.get('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const orders = await db.query.posOrders.findMany({
        where: eq(posOrders.tenantId, tenant.id),
        with: {
            items: {
                with: { product: true }
            },
            member: {
                with: { user: { columns: { profile: true } } }
            }
        },
        orderBy: [desc(posOrders.createdAt)]
    });

    return c.json({ orders });
});

// POST /process-payment - Initialize Stripe Payment
app.post('/process-payment', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { items, customerId } = await c.req.json();

    if (!items || items.length === 0) return c.json({ error: "No items" }, 400);

    // 1. Calculate Total Server-Side
    let totalAmount = 0;
    const itemDetails = [];

    for (const item of items) {
        const product = await db.select().from(products)
            .where(and(eq(products.id, item.productId), eq(products.tenantId, tenant.id)))
            .get();

        if (!product) continue;

        totalAmount += (product.price * item.quantity);
        itemDetails.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: item.quantity
        });
    }

    if (totalAmount === 0) return c.json({ error: "Total amount is 0" }, 400);

    // 2. Create PaymentIntent
    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Server misconfiguration" }, 500);

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' as any }); // Use latest or available

    const params: Stripe.PaymentIntentCreateParams = {
        amount: totalAmount,
        currency: tenant.currency || 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
            tenantId: tenant.id,
            items: JSON.stringify(itemDetails.map(i => `${i.quantity}x ${i.name}`).join(', ')) // simplified metadata
        }
    };

    // If tenant has own Stripe Account, use it
    const options: Stripe.RequestOptions = {};
    if (tenant.stripeAccountId) {
        options.stripeAccount = tenant.stripeAccountId;
    }

    try {
        const pi = await stripe.paymentIntents.create(params, options);
        return c.json({
            clientSecret: pi.client_secret,
            id: pi.id
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /connection-token - Generate Terminal Connection Token
app.post('/connection-token', async (c) => {
    const tenant = c.get('tenant');
    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Server misconfiguration" }, 500);

    const { StripeService } = await import('../services/stripe');
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);

    try {
        const token = await stripe.createTerminalConnectionToken(tenant.stripeAccountId);
        return c.json({ secret: token.secret });
    } catch (e: any) {
        console.error("Terminal Token Error:", e);
        return c.json({ error: e.message }, 500);
    }
});

// GET /customers - Search Customers (Local + Stripe)
app.get('/customers', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { query } = c.req.query();

    if (!query || query.length < 2) return c.json({ customers: [] });

    // 1. Search Local Members (Global Users linked to Tenant)
    const { users } = await import('db/src/schema');
    // Simple mock search if sql.like not fully supported in D1 or requires raw. 
    // Drizzle like() is good.
    const { like, or } = await import('drizzle-orm');

    // Note: Search on user profile JSON is hard in SQL. 
    // We'll search by email in Users table for now + join TenantMembers
    const localMatches = await db.select({
        id: tenantMembers.id,
        userId: users.id,
        email: users.email,
        profile: users.profile,
        stripeCustomerId: users.stripeCustomerId // Platform ID
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(tenantMembers.tenantId, tenant.id),
            or(like(users.email, `%${query}%`)) // Basic email search
        ))
        .limit(5)
        .all();

    // 2. Search Stripe Customers (if connected)
    let stripeMatches: any[] = [];
    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
        try {
            // Search on the Connected Account
            const result = await stripe.searchCustomers(query, tenant.stripeAccountId);
            stripeMatches = result.data.map((cus: any) => ({
                id: 'stripe_guest', // No local ID
                stripeCustomerId: cus.id, // The ID on the connected account
                email: cus.email,
                profile: { firstName: cus.name || 'Guest', lastName: '' },
                isStripeGuest: true
            }));
        } catch (e) { console.error("Stripe Search Error", e); }
    }

    return c.json({ customers: [...localMatches, ...stripeMatches] });
});


// POST /customers - Create New Customer (Stripe + Local Guest?)
app.post('/customers', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { email, name, phone } = await c.req.json();

    if (!email || !name) return c.json({ error: "Email and Name required" }, 400);

    // 1. Create in Stripe (Connected Account)
    let stripeCustomerId = null;
    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
        try {
            const cus = await stripe.createCustomer({ email, name, phone, metadata: { tenantId: tenant.id } }, tenant.stripeAccountId);
            stripeCustomerId = cus.id;
        } catch (e) { console.error('Stripe Customer Create Error', e); }
    }

    // 2. Create Local Record? 
    // If we want to store them as a "Lead" or "Member"?
    // For POS, maybe we just return the Stripe ID if they don't want to register fully?
    // User request: "select a customer... add a new customer in stripe"
    // So we assume primarily Stripe customer for now. 

    return c.json({ success: true, customer: { id: stripeCustomerId, email, name, isStripeGuest: true } });
});

// PUT /products/:id
app.put('/products/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const body = await c.req.json();

    const product = await db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, tenant.id))).get();
    if (!product) return c.json({ error: 'Product not found' }, 404);

    // Update DB
    await db.update(products).set({
        name: body.name,
        description: body.description,
        price: body.price,
        stockQuantity: body.stockQuantity,
        imageUrl: body.imageUrl,
        category: body.category,
        sku: body.sku,
        isActive: body.isActive,
        updatedAt: new Date()
    }).where(eq(products.id, id)).run();

    // Sync Stripe
    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId && product.stripeProductId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
        try {
            await stripe.updateProduct(product.stripeProductId, {
                name: body.name,
                description: body.description,
                active: body.isActive,
                images: body.imageUrl ? [body.imageUrl] : []
            }, tenant.stripeAccountId);

            // Price updates in Stripe are immutable mostly, we'd create new price and make default? 
            // Skipping price update complexity for MVP, usually requires creating new Price object.
        } catch (e) { console.error("Stripe Sync Error", e); }
    }

    return c.json({ success: true });
});

// POST /products/:id/archive
app.post('/products/:id/archive', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

    const product = await db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, tenant.id))).get();
    if (!product) return c.json({ error: 'Product not found' }, 404);

    await db.update(products).set({ isActive: false }).where(eq(products.id, id)).run();

    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId && product.stripeProductId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
        try {
            await stripe.archiveProduct(product.stripeProductId, tenant.stripeAccountId);
        } catch (e) { console.error("Stripe Archive Error", e); }
    }

    return c.json({ success: true });
});

export default app;
