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
            currency: currency || tenant.currency || 'usd',
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

// PATCH /plans/:id: Update a plan
app.patch('/plans/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { id } = c.req.param();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    if (c.get('isImpersonating')) return c.json({ error: 'Restricted' }, 403);

    try {
        const body = await c.req.json();
        // Filter mutable fields
        const { name, description, price, interval, imageUrl, overlayTitle, overlaySubtitle, active } = body;

        await db.update(membershipPlans)
            .set({ name, description, price, interval, imageUrl, overlayTitle, overlaySubtitle, active })
            .where(and(eq(membershipPlans.id, id), eq(membershipPlans.tenantId, tenant.id)))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /plans/:id: Delete a plan
app.delete('/plans/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { id } = c.req.param();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    if (c.get('isImpersonating')) return c.json({ error: 'Restricted' }, 403);

    try {
        // Soft delete ideally, or hard delete if no deps?
        // Let's hard delete for now but check foreign keys might fail if used.
        // Or just delete.
        await db.delete(membershipPlans)
            .where(and(eq(membershipPlans.id, id), eq(membershipPlans.tenantId, tenant.id)))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        // Likely foreign key constraint if used by students
        return c.json({ error: "Cannot delete plan that is in use or DB error: " + e.message }, 400);
    }
});

// GET /subscriptions: List active subscriptions
app.get('/subscriptions', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    const auth = c.get('auth');
    if (!auth || !auth.userId) return c.json({ error: 'Unauthorized' }, 401);

    const isInternal = roles.includes('owner') || roles.includes('instructor');

    // Allow students, owners, instructors
    if (!isInternal && !roles.includes('student')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        // Need to import tenantMembers, users to join
        const { tenantMembers, users } = await import('db/src/schema');

        let query = db.select({
            id: subscriptions.id,
            status: subscriptions.status,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            planName: membershipPlans.name,
            user: {
                id: users.id,
                email: users.email,
                profile: users.profile
            }
        })
            .from(subscriptions)
            .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
            .innerJoin(tenantMembers, eq(subscriptions.memberId, tenantMembers.id))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(membershipPlans.tenantId, tenant.id));

        // If not internal (i.e. is Student), filter by own userId
        if (!isInternal) {
            query = db.select({
                id: subscriptions.id,
                status: subscriptions.status,
                currentPeriodEnd: subscriptions.currentPeriodEnd,
                planName: membershipPlans.name,
                user: {
                    id: users.id,
                    email: users.email,
                    profile: users.profile
                }
            })
                .from(subscriptions)
                .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
                .innerJoin(tenantMembers, eq(subscriptions.memberId, tenantMembers.id))
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .where(and(
                    eq(membershipPlans.tenantId, tenant.id),
                    eq(users.id, auth.userId)
                )) as any;
        }

        const results = await query;
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});
