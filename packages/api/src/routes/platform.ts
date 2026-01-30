import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';
import { eq, like, and, or } from 'drizzle-orm';
import { StripeService } from '../services/stripe';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /plans: Public Pricing Plans
app.get('/plans', async (c) => {
    const db = createDb(c.env.DB as any);
    try {
        const { platformPlans } = await import('@studio/db/src/schema');
        const list = await db.select().from(platformPlans).where(eq(platformPlans.active, true)).all();
        return c.json(list);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /studios: Public Marketplace Search
app.get('/studios', async (c) => {
    const db = createDb(c.env.DB as any);
    const query = c.req.query('q');

    const searchCondition = query ? or(like(tenants.name, `%${query}%`), like(tenants.slug, `%${query}%`)) : undefined;

    const list = await db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug, branding: tenants.branding })
        .from(tenants).where(and(eq(tenants.isPublic, true), eq(tenants.status, 'active'), searchCondition)).limit(20).all();

    return c.json(list.map(s => ({ id: s.id, name: s.name, slug: s.slug, logoUrl: (s.branding as any)?.logoUrl, primaryColor: (s.branding as any)?.primaryColor })));
});

// GET /hardware/skus
app.get('/hardware/skus', async (c) => {
    if (!c.get('can')('view_pos') && !c.get('can')('manage_pos')) return c.json({ error: 'Unauthorized' }, 403);
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
    try {
        const skus = await stripe.listHardwareSkus();
        return c.json(skus);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// POST /hardware/orders
app.post('/hardware/orders', async (c) => {
    if (!c.get('can')('manage_pos')) return c.json({ error: "Unauthorized" }, 403);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const { skuId, quantity, shipping } = await c.req.json();
    if (!skuId || !quantity || !shipping) return c.json({ error: 'Missing fields' }, 400);

    if (!tenant.stripeAccountId) return c.json({ error: "Stripe not connected" }, 400);

    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
    try {
        const order = await stripe.createHardwareOrder({ skuId, quantity, shipping }, tenant.stripeAccountId);
        return c.json(order);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default app;
