import { Hono } from 'hono';
import Stripe from 'stripe';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET / - List all Stripe coupons (platform-wide)
app.get('/', async (c) => {
    if (!c.env.STRIPE_SECRET_KEY) {
        // Return empty array if Stripe is not configured (allows page to load)
        return c.json([]);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

    try {
        const coupons = await stripe.coupons.list({ limit: 100 });
        return c.json(coupons.data);
    } catch (e: any) {
        console.error('Failed to fetch coupons:', e);
        return c.json({ error: e.message }, 500);
    }
});

// POST / - Create a new Stripe coupon
app.post('/', async (c) => {
    if (!c.env.STRIPE_SECRET_KEY) {
        return c.json({ error: 'Stripe not configured' }, 500);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    const body = await c.req.json();

    try {
        const params: Stripe.CouponCreateParams = {
            id: body.code, // Use code as ID
            name: body.name || body.code,
            duration: body.duration || 'forever',
        };

        if (body.percent_off) params.percent_off = body.percent_off;
        if (body.amount_off) {
            params.amount_off = body.amount_off;
            params.currency = 'usd';
        }
        if (body.duration === 'repeating' && body.duration_in_months) {
            params.duration_in_months = body.duration_in_months;
        }
        if (body.max_redemptions) params.max_redemptions = body.max_redemptions;
        if (body.redeem_by) params.redeem_by = Math.floor(new Date(body.redeem_by).getTime() / 1000);

        const coupon = await stripe.coupons.create(params);
        return c.json(coupon, 201);
    } catch (e: any) {
        console.error('Failed to create coupon:', e);
        return c.json({ error: e.message }, 400);
    }
});

// DELETE /:id - Delete a Stripe coupon
app.delete('/:id', async (c) => {
    if (!c.env.STRIPE_SECRET_KEY) {
        return c.json({ error: 'Stripe not configured' }, 500);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    const id = c.req.param('id');

    try {
        await stripe.coupons.del(id);
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to delete coupon:', e);
        return c.json({ error: e.message }, 400);
    }
});

export default app;
