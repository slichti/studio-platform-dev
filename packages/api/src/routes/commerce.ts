import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, coupons, couponRedemptions, classPackDefinitions, giftCards } from 'db/src/schema'; // Ensure exported
import { eq, and, gt, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: typeof tenantMembers.$inferSelect;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /coupons - List (Admin)
app.get('/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    // Sort by newest
    const list = await db.select().from(coupons)
        .where(eq(coupons.tenantId, tenant.id))
        .orderBy(sql`${coupons.createdAt} DESC`)
        .all();

    return c.json({ coupons: list });
});

// POST /coupons - Create
app.post('/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
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
        if (e.message?.includes('UNIQUE')) {
            return c.json({ error: "Code already exists" }, 409);
        }
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /coupons/:id - Deactivate
app.delete('/coupons/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

    await db.update(coupons)
        .set({ active: false })
        .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// --- Class Packs ---

// GET /packs - List
app.get('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    // const { classPackDefinitions } = await import('db/src/schema');

    const packs = await db.select().from(classPackDefinitions)
        .where(and(
            eq(classPackDefinitions.tenantId, tenant.id),
            eq(classPackDefinitions.active, true)
        ))
        .orderBy(sql`${classPackDefinitions.price} ASC`)
        .all();

    return c.json({ packs });
});

// POST /packs - Create
app.post('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles');

    if (!roles?.includes('owner') && !roles?.includes('instructor')) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    const { name, credits, price, expirationDays } = await c.req.json();
    if (!name || !credits) return c.json({ error: "Missing fields" }, 400);

    const { classPackDefinitions } = await import('db/src/schema');
    const id = crypto.randomUUID();

    await db.insert(classPackDefinitions).values({
        id,
        tenantId: tenant.id,
        name,
        credits: parseInt(credits),
        price: price ? parseInt(price) : 0,
        expirationDays: expirationDays ? parseInt(expirationDays) : null,
        active: true
    }).run();

    return c.json({ success: true, id });
});

// POST /validate - For Checkout
app.post('/validate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { code } = await c.req.json();

    if (!code) return c.json({ valid: false }, 400);

    const coupon = await db.select().from(coupons)
        .where(and(
            eq(coupons.tenantId, tenant.id),
            eq(coupons.code, code.toUpperCase()),
            eq(coupons.active, true)
        ))
        .get();

    if (!coupon) {
        return c.json({ valid: false, reason: "Invalid code" }, 404);
    }

    // Check usage limits if we tracked redemptions count on the coupon row or counted redemptions table
    // For MVP, simplistic check:

    return c.json({
        valid: true,
        coupon: {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value
        }
    });
});


