import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, coupons, couponRedemptions, classPackDefinitions, giftCards, membershipPlans, users, userRelationships } from '@studio/db/src/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { rateLimit } from '../middleware/rateLimit';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /coupons - List
app.get('/coupons', async (c) => {
    if (!c.get('can')('view_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const list = await db.select({
        coupon: coupons,
        usageCount: sql<number>`count(${couponRedemptions.id})`
    })
        .from(coupons)
        .leftJoin(couponRedemptions, eq(coupons.id, couponRedemptions.couponId))
        .where(eq(coupons.tenantId, tenant.id))
        .groupBy(coupons.id)
        .orderBy(sql`${coupons.createdAt} DESC`)
        .all();

    return c.json({
        coupons: list.map(({ coupon, usageCount }) => ({
            ...coupon,
            usageCount
        }))
    });
});

// POST /coupons - Create
app.post('/coupons', async (c) => {
    if (!c.get('can')('manage_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { code, type, value, usageLimit } = await c.req.json();
    if (!code || !type || !value) return c.json({ error: "Missing fields" }, 400);

    try {
        const id = crypto.randomUUID();
        await db.insert(coupons).values({
            id,
            tenantId: tenant.id,
            code: code.toUpperCase(),
            type,
            value: parseInt(value),
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            active: true
        }).run();

        return c.json({ success: true, id });
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) return c.json({ error: "Code already exists" }, 409);
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /coupons/:id - Deactivate
app.delete('/coupons/:id', async (c) => {
    if (!c.get('can')('manage_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');

    await db.update(coupons)
        .set({ active: false })
        .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// PATCH /coupons/:id/reactivate
app.patch('/coupons/:id/reactivate', async (c) => {
    if (!c.get('can')('manage_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');
    const { days } = await c.req.json().catch(() => ({ days: 7 }));

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + (days || 7));

    await db.update(coupons)
        .set({ active: true, expiresAt: newExpiry })
        .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenant.id)))
        .run();

    return c.json({ success: true, newExpiry });
});

// --- Class Packs ---

// GET /packs - List
app.get('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const packs = await db.select().from(classPackDefinitions)
        .where(and(eq(classPackDefinitions.tenantId, tenant.id), eq(classPackDefinitions.active, true)))
        .orderBy(sql`${classPackDefinitions.price} ASC`)
        .all();

    return c.json({ packs });
});

// POST /packs - Create
app.post('/packs', async (c) => {
    if (!c.get('can')('manage_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { name, credits, price, expirationDays, imageUrl, vodEnabled } = await c.req.json();
    if (!name || !credits) return c.json({ error: "Missing fields" }, 400);

    const id = crypto.randomUUID();
    await db.insert(classPackDefinitions).values({
        id,
        tenantId: tenant.id,
        name,
        credits: parseInt(credits),
        price: price ? parseInt(price) : 0,
        expirationDays: expirationDays ? parseInt(expirationDays) : null,
        imageUrl,
        vodEnabled: !!vodEnabled,
        active: true
    }).run();

    return c.json({ success: true, id });
});

// POST /products/bulk - Bulk Create (Wizard)
app.post('/products/bulk', async (c) => {
    if (!c.get('can')('manage_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const body = await c.req.json() as any;
    const items = body.items;
    if (!items || !Array.isArray(items)) return c.json({ error: "Invalid items" }, 400);

    const { StripeService } = await import('../services/stripe');
    const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);

    const results = [];

    for (const item of items) {
        try {
            const stripeProduct = await stripeService.createProduct({
                name: item.name,
                active: true,
                metadata: { tenantId: tenant.id, type: item.type },
                taxCode: 'txcd_00000000'
            }, tenant.stripeAccountId || undefined);

            let recurring = undefined;
            if (item.type === 'membership' && item.interval) {
                recurring = { interval: (item.interval === 'annual' ? 'year' : 'month') as any, interval_count: 1 };
            }

            const stripePrice = await stripeService.createPrice({
                productId: stripeProduct.id,
                unitAmount: item.price,
                currency: tenant.currency || 'usd',
                recurring
            }, tenant.stripeAccountId || undefined);

            const id = crypto.randomUUID();
            if (item.type === 'pack') {
                await db.insert(classPackDefinitions).values({
                    id, tenantId: tenant.id, name: item.name, price: item.price,
                    credits: item.credits || 1, expirationDays: item.expirationDays || null, active: true
                }).run();
            } else if (item.type === 'membership') {
                await db.insert(membershipPlans).values({
                    id, tenantId: tenant.id, name: item.name, price: item.price,
                    interval: item.interval === 'annual' ? 'year' : 'month',
                    stripeProductId: stripeProduct.id, stripePriceId: stripePrice.id, active: true
                } as any).run();
            }
            results.push({ name: item.name, status: 'created', id });
        } catch (e: any) {
            results.push({ name: item.name, status: 'failed', error: e.message });
        }
    }

    return c.json({ results });
});

// POST /validate - For Checkout
app.post('/validate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { code } = await c.req.json();
    if (!code) return c.json({ valid: false }, 400);

    const coupon = await db.select().from(coupons)
        .where(and(eq(coupons.tenantId, tenant.id), eq(coupons.code, code.toUpperCase()), eq(coupons.active, true))).get();

    if (!coupon) return c.json({ valid: false, reason: "Invalid code" }, 404);

    return c.json({ valid: true, coupon: { code: coupon.code, type: coupon.type, value: coupon.value } });
});

// GET /invoices - List Billing History
app.get('/invoices', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const user = c.get('auth');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    if (!user?.userId) return c.json({ error: "Unauthorized" }, 401);

    const userRecord = await db.select({ stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, user.userId)).get();
    if (!userRecord || !userRecord.stripeCustomerId || !tenant.stripeAccountId) return c.json({ invoices: [] });

    try {
        const { StripeService } = await import('../services/stripe');
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
        const invoices = await stripeService.listInvoices(userRecord.stripeCustomerId, 20, tenant.stripeAccountId);
        const mapped = invoices.data.map(inv => ({
            id: inv.id, date: inv.created * 1000, amount: inv.total, currency: inv.currency,
            status: inv.status, pdfUrl: inv.invoice_pdf, number: inv.number,
            description: inv.lines?.data?.[0]?.description || 'Payment'
        }));
        return c.json({ invoices: mapped });
    } catch (e: any) {
        return c.json({ error: "Failed to fetch invoices" }, 500);
    }
});

// POST /checkout/session
app.post('/checkout/session', rateLimit({ limit: 10, window: 60, keyPrefix: 'checkout' }), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    if (!tenant.stripeAccountId) return c.json({ error: "Payments not enabled." }, 400);

    try {
        if (auth.isImpersonating) return c.json({ error: 'Payments cannot be processed while impersonating.' }, 403);

        const body = await c.req.json();
        const { packId, planId, couponCode, giftCardCode, giftCardAmount, recipientEmail, recipientName, senderName, message } = body;
        if (!packId && !giftCardAmount && !planId) return c.json({ error: "Product ID required" }, 400);

        let finalAmount = 0, basePrice = 0, discountAmount = 0, pack = null, plan = null, stripeMode: 'payment' | 'subscription' = 'payment';

        if (packId) {
            pack = await db.select().from(classPackDefinitions)
                .where(and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id))).get();
            if (!pack) return c.json({ error: "Pack not found" }, 404);
            finalAmount = basePrice = pack.price || 0;
        } else if (planId) {
            plan = await db.select().from(membershipPlans)
                .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id))).get();
            if (!plan || !plan.active) return c.json({ error: "Plan not found/active" }, 404);
            finalAmount = basePrice = plan.price || 0;
            if (plan.interval && plan.interval !== 'one_time') stripeMode = 'subscription';
        } else if (giftCardAmount) {
            finalAmount = basePrice = parseInt(giftCardAmount);
        }

        let appliedCouponId = undefined;
        if (couponCode) {
            const coupon = await db.select().from(coupons).where(and(eq(coupons.tenantId, tenant.id), eq(coupons.code, couponCode.toUpperCase()), eq(coupons.active, true))).get();
            if (coupon) {
                discountAmount = coupon.type === 'percent' ? Math.round(basePrice * (coupon.value / 100)) : coupon.value;
                finalAmount = Math.max(0, finalAmount - discountAmount);
                appliedCouponId = coupon.id;
            }
        }

        const taxableAmount = Math.max(0, basePrice - discountAmount);
        let amountToPay = taxableAmount, creditApplied = 0, appliedGiftCardId = undefined;

        if (giftCardCode && amountToPay > 0) {
            const card = await db.select().from(giftCards).where(and(eq(giftCards.tenantId, tenant.id), eq(giftCards.code, giftCardCode.toUpperCase()), eq(giftCards.status, 'active'))).get();
            if (card) {
                creditApplied = Math.min(card.currentBalance, amountToPay);
                amountToPay -= creditApplied;
                appliedGiftCardId = card.id;
            }
        }

        if (amountToPay === 0) {
            const { FulfillmentService } = await import('../services/fulfillment');
            const fulfillment = new FulfillmentService(db, c.env.RESEND_API_KEY);
            const mockId = `direct_${crypto.randomUUID()}`;
            if (pack) {
                await fulfillment.fulfillPackPurchase({ packId: pack.id, tenantId: tenant.id, memberId: c.get('member')?.id, userId: auth.userId, couponId: appliedCouponId }, mockId, 0);
            }
            if (giftCardAmount) {
                await fulfillment.fulfillGiftCardPurchase({ type: 'gift_card_purchase', tenantId: tenant.id, userId: auth.userId, recipientEmail, recipientName, senderName, message, amount: parseInt(giftCardAmount) }, mockId, parseInt(giftCardAmount));
            }
            if (appliedGiftCardId && creditApplied > 0) await fulfillment.redeemGiftCard(appliedGiftCardId, creditApplied, mockId);
            return c.json({ complete: true, returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id=${mockId}` });
        }

        const amountWithFee = Math.round((amountToPay + 30) / (1 - 0.029));
        const stripeFee = amountWithFee - amountToPay;

        let customerEmail = undefined, stripeCustomerId = undefined;
        if (auth.userId) {
            const userRecord = await db.select({ email: users.email, stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, auth.userId)).get();
            if (userRecord) {
                customerEmail = userRecord.email;
                stripeCustomerId = userRecord.stripeCustomerId || (await db.query.userRelationships.findFirst({ where: eq(userRelationships.childUserId, auth.userId) }).then(async r => {
                    if (!r) return undefined;
                    const p = await db.query.users.findFirst({ where: eq(users.id, r.parentUserId), columns: { stripeCustomerId: true } });
                    return p?.stripeCustomerId;
                }));
            }
        }

        const { StripeService } = await import('../services/stripe');
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY || '');
        const lineItems = [];
        if (taxableAmount > 0) {
            lineItems.push({
                price_data: {
                    currency: tenant.currency || 'usd',
                    product_data: { name: pack ? pack.name : (plan ? plan.name : 'Gift Card Credit'), tax_code: 'txcd_00000000' },
                    unit_amount: Math.max(0, taxableAmount - creditApplied),
                    ...(stripeMode === 'subscription' && plan ? { recurring: { interval: plan.interval as any, interval_count: 1 } } : {})
                },
                quantity: 1
            });
        }
        if (stripeFee > 0) lineItems.push({ price_data: { currency: tenant.currency || 'usd', product_data: { name: 'Processing Fee', tax_code: 'txcd_00000000' }, unit_amount: stripeFee }, quantity: 1 });

        const { PricingService } = await import('../services/pricing');
        const tier = PricingService.getTierConfig(tenant.tier);
        const appFeeDecimal = tier.applicationFeePercent;

        const session = await stripeService.createEmbeddedCheckoutSession(tenant.stripeAccountId!, {
            currency: tenant.currency || 'usd',
            returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id={CHECKOUT_SESSION_ID}`,
            customerEmail, customer: stripeCustomerId || undefined, lineItems, mode: stripeMode, automaticTax: true,
            applicationFeeAmount: stripeMode !== 'subscription' && appFeeDecimal > 0 ? Math.round(amountWithFee * appFeeDecimal) : undefined,
            applicationFeePercent: stripeMode === 'subscription' && appFeeDecimal > 0 ? appFeeDecimal * 100 : undefined,
            metadata: {
                type: pack ? 'pack_purchase' : (plan ? 'membership_purchase' : 'gift_card_purchase'),
                packId: pack?.id || '', planId: plan?.id || '', tenantId: tenant.id, userId: auth.userId || 'guest',
                couponId: appliedCouponId || '', recipientEmail, recipientName, senderName, message,
                productName: pack ? pack.name : (plan ? plan.name : 'Gift Card'), totalCharge: String(amountWithFee),
                usedGiftCardId: appliedGiftCardId || ''
            }
        });

        return c.json({ clientSecret: session.client_secret });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /failed-payments
app.get('/failed-payments', async (c) => {
    if (!c.get('can')('view_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { DunningService } = await import('../services/dunning');
    const dunning = new DunningService(db, tenant.id);
    return c.json({ payments: await dunning.getFailedPayments() });
});

// POST /failed-payments/:id/retry
app.post('/failed-payments/:id/retry', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const subscriptionId = c.req.param('id');
    const { subscriptions } = await import('@studio/db/src/schema');

    const sub = await db.select().from(subscriptions).where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenant.id))).get();
    if (!sub || !sub.stripeSubscriptionId || !tenant.stripeAccountId) return c.json({ error: "Not found/configured" }, 404);

    try {
        const { StripeService } = await import('../services/stripe');
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
        const stripeSubFull = await stripeService.getSubscription(sub.stripeSubscriptionId, tenant.stripeAccountId);
        const latestInvoice = stripeSubFull.latest_invoice as any;
        if (!latestInvoice) return c.json({ error: "No invoice" }, 400);

        const result = await stripeService.payInvoice(tenant.stripeAccountId, latestInvoice.id || latestInvoice);
        return c.json({ success: true, status: result.status });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
