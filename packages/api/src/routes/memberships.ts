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

    let query = db.select({ id: subscriptions.id, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, planName: membershipPlans.name, user: { id: users.id, email: users.email, profile: users.profile } }).from(subscriptions).innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id)).innerJoin(tenantMembers, eq(subscriptions.memberId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id)).where(eq(membershipPlans.tenantId, tenant.id));
    if (!canManage) query = (query as any).where(eq(users.id, c.get('auth')!.userId));
    return c.json(await query);
});

export default app;
