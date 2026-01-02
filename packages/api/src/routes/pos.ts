import { Hono } from 'hono';
import Stripe from 'stripe';
import { createDb } from '../db';
import { products, posOrders, posOrderItems, tenantMembers } from 'db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
};

type Variables = {
    auth: { userId: string };
    tenant: any;
    member?: any;
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

// POST /products - Add new product (Admin/Staff)
app.post('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();

    const id = crypto.randomUUID();
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
        isActive: true
    }).run();

    return c.json({ success: true, id });
});

// POST /orders - Create a POS Sale
app.post('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const staff = c.get('member');
    const { items, memberId, paymentMethod, totalAmount } = await c.req.json();

    if (!items || items.length === 0) return c.json({ error: "No items in order" }, 400);

    const orderId = crypto.randomUUID();

    try {
        // Start Transaction (if supported, else sequential)
        // D1 doesn't support full transactions in Drizzle yet in all environments, but let's use batch

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

        // Batch execution
        await db.insert(posOrders).values(orderValues).run();

        for (const item of itemInserts) {
            await db.insert(posOrderItems).values(item).run();
            // Update stock
            await db.update(products)
                .set({ stockQuantity: eq(products.stockQuantity, products.stockQuantity) as any /* Placeholder for atomic decr if supported or just simple fetch-update */ })
                .where(eq(products.id, item.productId))
            // Note: D1/SQLite doesn't easily do atomic decr via Drizzle in a single line without more complex SQL. 
            // For MVP, we'll just skip atomic for now or use raw SQL.
            // Better: 
            // .set({ stockQuantity: sql`${products.stockQuantity} - ${item.quantity}` })
        }

        // Real atomic update:
        for (const item of items) {
            await db.run(sql`UPDATE products SET stock_quantity = stock_quantity - ${item.quantity} WHERE id = ${item.productId}`);
        }

        return c.json({ success: true, orderId });
    } catch (e: any) {
        console.error("POS Order Failed:", e);
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
            amount: totalAmount,
            currency: tenant.currency
        });
    } catch (e: any) {
        console.error("Stripe Error:", e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