// POST /checkout/session - Create Stripe Session (with optional coupon)
app.post('/checkout/session', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const user = c.get('auth'); // from authMiddleware
    const member = c.get('member');

    // Check if tenant has stripe connected
    if (!tenant.stripeAccountId) {
        return c.json({ error: "Payments not enabled for this studio." }, 400);
    }

    const body = await c.req.json();
    const { packId, couponCode, giftCardCode, giftCardAmount, recipientEmail, recipientName, senderName, message } = body;

    if (!packId && !giftCardAmount) return c.json({ error: "Pack ID or Amount required" }, 400);

    let finalAmount = 0;
    let pack = null;

    if (packId) {
        // 1. Fetch Pack
        // const { classPackDefinitions, giftCards } = await import('db/src/schema');
        pack = await db.select().from(classPackDefinitions)
            .where(and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id)))
            .get();

        if (!pack) return c.json({ error: "Pack not found" }, 404);
        finalAmount = pack.price || 0;
    } else {
        if (giftCardAmount) {
            finalAmount = parseInt(giftCardAmount);
        } else {
            return c.json({ error: "Product or Amount required" }, 400);
        }
    }

    let appliedCouponId = undefined;
    let appliedGiftCardId = undefined;

    // 2. Apply Coupon
    if (couponCode) {
        const coupon = await db.select().from(coupons)
            .where(and(
                eq(coupons.tenantId, tenant.id),
                eq(coupons.code, couponCode.toUpperCase()),
                eq(coupons.active, true)
            )).get();

        if (coupon) {
            if (coupon.type === 'percent') {
                const discount = Math.round(finalAmount * (coupon.value / 100));
                finalAmount -= discount;
            } else {
                finalAmount -= coupon.value;
            }
            if (finalAmount < 0) finalAmount = 0;
            appliedCouponId = coupon.id;
        }
    }

    // 3. Apply Gift Card
    let creditApplied = 0;
    if (giftCardCode && finalAmount > 0) {
        const card = await db.select().from(giftCards)
            .where(and(
                eq(giftCards.tenantId, tenant.id),
                eq(giftCards.code, giftCardCode.toUpperCase()),
                eq(giftCards.status, 'active')
            )).get();

        if (card) {
            creditApplied = Math.min(card.currentBalance, finalAmount);
            finalAmount -= creditApplied;
            appliedGiftCardId = card.id;
        }
    }

    // 4. Handle Zero Amount (Direct Fulfillment)
    if (finalAmount === 0) {
        // Direct Fulfillment
        const { FulfillmentService } = await import('../services/fulfillment');
        const fulfillment = new FulfillmentService(createDb(c.env.DB), c.env.RESEND_API_KEY);
        const mockPaymentId = `direct_${crypto.randomUUID()}`;

        // Handle Pack Logic
        if (pack) {
            await fulfillment.fulfillPackPurchase({
                packId: pack.id,
                tenantId: tenant.id,
                memberId: member?.id || undefined,
                userId: user?.userId,
                couponId: appliedCouponId
            }, mockPaymentId, 0);
        }

        // Handle Gift Card Purchase Logic
        if (giftCardAmount) {
            await fulfillment.fulfillGiftCardPurchase({
                type: 'gift_card_purchase',
                tenantId: tenant.id,
                userId: user?.userId,
                recipientEmail, recipientName, senderName, message,
                amount: parseInt(giftCardAmount) // Use original intended amount
            }, mockPaymentId, parseInt(giftCardAmount));
        }

        // Redeem Used Gift Card
        if (appliedGiftCardId && creditApplied > 0) {
            await fulfillment.redeemGiftCard(appliedGiftCardId, creditApplied, mockPaymentId);
        }

        return c.json({ complete: true, returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id=${mockPaymentId}` });
    }

    // 5. Create Stripe Session
    const { StripeService } = await import('../services/stripe');
    const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY || '');

    // Stripe requires amount >= $0.50 usually.
    if (finalAmount > 0 && finalAmount < 50) {
        return c.json({ error: "Discounted total is too low for online payment." }, 400);
    }

    // Fetch user email if logged in
    let customerEmail = undefined;
    if (user?.userId) {
        const { users } = await import('db/src/schema');
        const userRecord = await db.select({ email: users.email }).from(users).where(eq(users.id, user.userId)).get();
        if (userRecord) customerEmail = userRecord.email;
    }

    try {
        const session = await stripeService.createEmbeddedCheckoutSession(
            tenant.stripeAccountId,
            {
                title: pack ? pack.name : `Gift Card ($${(parseInt(giftCardAmount || '0') / 100).toFixed(2)})`,
                amount: finalAmount,
                currency: tenant.currency || 'usd',
                returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id={CHECKOUT_SESSION_ID}`,
                customerEmail,
                metadata: {
                    type: pack ? 'pack_purchase' : 'gift_card_purchase',
                    packId: pack?.id || '',
                    amount: String(finalAmount),
                    tenantId: tenant.id,
                    userId: user?.userId || 'guest',
                    couponId: appliedCouponId || '',
                    recipientEmail: recipientEmail || '',
                    recipientName: recipientName || '',
                    senderName: senderName || '',
                    message: message || '',
                    // NEW: Pass GC info to webhook
                    usedGiftCardId: appliedGiftCardId || '',
                    creditApplied: String(creditApplied)
                }
            }
        );

        return c.json({ clientSecret: session.client_secret });
    } catch (e: any) {
        console.error("Stripe Error:", e);
        return c.json({ error: "Payment init failed: " + e.message }, 500);
    }
});

// ... wait, I need to rewrite the route to capture variables better.
// Let's rewrite the whole route safely.


export default app;
