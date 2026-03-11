import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, coupons, couponRedemptions, classPackDefinitions, giftCards, membershipPlans, users, userRelationships, classes, purchasedPacks } from '@studio/db/src/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { HonoContext } from '../types';
import { PricingService } from '../services/pricing';

const app = new Hono<HonoContext>();

// GET /stats - Aggregated Revenue & Growth
app.get('/stats', async (c) => {
    if (!c.get('can')('view_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { ReportService } = await import('../services/reports');
    const reports = new ReportService(db, tenant.id);

    // Default to last 30 days for stats cards
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    const data = await reports.getRevenue(start, end);

    return c.json({
        totalRevenue: data.grossVolume / 100,
        mrr: data.mrr / 100,
        growth: 12, // Placeholder for trend logic if needed later
        activeSubscribers: 0 // Placeholder
    });
});

// GET /balance - Stripe Account Balance
app.get('/balance', async (c) => {
    if (!c.get('can')('view_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const tenant = c.get('tenant');
    if (!tenant || !tenant.stripeAccountId) return c.json({ available: [] });

    try {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        const balance = await stripe.getBalance(tenant.stripeAccountId);

        return c.json({
            available: balance.available.map(b => ({
                amount: b.amount,
                currency: b.currency
            }))
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /transactions - List Stripe transactions with pagination
app.get('/transactions', async (c) => {
    if (!c.get('can')('view_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const tenant = c.get('tenant');
    if (!tenant || !tenant.stripeAccountId) return c.json({ transactions: [], hasMore: false });

    const { limit = '20', starting_after } = c.req.query();

    try {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);

        // We'll use paymentIntents.list for general transaction history
        // In a real app, you might want balance transactions, but PIs are better for customer-facing info
        const params: any = {
            limit: Math.min(parseInt(limit), 100),
            starting_after: starting_after || undefined,
            expand: ['data.customer']
        };

        const { client, options } = (stripe as any).getClient(tenant.stripeAccountId);
        const paymentIntents = await client.paymentIntents.list(params, options);

        const transactions = paymentIntents.data.map((pi: any) => ({
            id: pi.id,
            date: pi.created * 1000,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
            customerName: pi.customer?.name || pi.metadata?.customerName || 'Guest',
            description: pi.description || pi.metadata?.productName || 'Sale'
        }));

        return c.json({
            transactions,
            hasMore: paymentIntents.has_more,
            lastId: transactions.length > 0 ? transactions[transactions.length - 1].id : undefined
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

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

// GET /products - Aggregate List for Wizard
app.get('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const [packs, plans] = await Promise.all([
        db.select().from(classPackDefinitions)
            .where(and(eq(classPackDefinitions.tenantId, tenant.id), eq(classPackDefinitions.active, true)))
            .all(),
        db.select().from(membershipPlans)
            .where(and(eq(membershipPlans.tenantId, tenant.id), eq(membershipPlans.active, true)))
            .all()
    ]);

    // Map to a common format for the wizard
    const products = [
        ...packs.map(p => ({ id: p.id, name: p.name, type: 'pack', price: p.price })),
        ...plans.map(p => ({ id: p.id, name: p.name, type: 'membership', price: p.price }))
    ];

    return c.json({ products });
});

// GET /plans - list active membership plans for tenant (used by Studio POS / Assign Membership)
app.get('/plans', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const plans = await db.select().from(membershipPlans)
        .where(and(eq(membershipPlans.tenantId, tenant.id), eq(membershipPlans.active, true)))
        .orderBy(sql`${membershipPlans.price} ASC`)
        .all();

    return c.json(plans);
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

    return c.json(packs);
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

// PATCH /packs/:id - Edit
app.patch('/packs/:id', async (c) => {
    if (!c.get('can')('manage_commerce')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const packId = c.req.param('id');
    const { name, credits, price, expirationDays, imageUrl, vodEnabled } = await c.req.json();

    // We only allow active packs to be edited here usually
    const pack = await db.select().from(classPackDefinitions)
        .where(and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id)))
        .get();

    if (!pack) return c.json({ error: "Pack not found" }, 404);

    await db.update(classPackDefinitions).set({
        name: name || pack.name,
        credits: credits ? parseInt(credits) : pack.credits,
        price: price !== undefined ? parseInt(price) : pack.price,
        expirationDays: expirationDays !== undefined ? (expirationDays ? parseInt(expirationDays) : null) : pack.expirationDays,
        imageUrl: imageUrl !== undefined ? imageUrl : pack.imageUrl,
        vodEnabled: vodEnabled !== undefined ? !!vodEnabled : pack.vodEnabled
    }).where(eq(classPackDefinitions.id, packId)).run();

    return c.json({ success: true });
});

// PATCH /packs/:packId/credits - Adjust remaining credits on a purchased pack (manual correction)
app.patch('/packs/:packId/credits', async (c) => {
    if (!c.get('can')('manage_commerce') && !c.get('can')('manage_members')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const packId = c.req.param('packId');
    const body = await c.req.json().catch(() => ({}));
    const { delta } = body as { delta?: number };

    if (delta === undefined || typeof delta !== 'number') {
        return c.json({ error: "Missing or invalid 'delta' (number, e.g. 1 or -1)" }, 400);
    }

    const pack = await db.select().from(purchasedPacks)
        .where(and(eq(purchasedPacks.id, packId), eq(purchasedPacks.tenantId, tenant.id)))
        .get();

    if (!pack) return c.json({ error: "Pack not found" }, 404);

    const newCredits = Math.max(0, pack.remainingCredits + delta);
    await db.update(purchasedPacks)
        .set({ remainingCredits: newCredits })
        .where(eq(purchasedPacks.id, packId))
        .run();

    return c.json({ success: true, remainingCredits: newCredits });
});

// POST /packs/:packId/revoke - Remove a purchased pack from a member (soft revoke; preserves history)
app.post('/packs/:packId/revoke', async (c) => {
    if (!c.get('can')('manage_commerce') && !c.get('can')('manage_members')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const packId = c.req.param('packId');
    const pack = await db.select().from(purchasedPacks)
        .where(and(eq(purchasedPacks.id, packId), eq(purchasedPacks.tenantId, tenant.id)))
        .get();

    if (!pack) return c.json({ error: "Pack not found" }, 404);

    await db.update(purchasedPacks)
        .set({
            remainingCredits: 0,
            status: 'refunded',
            expiresAt: new Date(),
        })
        .where(eq(purchasedPacks.id, packId))
        .run();

    return c.json({ success: true });
});

// POST /purchase - Manual Assignment (Internal / admin only)
app.post('/purchase', async (c) => {
    if (!c.get('can')('manage_commerce') && !c.get('can')('manage_members')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    // Provide auth user context for fulfillment logs if needed
    const authUser = c.get('auth');

    const body = await c.req.json();
    const { memberId, productId, type } = body;

    if (!memberId || !productId || !type) {
        return c.json({ error: "Missing required fields" }, 400);
    }

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) {
        return c.json({ error: "Member not found" }, 404);
    }

    // Ensure member is active whenever a pack or membership is manually granted.
    // This is especially important for migrations and complimentary grants.
    if (member.status !== 'active') {
        await db.update(tenantMembers)
            .set({ status: 'active' })
            .where(eq(tenantMembers.id, memberId))
            .run();
    }

    const { FulfillmentService } = await import('../services/fulfillment');
    const fulfillment = new FulfillmentService(db, c.env.RESEND_API_KEY, c.env);
    const mockPaymentId = `manual_${crypto.randomUUID()}`;

    try {
        if (type === 'pack') {
            await fulfillment.fulfillPackPurchase(
                {
                    packId: productId,
                    tenantId: tenant.id,
                    memberId: memberId,
                    userId: member.userId,
                    source: 'admin_assignment'
                },
                mockPaymentId,
                0 // manual assignments are 0 price logged usually or handled externally
            );
        } else if (type === 'membership') {
            // fulfillMembershipPurchase expects a stripe subscription ID usually, but we bypass stripe for manual
            // So we can pass a mock sub ID
            await fulfillment.fulfillMembershipPurchase(
                {
                    type: 'membership_purchase',
                    planId: productId,
                    tenantId: tenant.id,
                    userId: member.userId,
                    source: 'admin_assignment'
                },
                mockPaymentId,
                'manual_customer'
            );
        } else {
            return c.json({ error: "Invalid product type" }, 400);
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error("Manual fulfillment error", e);
        return c.json({ error: e.message || "Failed to assign product" }, 500);
    }
});

// POST /products/bulk - Bulk Create (Wizard); idempotent: skips items that already exist (same name + type)
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
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);

    const results: { name: string; status: string; id?: string; error?: string }[] = [];
    let created = 0;
    let skipped = 0;

    for (const item of items) {
        try {
            // Normalize type - handle both 'pack' and 'class_pack'
            const type = item.type === 'class_pack' || item.type === 'pack' ? 'pack' : item.type;
            const name = item.name;

            // Idempotency: skip if a product with same name and type already exists (case-insensitive)
            if (type === 'pack') {
                const existing = await db.select({ id: classPackDefinitions.id }).from(classPackDefinitions)
                    .where(and(
                        eq(classPackDefinitions.tenantId, tenant.id),
                        sql`LOWER(${classPackDefinitions.name}) = LOWER(${name})`,
                        eq(classPackDefinitions.active, true)
                    )).get();
                if (existing) {
                    results.push({ name, status: 'skipped' });
                    skipped++;
                    continue;
                }
            } else if (type === 'membership') {
                const existing = await db.select({ id: membershipPlans.id }).from(membershipPlans)
                    .where(and(
                        eq(membershipPlans.tenantId, tenant.id),
                        sql`LOWER(${membershipPlans.name}) = LOWER(${name})`,
                        eq(membershipPlans.active, true)
                    )).get();
                if (existing) {
                    results.push({ name, status: 'skipped' });
                    skipped++;
                    continue;
                }
            } else {
                // Unknown type, skip explicitly to avoid random processing
                results.push({ name, status: 'failed', error: 'Invalid product type' });
                continue;
            }

            const stripeProduct = await stripe.createProduct({
                name: `${tenant.name} - ${name}`,
                active: true,
                metadata: { tenantId: tenant.id, type: type },
                taxCode: 'txcd_00000000'
            }, tenant.stripeAccountId || undefined);

            let recurring = undefined;
            if (type === 'membership' && item.interval) {
                recurring = { interval: (item.interval === 'annual' ? 'year' : 'month') as any, interval_count: 1 };
            }

            const stripePrice = await stripe.createPrice({
                productId: stripeProduct.id,
                unitAmount: item.price,
                currency: tenant.currency || 'usd',
                recurring
            }, tenant.stripeAccountId || undefined);

            const id = crypto.randomUUID();
            if (type === 'pack') {
                await db.insert(classPackDefinitions).values({
                    id,
                    tenantId: tenant.id,
                    name,
                    price: item.price,
                    // Use credits or quantity (frontend uses quantity, backend uses credits)
                    credits: item.credits || item.quantity || 1,
                    expirationDays: item.expirationDays || null,
                    stripeProductId: stripeProduct.id,
                    stripePriceId: stripePrice.id,
                    active: true
                }).run();
            } else if (type === 'membership') {
                await db.insert(membershipPlans).values({
                    id,
                    tenantId: tenant.id,
                    name,
                    price: item.price,
                    interval: item.interval === 'annual' ? 'year' : 'month',
                    stripeProductId: stripeProduct.id,
                    stripePriceId: stripePrice.id,
                    active: true
                }).run();
            }
            results.push({ name, status: 'created', id });
            created++;
        } catch (e: any) {
            results.push({ name: item.name, status: 'failed', error: e.message });
        }
    }

    return c.json({ results, created, skipped });
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
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);
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
app.post('/checkout/session', rateLimitMiddleware({ limit: 10, window: 60, keyPrefix: 'checkout' }), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    if (!tenant.stripeAccountId) return c.json({ error: "Payments not enabled." }, 400);

    try {
        if (!!(auth as any).isImpersonating) return c.json({ error: 'Payments cannot be processed while impersonating.' }, 403);

        const body = await c.req.json();
        const { packId, planId, recordingId, couponCode, giftCardCode, giftCardAmount, recipientEmail, recipientName, senderName, message, platform } = body;
        if (!packId && !giftCardAmount && !planId && !recordingId) return c.json({ error: "Product ID required" }, 400);

        let finalAmount = 0, basePrice = 0, discountAmount = 0, pack = null, plan = null, recording = null, stripeMode: 'payment' | 'subscription' = 'payment';

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
        } else if (recordingId) {
            recording = await db.select().from(classes)
                .where(and(eq(classes.id, recordingId), eq(classes.tenantId, tenant.id))).get();
            if (!recording || !recording.cloudflareStreamId) return c.json({ error: "Recording not found" }, 404);
            if (!recording.isRecordingSellable) return c.json({ error: "This recording is not for sale" }, 403);
            finalAmount = basePrice = recording.recordingPrice || recording.price || 0;
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
            const fulfillment = new FulfillmentService(db, c.env.RESEND_API_KEY, c.env);
            const mockId = `direct_${crypto.randomUUID()}`;
            if (pack) {
                await fulfillment.fulfillPackPurchase({ packId: pack.id, tenantId: tenant.id, memberId: c.get('member')?.id, userId: auth.userId, couponId: appliedCouponId }, mockId, 0);
            }
            if (recording) {
                await fulfillment.fulfillVideoPurchase({ classId: recording.id, tenantId: tenant.id, userId: auth.userId, couponId: appliedCouponId }, mockId, 0);
            }
            if (giftCardAmount) {
                await fulfillment.fulfillGiftCardPurchase({ type: 'gift_card_purchase', tenantId: tenant.id, userId: auth.userId, recipientEmail, recipientName, senderName, message, amount: parseInt(giftCardAmount) }, mockId, parseInt(giftCardAmount));
            }
            if (appliedGiftCardId && creditApplied > 0) await fulfillment.redeemGiftCard(appliedGiftCardId, creditApplied, mockId);

            if (platform === 'mobile') {
                // For mobile, we want to return a success URL or status so the app can handle it
                // But since there's no checkout session, we can just return success: true
                return c.json({ complete: true, paymentNotRequired: true });
            }
            return c.json({ complete: true, returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id=${mockId}` });
        }

        const amountWithFee = Math.round((amountToPay + 30) / (1 - 0.029));
        const stripeFee = amountWithFee - amountToPay;

        const { StripeService } = await import('../services/stripe');
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY || '');

        let customerEmail = undefined, stripeCustomerId = undefined;
        if (auth.userId) {
            const userRecord = await db.query.users.findFirst({ where: eq(users.id, auth.userId) });
            if (userRecord) {
                customerEmail = userRecord.email;

                // Fetch tenant member to get tenant-scoped Stripe Customer ID
                const member = await db.query.tenantMembers.findFirst({
                    where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id))
                });

                if (member && member.stripeCustomerId) {
                    stripeCustomerId = member.stripeCustomerId;
                } else if (!member?.stripeCustomerId && tenant.stripeAccountId) {
                    // Try to fetch parent relationship if this is a child
                    let parentHasId = false;
                    const rel = await db.query.userRelationships.findFirst({ where: eq(userRelationships.childUserId, auth.userId) });
                    if (rel) {
                        const pMember = await db.query.tenantMembers.findFirst({
                            where: and(eq(tenantMembers.userId, rel.parentUserId), eq(tenantMembers.tenantId, tenant.id))
                        });
                        if (pMember && pMember.stripeCustomerId) {
                            stripeCustomerId = pMember.stripeCustomerId;
                            parentHasId = true;
                        }
                    }

                    if (!parentHasId) {
                        try {
                            const name = userRecord.profile ? `${(userRecord.profile as any).firstName || ''} ${(userRecord.profile as any).lastName || ''}`.trim() : 'Studio Member';
                            const newCustomer = await stripeService.createCustomer({
                                email: userRecord.email,
                                name: name || 'Studio Member',
                                metadata: { userId: userRecord.id, tenantId: tenant.id }
                            }, tenant.stripeAccountId);

                            stripeCustomerId = newCustomer.id;

                            if (member) {
                                await db.update(tenantMembers).set({ stripeCustomerId: newCustomer.id }).where(eq(tenantMembers.id, member.id)).run();
                            }
                        } catch (e) {
                            console.error("[Commerce] Failed to create Stripe customer:", e);
                        }
                    }
                }
            }
        }
        const lineItems = [];
        if (taxableAmount > 0) {
            const prodName = pack ? pack.name : (plan ? plan.name : (recording ? `Access: ${recording.title}` : 'Gift Card Credit'));
            lineItems.push({
                price_data: {
                    currency: tenant.currency || 'usd',
                    product_data: {
                        name: `${tenant.name} - ${prodName}`,
                        tax_code: 'txcd_00000000'
                    },
                    unit_amount: Math.max(0, taxableAmount - creditApplied),
                    ...(stripeMode === 'subscription' && plan ? { recurring: { interval: plan.interval as any, interval_count: plan.intervalCount || 1 } } : {})
                },
                quantity: 1
            });
        }
        // Fee on top is only for embedded usually, but let's keep it consistent or remove it for hosted if we want.
        // For hosted, usually fees are absorbed or added differently. 
        // We'll keep the logic same for now.
        if (stripeFee > 0) lineItems.push({ price_data: { currency: tenant.currency || 'usd', product_data: { name: 'Processing Fee', tax_code: 'txcd_00000000' }, unit_amount: stripeFee }, quantity: 1 });

        const feeBasisPoints = await PricingService.getApplicationFeeConfig(db, tenant.id);

        const metadata = {
            type: pack ? 'pack_purchase' : (plan ? 'membership_purchase' : (recording ? 'recording_purchase' : 'gift_card_purchase')),
            packId: pack?.id || '',
            packName: pack?.name || '',
            packCredits: pack?.credits || undefined,
            planId: plan?.id || '',
            planName: plan?.name || '',
            planInterval: plan?.interval || '',
            recordingId: recording?.id || '',
            tenantId: tenant.id,
            userId: auth.userId || 'guest',
            couponId: appliedCouponId || '',
            recipientEmail,
            recipientName,
            senderName,
            message,
            productName: pack ? pack.name : (plan ? plan.name : (recording ? recording.title : 'Gift Card')),
            totalCharge: String(amountWithFee),
            usedGiftCardId: appliedGiftCardId || '',
            autoRenew: plan ? String(plan.autoRenew) : '',
            source: platform === 'mobile' ? 'mobile_checkout' : 'web_checkout'
        };

        if (platform === 'mobile') {
            // Use Hosted Checkout for Mobile
            const session = await stripeService.createCheckoutSession(tenant.stripeAccountId!, {
                currency: tenant.currency || 'usd',
                successUrl: `studio-mobile://checkout/success?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `studio-mobile://checkout/cancel`,
                customerEmail,
                customer: stripeCustomerId || undefined,
                lineItems,
                mode: stripeMode,
                automaticTax: true,
                applicationFeeAmount: stripeMode !== 'subscription' && feeBasisPoints > 0 ? PricingService.calculateApplicationFeeAmount(amountWithFee, feeBasisPoints) : undefined,
                applicationFeePercent: stripeMode === 'subscription' && feeBasisPoints > 0 ? feeBasisPoints / 100 : undefined,
                metadata: metadata,
                statementDescriptorSuffix: tenant.name.replace(/[<>"']/g, '').substring(0, 22),
                description: `${tenant.name} - ${metadata.productName}`
            });

            return c.json({ url: session.url });
        } else {
            // Embedded (Web)
            const session = await stripeService.createEmbeddedCheckoutSession(tenant.stripeAccountId!, {
                currency: tenant.currency || 'usd',
                returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id={CHECKOUT_SESSION_ID}`,
                customerEmail, customer: stripeCustomerId || undefined, lineItems, mode: stripeMode, automaticTax: true,
                applicationFeeAmount: stripeMode !== 'subscription' && feeBasisPoints > 0 ? PricingService.calculateApplicationFeeAmount(amountWithFee, feeBasisPoints) : undefined,
                applicationFeePercent: stripeMode === 'subscription' && feeBasisPoints > 0 ? feeBasisPoints / 100 : undefined,
                metadata: metadata,
                statementDescriptorSuffix: tenant.name.replace(/[<>"']/g, '').substring(0, 22),
                description: `${tenant.name} - ${metadata.productName}`
            });

            return c.json({ clientSecret: session.client_secret });
        }
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
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);
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
