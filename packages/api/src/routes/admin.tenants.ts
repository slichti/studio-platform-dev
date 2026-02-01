import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, subscriptions, tenantFeatures, websitePages, auditLogs, users, emailLogs } from '@studio/db/src/schema';
import { eq, sql, desc, count, and } from 'drizzle-orm';
import { AuditService } from '../services/audit';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /
app.get('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);

    const [all, owners, instructors, subs, feats] = await Promise.all([
        db.select().from(tenants).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'owner')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'instructor')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: subscriptions.tenantId, c: count(subscriptions.id) }).from(subscriptions).where(eq(subscriptions.status, 'active')).groupBy(subscriptions.tenantId).all(),
        db.select().from(tenantFeatures).all()
    ]);

    const ownerMap = new Map(owners.map(o => [o.tenantId, o.c]));
    const instMap = new Map(instructors.map(i => [i.tenantId, i.c]));
    const subMap = new Map(subs.map(s => [s.tenantId, s.c]));
    const featMap = new Map();
    feats.forEach(f => { if (!featMap.has(f.tenantId)) featMap.set(f.tenantId, {}); featMap.get(f.tenantId)[f.featureKey] = { enabled: f.enabled, source: f.source }; });

    return c.json(all.map(t => ({ ...t, features: featMap.get(t.id) || {}, stats: { owners: ownerMap.get(t.id) || 0, instructors: instMap.get(t.id) || 0, subscribers: subMap.get(t.id) || 0 } })));
});

// POST /
app.post('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const auth = c.get('auth')!;
    const { name, slug, tier } = await c.req.json();
    if (!name || !slug) return c.json({ error: "Required fields" }, 400);

    const id = crypto.randomUUID();
    try {
        await db.insert(tenants).values({ id, name, slug, tier: tier || 'basic', status: 'active', createdAt: new Date() }).run();
        const mid = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: mid, tenantId: id, userId: auth.userId, status: 'active' }).run();
        await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: 'owner' }).run();
        await db.insert(websitePages).values({ id: crypto.randomUUID(), tenantId: id, slug: 'home', title: 'Home', content: { root: { props: { title: "Welcome" }, children: [] } }, isPublished: true, createdAt: new Date(), updatedAt: new Date() }).run();
        return c.json({ id, name, slug }, 201);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// PUT /:id/status
app.put('/:id/status', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { status } = await c.req.json();
    await db.update(tenants).set({ status }).where(eq(tenants.id, c.req.param('id'))).run();
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), action: 'update_status', actorId: c.get('auth')!.userId, targetId: c.req.param('id'), details: { status }, ipAddress: c.req.header('CF-Connecting-IP') }).run();
    return c.json({ success: true, status });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tid) });
    if (!t) return c.json({ error: "Not found" }, 404);

    await db.delete(tenants).where(eq(tenants.id, tid)).run();
    const audit = new AuditService(db);
    await audit.log({ actorId: c.get('auth')!.userId, action: 'delete_tenant', targetId: tid, details: { name: t.name, slug: t.slug }, ipAddress: c.req.header('CF-Connecting-IP') });
    return c.json({ success: true });
});

// POST /seed - Dev only
app.post('/seed', async (c) => {
    // Strict Platform Admin Check
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const body = await c.req.json().catch(() => ({})); // Optional body

    try {
        const { seedTenant } = await import('../utils/seeding');
        const result = await seedTenant(db, body);
        return c.json({ success: true, tenant: result });
    } catch (e: any) {
        console.error("Seeding failed", e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
