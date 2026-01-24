
import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants } from 'db/src/schema'; // Ensure imports
import { eq, like, and, or } from 'drizzle-orm';
import { StripeService } from '../services/stripe';

// ... existing code ...

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: typeof tenants.$inferSelect;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /studios: Public Marketplace Search
app.get('/studios', async (c) => {
    const db = createDb(c.env.DB);
    const query = c.req.query('q');

    const searchCondition = query
        ? or(
            like(tenants.name, `%${query}%`),
            like(tenants.slug, `%${query}%`)
        )
        : undefined;

    const publicStudios = await db.select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        branding: tenants.branding
    })
        .from(tenants)
        .where(
            and(
                eq(tenants.isPublic, true),
                eq(tenants.status, 'active'),
                searchCondition
            )
        )
        .limit(20)
        .all();

    // Sanitize output
    const sanitized = publicStudios.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        logoUrl: (s.branding as any)?.logoUrl,
        primaryColor: (s.branding as any)?.primaryColor
    }));

    return c.json(sanitized);
});

// GET /hardware/skus: List available hardware
app.get('/hardware/skus', async (c) => {
    const tenant = c.get('tenant'); // Optional? If null, maybe platform admin?
    // Any auth'd user can see SKUs? Or just owners?

    // For now, let's require tenant context to know if we list Connect SKUs or Platform SKUs.
    // If tenant, we might want to check if they have a 'pos' feature enabled?

    const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
    try {
        const skus = await stripeService.listHardwareSkus();
        return c.json(skus);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /hardware/orders: Purchase hardware
app.post('/hardware/orders', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) {
        return c.json({ error: "Unauthorized: Only owners can purchase hardware" }, 403);
    }

    const { skuId, quantity, shipping } = await c.req.json();

    if (!skuId || !quantity || !shipping) return c.json({ error: 'Missing required fields' }, 400);

    const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
    try {
        // Order on behalf of the tenant?
        // If we use 'connectedAccountId', the order is created ON that account.
        // We probably want that if they are paying for it themselves via their balance/card?
        // Actually, Stripe Terminal Hardware usage with Connect often requires the Platform to order it
        // and ship to the connected account.
        // HOWEVER, if we pass connectedAccountId, Stripe might charge their balance?
        // Let's try creating it on the Connect Account.

        let targetAccount = tenant.stripeAccountId;
        if (!targetAccount) return c.json({ error: "Stripe not connected" }, 400);

        const order = await stripeService.createHardwareOrder({
            skuId,
            quantity,
            shipping
        }, targetAccount);

        return c.json(order);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
