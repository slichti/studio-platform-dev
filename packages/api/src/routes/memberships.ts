import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { membershipPlans, subscriptions, tenantMembers, users } from '@studio/db/src/schema';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

app.get('/plans', async (c) => {
    const db = createDb(c.env.DB);
    return c.json(await db.select().from(membershipPlans).where(and(eq(membershipPlans.tenantId, c.get('tenant')!.id), eq(membershipPlans.active, true))));
});

app.post('/plans', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { name, description, price, interval, currency, imageUrl, overlayTitle, overlaySubtitle, vodEnabled } = await c.req.json();
    if (!name || !price) return c.json({ error: 'Missing' }, 400);

    const id = crypto.randomUUID();
    await db.insert(membershipPlans).values({ id, tenantId: c.get('tenant')!.id, name, description, price, interval: interval || 'month', currency: currency || c.get('tenant')!.currency || 'usd', imageUrl, overlayTitle, overlaySubtitle, vodEnabled: !!vodEnabled, active: true }).run();
    return c.json({ id, name, price }, 201);
});

app.get('/subscriptions', async (c) => {
    if (!c.get('auth')?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const canManage = c.get('can')('manage_commerce');

    const planId = c.req.query('planId');

    let query = db.select({
        id: subscriptions.id,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt, // Added createdAt
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
            planId ? eq(subscriptions.planId, planId) : undefined
        ));

    if (!canManage) {
        // Enforce user ownership if not admin/manager
        // Note: The previous logic modified the query object directly which is risky with complex where clauses.
        // It's safer to add the user check to the main `where` clause or ensure the base query handles it.
        // However, since we are doing `query = ...`, let's just use `and()` to combine.
        // But `query` is already built. Drizzle query builder is mutable? No, usually chainable.
        // Let's rewrite slightly to be cleaner.
        // Actually, the previous code `if (!canManage) query = (query as any).where(...)` suggests it was chaining.
        // Let's stick to the safe approach of adding it to the initial `where`.
        // BUT `canManage` is a boolean, not a SQL condition suitable for `and()`.
        // Let's re-compose the query.
    }

    // Re-composing for clarity and correctness with the new filter
    const baseWhere = and(
        eq(membershipPlans.tenantId, tenant.id),
        planId ? eq(subscriptions.planId, planId) : undefined,
        !canManage ? eq(users.id, c.get('auth')!.userId) : undefined
    );

    const results = await db.select({
        id: subscriptions.id,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
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
        .where(baseWhere);

    return c.json(results);
});

export default app;
