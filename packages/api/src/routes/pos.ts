import { Hono } from 'hono';
import { createDb } from '../db';
import type { HonoContext } from '../types';
import { PosService } from '../services/pos';
import { StripeService } from '../services/stripe';

interface CartItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

const app = new Hono<HonoContext>();

// GET /products - List available inventory
app.get('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const service = new PosService(db, tenant.id, c.env, null); // Stripe service not needed for reading local DB only?
    // Actually, constructor expects it optional.
    const list = await service.listProducts();

    return c.json({ products: list });
});

// POST /products - Add new product with Stripe Sync
app.post('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const body = await c.req.json();
    const { z } = await import('zod');
    const productSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        sku: z.string().optional(),
        price: z.number().nonnegative(),
        stockQuantity: z.number().int().nonnegative().optional().default(0),
        imageUrl: z.string().url().optional(),
        isActive: z.boolean().optional().default(true)
    });

    const parseResult = productSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }
    const data = parseResult.data;

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) {
        stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
    }

    const service = new PosService(db, tenant.id, c.env, stripeService);
    const id = await service.createProduct(data, tenant.stripeAccountId, tenant.currency || 'usd');

    return c.json({ success: true, id });
});

// POST /orders - Create a POS Sale
app.post('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }
    const staff = c.get('member');

    const { items, memberId, paymentMethod, totalAmount, redeemGiftCardCode, redeemAmount } = await c.req.json<{
        items: CartItem[];
        memberId?: string;
        paymentMethod?: string;
        totalAmount: number;
        redeemGiftCardCode?: string;
        redeemAmount?: number
    }>();

    const service = new PosService(db, tenant.id, c.env); // No stripe service needed for local order Create atm? 
    // Except automations might need stuff, but they are inside service.

    try {
        const result = await service.createOrder(
            items,
            totalAmount,
            memberId,
            staff?.id,
            paymentMethod,
            redeemGiftCardCode,
            redeemAmount,
            tenant // pass tenant for context
        );

        // Async tasks
        if (result.asyncTask) {
            c.executionCtx.waitUntil(result.asyncTask());
        }

        return c.json({ success: true, orderId: result.orderId });
    } catch (e: any) {
        console.error("POS Order Failed:", e);
        return c.json({ error: e.message }, 500);
    }
});

// GET /orders - History
app.get('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const service = new PosService(db, tenant.id, c.env);
    const orders = await service.getOrderHistory();

    return c.json({ orders });
});

// POST /process-payment - Initialize Stripe Payment
app.post('/process-payment', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { items, customerId } = await c.req.json<{ items: { productId: string; quantity: number }[], customerId?: string }>();

    if (!items || items.length === 0) return c.json({ error: "No items" }, 400);

    const service = new PosService(db, tenant.id, c.env);
    const { totalAmount, itemDetails } = await service.validatePaymentItems(items);

    if (totalAmount === 0) return c.json({ error: "Total amount is 0" }, 400);

    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Server misconfiguration" }, 500);

    // Using Stripe directly here or via Service? 
    // Usually payments are better abstracted, but this route handler logic was specific to intent creation.
    // Let's keep the PaymentIntent creation here for now but use the Service for calc. 
    // Or move `createPaymentIntent` to StripeService.
    const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);

    // Construct params
    const params = {
        amount: totalAmount,
        currency: tenant.currency || 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
            tenantId: tenant.id,
            items: JSON.stringify(itemDetails.map(i => `${i.quantity}x ${i.name}`).join(', '))
        }
    };

    try {
        // Use Stripe Service if it exposes createPaymentIntent? 
        // It does expose the raw client property or wrappers. 
        // Let's assume we can use the raw client from service or just instantiate.
        // The StripeService wrapper we have might not have `paymentIntents.create` exposed directly.
        // Let's stick to using the `stripe` instance from `StripeService` getter or similar? 
        // Checking `stripe.ts` (implied): it usually has `stripe` property.
        // Assuming public property `stripe` on `StripeService` or just use import.

        // Actually, let's just use the stripe instance from the service if available.
        // Or import Stripe. 
        // For cleaner refactor, let's assume we use the helper logic or direct stripe calls here.
        // Re-using the logic from before is fine.
        const { default: Stripe } = await import('stripe'); // Dynamic import
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-16' as any });

        const options: any = {};
        if (tenant.stripeAccountId) {
            options.stripeAccount = tenant.stripeAccountId;
        }

        const pi = await stripe.paymentIntents.create(params as any, options);
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
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }
    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Server misconfiguration" }, 500);

    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);

    try {
        if (!tenant.stripeAccountId) return c.json({ error: "Stripe not connected" }, 400);
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
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { query } = c.req.query();

    if (!query || query.length < 2) return c.json({ customers: [] });

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) {
        stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
    }

    const service = new PosService(db, tenant.id, c.env, stripeService);
    const customers = await service.searchCustomers(query, tenant.stripeAccountId);

    return c.json({ customers });
});


// POST /customers - Create New Customer (Stripe + Local Guest?)
app.post('/customers', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const body = await c.req.json();
    const { z } = await import('zod');
    const customerSchema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
        phone: z.string().optional()
    });

    const parseResult = customerSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }
    const { email, name, phone } = parseResult.data;

    let stripeCustomerId = null;
    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId) {
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
        try {
            const cus = await stripe.createCustomer({ email, name, phone, metadata: { tenantId: tenant.id } }, tenant.stripeAccountId);
            stripeCustomerId = cus.id;
        } catch (e) { console.error('Stripe Customer Create Error', e); }
    }

    return c.json({ success: true, customer: { id: stripeCustomerId, email, name, isStripeGuest: true } });
});

// PUT /products/:id
app.put('/products/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }
    const id = c.req.param('id');
    const body = await c.req.json();

    const { z } = await import('zod');
    const updateProductSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().nonnegative().optional(),
        stockQuantity: z.number().int().nonnegative().optional(),
        imageUrl: z.string().url().optional(),
        category: z.string().optional(),
        sku: z.string().optional(),
        isActive: z.boolean().optional()
    });

    const parseResult = updateProductSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }
    const data = parseResult.data;

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) {
        stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
    }

    const service = new PosService(db, tenant.id, c.env, stripeService);
    try {
        await service.updateProduct(id, data, tenant.stripeAccountId);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }

    return c.json({ success: true });
});

// POST /products/:id/archive
app.post('/products/:id/archive', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: "Access Denied" }, 403);
    }
    const id = c.req.param('id');

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) {
        stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
    }

    const service = new PosService(db, tenant.id, c.env, stripeService);
    try {
        await service.archiveProduct(id, tenant.stripeAccountId);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }

    return c.json({ success: true });
});

export default app;
