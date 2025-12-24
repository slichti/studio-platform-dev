import { Hono } from 'hono';
import { membershipPlans, subscriptions, tenants } from 'db/src/schema'; // Ensure exported in schema
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: any;
    roles?: string[];
    isImpersonating?: boolean;
}

import { tenantMiddleware } from '../middleware/tenant';
import { authMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// Enforce Auth and Tenant for all membership routes internally to be safe
// app.use('*', authMiddleware); // Already applied in index.ts but can double up if needed. index.ts order should prevail.
// Let's rely on index.ts for auth, but apply tenant here since index.ts seems flaky for it.
app.use('*', tenantMiddleware);

// GET /plans: List all membership plans for tenant
app.get('/plans', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const plans = await db.select().from(membershipPlans).where(eq(membershipPlans.tenantId, tenant.id));
    return c.json(plans);
});

// POST /plans: Create a new plan
app.post('/plans', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // RBAC: Owner only
    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied: Only Owners can create plans' }, 403);
    }

    if (c.get('isImpersonating')) {
        return c.json({ error: 'Action Restricted: Cannot create financial plans while impersonating.' }, 403);
    }

    const { name, description, price, interval, currency, imageUrl, overlayTitle, overlaySubtitle } = await c.req.json();

    if (!name || !price) {
        return c.json({ error: 'Name and Price required' }, 400);
    }

    try {
        const id = crypto.randomUUID();
        await db.insert(membershipPlans).values({
            id,
            tenantId: tenant.id,
            name,
            description,
            price,
            interval: interval || 'month',
            currency: currency || 'usd',
            imageUrl,
            overlayTitle,
            overlaySubtitle,
            active: true
        });

        return c.json({ id, name, price }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
