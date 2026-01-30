import { Hono } from 'hono';
import { createDb } from '../db';
import { tenantMembers, users } from '@studio/db/src/schema';
import { eq, desc } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

app.get('/', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const list = await db.select({ id: tenantMembers.id, engagementScore: tenantMembers.engagementScore, churnStatus: tenantMembers.churnStatus, status: tenantMembers.status, joinedAt: tenantMembers.joinedAt, user: { id: users.id, email: users.email, profile: users.profile } }).from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).where(eq(tenantMembers.tenantId, c.get('tenant')!.id)).orderBy(desc(tenantMembers.engagementScore)).all();
    return c.json(list);
});

app.get('/summary', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const list = await db.select({ score: tenantMembers.engagementScore }).from(tenantMembers).where(eq(tenantMembers.tenantId, c.get('tenant')!.id)).all();
    const total = list.length;
    const engaged = list.filter((m: any) => (m.score || 50) >= 70).length;
    const atRisk = list.filter((m: any) => (m.score || 50) < 30).length;
    return c.json({ total, engaged, atRisk, moderate: total - engaged - atRisk, avgScore: total ? Math.round(list.reduce((s, m) => s + (m.score || 50), 0) / total) : 0 });
});

export default app;
