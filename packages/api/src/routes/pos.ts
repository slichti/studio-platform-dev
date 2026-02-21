import { Hono } from 'hono';
import { createDb } from '../db';
import type { HonoContext } from '../types';
import { PosService } from '../services/pos';
import { StripeService } from '../services/stripe';
import { AutomationsService } from '../services/automations';
import { EmailService } from '../services/email';
import { SmsService } from '../services/sms';
import { UsageService } from '../services/pricing';
import { PushService } from '../services/push';
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
    const { items, memberId, paymentMethod, totalAmount, redeemGiftCardCode, redeemAmount, stripePaymentIntentId, couponCode } = await c.req.json();

    const service = new PosService(db, tenant.id, c.env);

    try {
        const result = await service.createOrder(items, totalAmount, memberId, staff?.id, paymentMethod, redeemGiftCardCode, redeemAmount, tenant, stripePaymentIntentId, couponCode);

        if (result.asyncTask) c.executionCtx.waitUntil(result.asyncTask());

        try {
            const usageService = new UsageService(db, tenant.id);
            const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY!;
            const isByok = !!(tenant.resendCredentials as any)?.apiKey;

            const emailService = new EmailService(resendKey, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, usageService, isByok);
            const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);
            const pushService = new PushService(db, tenant.id);
            const autoService = new AutomationsService(db, tenant.id, emailService, smsService, pushService);

            if (memberId) {
                const member = await db.query.tenantMembers.findFirst({
                    where: (tm, { eq }) => eq(tm.id, memberId),
                    with: { user: true }
                });
                if (member && member.user) {
                    c.executionCtx.waitUntil((async () => {
                        await autoService.dispatchTrigger('product_purchase', {
                            userId: member.userId, email: member.user.email, firstName: (member.user.profile as any)?.firstName || 'Friend',
                            data: { amount: totalAmount, orderId: result.orderId, items }
                        });

                        // [NEW] Trigger: high_retail_spend
                        if (totalAmount >= 10000) { // $100 in cents
                            await autoService.dispatchTrigger('high_retail_spend', {
                                userId: member.userId, email: member.user.email, firstName: (member.user.profile as any)?.firstName || 'Friend',
                                data: { amount: totalAmount, orderId: result.orderId }
                            });
                        }
                    })());
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

    const { items, customerId } = await c.req.json();
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
        const piParams: any = {
            amount: totalAmount,
            currency: tenant.currency || 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: {
                tenantId: tenant.id,
                items: JSON.stringify(itemDetails.map((i: any) => `${i.quantity}x ${i.name}`).join(', '))
            }
        };
        if (customerId) piParams.customer = customerId;
        const pi = await stripe.paymentIntents.create(piParams, options);
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

// GET /transactions - List Stripe transactions with refund status (verapose pattern)
app.get('/transactions', async (c) => {
    if (!c.get('can')('manage_pos') && !c.get('can')('view_pos')) throw new UnauthorizedError('Access Denied');
    const tenant = c.get('tenant');
    if (!tenant || !tenant.stripeAccountId) return c.json({ error: "Stripe not connected" }, 400);
    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Misconfigured" }, 500);

    const { limit = 50, starting_after, created_after } = c.req.query();
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' as any });
    const options = { stripeAccount: tenant.stripeAccountId };

    try {
        const params: Record<string, unknown> = {
            limit: Math.min(parseInt(limit as string) || 50, 100),
            starting_after: starting_after || undefined,
        };
        if (created_after) (params as any).created = { gte: parseInt(created_after) };

        const paymentIntents = await stripe.paymentIntents.list(params as any, options);
        let allRefunds: any[] = [];
        try {
            const refundsRes = await stripe.refunds.list({ limit: 500 }, options);
            allRefunds = refundsRes.data;
        } catch { /* ignore */ }

        const transactions = await Promise.all(paymentIntents.data.map(async (pi) => {
            const refs = allRefunds.filter((r: any) => r.payment_intent === pi.id);
            const totalRefunded = refs.reduce((s: number, r: any) => s + (r.amount || 0), 0);
            let refundStatus: 'none' | 'partially_refunded' | 'fully_refunded' = 'none';
            if (totalRefunded >= pi.amount) refundStatus = 'fully_refunded';
            else if (totalRefunded > 0) refundStatus = 'partially_refunded';

            let customerName: string | null = null, customerEmail: string | null = null;
            if (pi.customer && typeof pi.customer === 'string') {
                try {
                    const cust = await stripe.customers.retrieve(pi.customer, {}, options);
                    if (!cust.deleted) {
                        customerName = cust.name || null;
                        customerEmail = cust.email || null;
                    }
                } catch { /* ignore */ }
            }

            return {
                id: pi.id,
                amount: pi.amount,
                currency: pi.currency,
                status: pi.status,
                customer: pi.customer,
                customer_name: customerName,
                customer_email: customerEmail,
                metadata: pi.metadata,
                created: pi.created,
                refunds: refs.map((r: any) => ({ id: r.id, amount: r.amount, status: r.status, created: r.created })),
                total_refunded: totalRefunded,
                refund_status: refundStatus,
                remaining_refundable: pi.amount - totalRefunded,
            };
        }));

        return c.json({ transactions, hasMore: paymentIntents.has_more });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /customers/:id - Update Stripe customer (verapose pattern)
app.put('/customers/:id', async (c) => {
    if (!c.get('can')('manage_pos')) throw new UnauthorizedError('Access Denied');
    const tenant = c.get('tenant');
    if (!tenant || !tenant.stripeAccountId) return c.json({ error: "Stripe not connected" }, 400);

    const stripeCustomerId = c.req.param('id');
    const body = await c.req.json();
    const { email, name, phone, address } = body;

    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Misconfigured" }, 500);
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    try {
        const params: any = {};
        if (email !== undefined) params.email = email;
        if (name !== undefined) params.name = name;
        if (phone !== undefined) params.phone = phone;
        if (address !== undefined) params.address = address;
        if (Object.keys(params).length === 0) return c.json({ error: "No fields to update" }, 400);

        const customer = await stripe.updateCustomer(stripeCustomerId, params, tenant.stripeAccountId);
        return c.json({ success: true, customer: { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone } });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /refund - Refund by PaymentIntent (verapose pattern; partial/full)
app.post('/refund', async (c) => {
    if (!c.get('can')('manage_pos') && !c.get('can')('manage_commerce')) throw new UnauthorizedError('Access Denied');
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant || !tenant.stripeAccountId || !auth?.userId) return c.json({ error: "Context missing" }, 400);

    const body = await c.req.json();
    const { paymentIntentId, amount, reason } = body;
    if (!paymentIntentId) return c.json({ error: "paymentIntentId required" }, 400);

    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Misconfigured" }, 500);
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    try {
        const { default: Stripe } = await import('stripe');
        const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' as any });
        const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId, { stripeAccount: tenant.stripeAccountId });
        if (pi.status !== 'succeeded') return c.json({ error: "Payment must be succeeded to refund" }, 400);

        const refundAmount = amount && amount > 0 ? Math.round(amount) : undefined;
        const r = await stripe.refundPayment(tenant.stripeAccountId, {
            paymentIntent: paymentIntentId,
            amount: refundAmount,
            reason: (reason as any) || 'requested_by_customer',
            metadata: { refunded_by: auth.userId, refunded_at: new Date().toISOString() },
        });

        const db = createDb(c.env.DB);
        const { refunds, posOrders } = await import('@studio/db/src/schema');
        const { eq } = await import('drizzle-orm');
        const order = await db.select().from(posOrders).where(eq(posOrders.stripePaymentIntentId, paymentIntentId)).get();
        if (order) {
            await db.insert(refunds).values({
                id: crypto.randomUUID(),
                tenantId: tenant.id,
                amount: r.amount || 0,
                reason: reason || 'requested_by_customer',
                status: 'succeeded',
                type: 'pos',
                referenceId: order.id,
                stripeRefundId: r.id,
                memberId: order.memberId,
                performedBy: auth.userId,
            }).run();
            if (!refundAmount || (r.amount || 0) >= pi.amount) {
                await db.update(posOrders).set({ status: 'refunded' }).where(eq(posOrders.id, order.id)).run();
            }
        }

        return c.json({ success: true, refund: { id: r.id, amount: r.amount, status: r.status } });
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
