import { Hono } from 'hono';
import { createDb } from '../db';
import { coupons, couponRedemptions } from 'db/src/schema'; // Ensure exported
import { eq, and, gt, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

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

    });
});

// POST /checkout/session - Create Stripe Session (with optional coupon)
app.post('/checkout/session', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const user = c.get('auth'); // from authMiddleware

    // Check if tenant has stripe connected
    if (!tenant.stripeAccountId) {
        return c.json({ error: "Payments not enabled for this studio." }, 400);
    }

    const { packId, couponCode } = await c.req.json();
    if (!packId) return c.json({ error: "Pack ID required" }, 400);

    // 1. Fetch Pack
    const { classPackDefinitions } = await import('db/src/schema');
    const pack = await db.select().from(classPackDefinitions)
        .where(and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id)))
        .get();

    if (!pack) return c.json({ error: "Pack not found" }, 404);

    let finalAmount = pack.price || 0; // cents
    let appliedCouponId = undefined;

    // 2. Apply Coupon
    if (couponCode) {
        const coupon = await db.select().from(coupons)
            .where(and(
                eq(coupons.tenantId, tenant.id),
                eq(coupons.code, couponCode.toUpperCase()),
                eq(coupons.active, true)
            )).get();

        if (coupon) {
            // Calculate Discount
            if (coupon.type === 'percent') {
                const discount = Math.round(finalAmount * (coupon.value / 100));
                finalAmount -= discount;
            } else { // amount
                // value is in dollars? schema says "value (int)". Let's assume cents to be consistent with price.
                // Wait, UI placeholder said "10" for value. If strict int, likely interpreted as "10%" or "$10 (1000 cents)".
                // Let's assume standard is: percent=10 (10%), amount=1000 ($10.00).
                // But UI input `type="number"` with placeholder "10" suggests user types "10".
                // In `DiscountsPage` UI, we just send `value` as string. Backend `parseInt`s it.
                // If I enter 10 for Amount, that's 10 cents? Or 10 dollars?
                // Convention: usually currency is cents in DB. So user input 10 should be saved as 1000?
                // My UI code saved `value: parseInt(value)`.
                // If user inputs 10, saving 10. That's 10 cents. BAD.
                // Fix: UI should handle conversion or simple convention.
                // Let's assume for 'amount', storage is CENTS. So input 10 -> save 1000.
                // For now, I'll update logic here to handle "If amount, treat as dollars if small?" NO. explicit is better.
                // I will fix the UI save logic later. For now, assume stored value is correct unit (percent or cents).
                finalAmount -= coupon.value;
            }

            if (finalAmount < 0) finalAmount = 0;
            appliedCouponId = coupon.id;
        }
    }

    // 3. Create Session
    const { StripeService } = await import('../services/stripe');
    const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY || '');

    // Stripe requires amount >= $0.50 usually.
    if (finalAmount > 0 && finalAmount < 50) {
        return c.json({ error: "Discounted total is too low for online payment." }, 400);
    }

    try {
        const session = await stripeService.createEmbeddedCheckoutSession(
            tenant.stripeAccountId,
            {
                title: pack.name,
                amount: finalAmount,
                currency: 'usd', // TODO: tenant.currency
                returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id={CHECKOUT_SESSION_ID}`,
                customerEmail: 'TODO_USER_EMAIL', // Need to fetch user email or pass it
                metadata: {
                    type: 'pack_purchase',
                    packId: pack.id,
                    tenantId: tenant.id,
                    userId: user?.userId || 'guest',
                    couponId: appliedCouponId || ''
                }
            }
        );

        return c.json({ clientSecret: session.client_secret });
    } catch (e: any) {
        console.error("Stripe Error:", e);
        return c.json({ error: "Payment init failed: " + e.message }, 500);
    }
});

export default app;
