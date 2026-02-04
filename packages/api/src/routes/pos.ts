import { Hono } from 'hono';
import { createDb } from '../db';
import type { HonoContext } from '../types';
import { PosService } from '../services/pos';
import { StripeService } from '../services/stripe';
import { AutomationsService } from '../services/automations';
import { EmailService } from '../services/email';
import { SmsService } from '../services/sms';
import { UsageService } from '../services/pricing';
import { users, tenantMembers } from '@studio/db/src/schema'; // Added tenantMembers to imports
import { eq } from 'drizzle-orm';
import { AppError, UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';

interface CartItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

const app = new Hono<HonoContext>();

// GET /products - List available inventory
app.get('/products', async (c) => {
    if (!c.get('can')('manage_pos') && !c.get('can')('view_pos')) throw new UnauthorizedError('Access Denied');

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const service = new PosService(db, tenant.id, c.env, undefined);
    const list = await service.listProducts();

    return c.json({ products: list });
});

// POST /products - Add new product
app.post('/products', async (c) => {
    if (!c.get('can')('manage_inventory')) throw new UnauthorizedError('Access Denied');

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

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
    if (!parseResult.success) return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    const service = new PosService(db, tenant.id, c.env, stripeService);
    const id = await service.createProduct(parseResult.data, tenant.stripeAccountId, tenant.currency || 'usd');

    return c.json({ success: true, id });
});

// POST /orders - Create a POS Sale
app.post('/orders', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const staff = c.get('member');
    const { items, memberId, paymentMethod, totalAmount, redeemGiftCardCode, redeemAmount } = await c.req.json();

    const service = new PosService(db, tenant.id, c.env);

    try {
        const result = await service.createOrder(items, totalAmount, memberId, staff?.id, paymentMethod, redeemGiftCardCode, redeemAmount, tenant);

        if (result.asyncTask) c.executionCtx.waitUntil(result.asyncTask());

        try {
            const usageService = new UsageService(db, tenant.id);
            const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY!;
            const isByok = !!(tenant.resendCredentials as any)?.apiKey;

            const emailService = new EmailService(resendKey, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, usageService, isByok);
            const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);
            const autoService = new AutomationsService(db, tenant.id, emailService, smsService);

            if (memberId) {
                const member = await db.query.tenantMembers.findFirst({
                    where: (tm, { eq }) => eq(tm.id, memberId),
                    with: { user: true }
                });
                if (member && member.user) {
                    c.executionCtx.waitUntil(autoService.dispatchTrigger('product_purchase', {
                        userId: member.userId, email: member.user.email, firstName: (member.user.profile as any)?.firstName || 'Friend',
                        data: { amount: totalAmount, orderId: result.orderId, items }
                    }));
                }
            }
        } catch (e) { console.error(e); }

        return c.json({ success: true, orderId: result.orderId });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /orders - History
app.get('/orders', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const service = new PosService(db, tenant.id, c.env);
    return c.json({ orders: await service.getOrderHistory() });
});

// POST /process-payment
app.post('/process-payment', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { items } = await c.req.json();
    if (!items || items.length === 0) return c.json({ error: "No items" }, 400);

    const service = new PosService(db, tenant.id, c.env);
    const { totalAmount, itemDetails } = await service.validatePaymentItems(items);

    if (totalAmount === 0) return c.json({ error: "Total amount is 0" }, 400);
    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Misconfigured" }, 500);

    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-16' as any });

    const options: any = {};
    if (tenant.stripeAccountId) options.stripeAccount = tenant.stripeAccountId;

    try {
        const pi = await stripe.paymentIntents.create({
            amount: totalAmount, currency: tenant.currency || 'usd', automatic_payment_methods: { enabled: true },
            metadata: { tenantId: tenant.id, items: JSON.stringify(itemDetails.map(i => `${i.quantity}x ${i.name}`).join(', ')) }
        }, options);
        return c.json({ clientSecret: pi.client_secret, id: pi.id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /connection-token
app.post('/connection-token', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');
    const tenant = c.get('tenant');
    if (!tenant || !tenant.stripeAccountId) return c.json({ error: "Stripe not connected" }, 400);

    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
    try {
        const token = await stripe.createTerminalConnectionToken(tenant.stripeAccountId);
        return c.json({ secret: token.secret });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /customers
app.get('/customers', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { query } = c.req.query();
    if (!query || query.length < 2) return c.json({ customers: [] });

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    const service = new PosService(db, tenant.id, c.env, stripeService);
    return c.json({ customers: await service.searchCustomers(query, tenant.stripeAccountId) });
});

// POST /customers
app.post('/customers', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { email, name, phone } = await c.req.json();
    let stripeCustomerId = null;
    if (c.env.STRIPE_SECRET_KEY && tenant.stripeAccountId) {
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        try {
            const cus = await stripe.createCustomer({ email, name, phone, metadata: { tenantId: tenant.id } }, tenant.stripeAccountId);
            stripeCustomerId = cus.id;
        } catch (e) { console.error(e); }
    }
    return c.json({ success: true, customer: { id: stripeCustomerId, email, name, isStripeGuest: true } });
});

// PUT /products/:id
app.put('/products/:id', async (c) => {
    if (!c.get('can')('manage_inventory')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const id = c.req.param('id');
    const body = await c.req.json();

    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    const service = new PosService(db, tenant.id, c.env, stripeService);
    try {
        await service.updateProduct(id, body, tenant.stripeAccountId);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /products/:id/archive
app.post('/products/:id/archive', async (c) => {
    if (!c.get('can')('manage_inventory')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const id = c.req.param('id');
    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    const service = new PosService(db, tenant.id, c.env, stripeService);
    try {
        await service.archiveProduct(id, tenant.stripeAccountId);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /products/import
app.post('/products/import', async (c) => {
    if (!c.get('can')('manage_inventory')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { products } = await c.req.json();
    let stripeService: StripeService | undefined;
    if (c.env.STRIPE_SECRET_KEY) stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);
    const service = new PosService(db, tenant.id, c.env, stripeService);

    const results = { success: 0, failed: 0, errors: [] as string[] };
    for (const p of products) {
        try {
            await service.createProduct(p, tenant.stripeAccountId, tenant.currency || 'usd');
            results.success++;
        } catch (e: any) {
            results.failed++;
            results.errors.push(`Failed to import ${p.name}: ${e.message}`);
        }
    }
    return c.json(results);
});

// POST /products/images
app.post('/products/images', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) throw new BadRequestError('Tenant context missing');
    if (!c.get('can')('manage_inventory')) throw new UnauthorizedError('Access Denied');

    const formData = await c.req.parseBody();
    const file = formData['file'];
    if (!(file instanceof File)) return c.json({ error: "No file" }, 400);

    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = c.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) return c.json({ error: "Misconfigured" }, 500);

    const cfFormData = new FormData();
    cfFormData.append("file", file);
    cfFormData.append("metadata", JSON.stringify({ tenantId: tenant.id }));

    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${apiToken}` }, body: cfFormData
        });
        const json: any = await response.json();
        if (!json.success) throw new Error("Upload failed");
        return c.json({ success: true, imageId: json.result.id, url: json.result.variants[0] });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /validate-coupon
app.post('/validate-coupon', async (c) => {
    if (!c.get('can')('manage_pos') && !c.get('can')('view_pos')) throw new UnauthorizedError('Access Denied');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { code, cartTotal } = await c.req.json();
    const service = new PosService(db, tenant.id, c.env);
    return c.json(await service.validateCoupon(code, cartTotal || 0));
});

export default app;
