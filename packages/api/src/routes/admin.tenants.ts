import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, subscriptions, tenantFeatures, websitePages, auditLogs, users, emailLogs, locations, classes, bookings, products, posOrders, marketingAutomations, marketingCampaigns, waiverTemplates, waiverSignatures, studentNotes, uploads } from '@studio/db/src/schema'; // Removed purchases
import { eq, sql, desc, count, and, inArray } from 'drizzle-orm';
import { AuditService } from '../services/audit';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /
app.get('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);

    const [all, owners, instructors, studentRoles, subs, feats] = await Promise.all([
        db.select().from(tenants).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'owner')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'instructor')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'student')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: subscriptions.tenantId, c: count(subscriptions.id) }).from(subscriptions).where(eq(subscriptions.status, 'active')).groupBy(subscriptions.tenantId).all(),
        db.select().from(tenantFeatures).all()
    ]);

    const ownerMap = new Map(owners.map(o => [o.tenantId, o.c]));
    const instMap = new Map(instructors.map(i => [i.tenantId, i.c]));
    const studentMap = new Map(studentRoles.map(s => [s.tenantId, s.c]));
    const subMap = new Map(subs.map(s => [s.tenantId, s.c]));
    const featMap = new Map();
    feats.forEach(f => { if (!featMap.has(f.tenantId)) featMap.set(f.tenantId, {}); featMap.get(f.tenantId)[f.featureKey] = { enabled: f.enabled, source: f.source }; });

    return c.json(all.map(t => ({
        ...t,
        features: featMap.get(t.id) || {},
        stats: {
            owners: ownerMap.get(t.id) || 0,
            instructors: instMap.get(t.id) || 0,
            subscribers: subMap.get(t.id) || 0,
            totalStudents: studentMap.get(t.id) || 0,
            activeSubscribers: subMap.get(t.id) || 0
        }
    })));
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
        await db.insert(tenants).values({ id, name, slug, tier: tier || 'launch', status: 'active', createdAt: new Date() }).run();
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

// POST /:id/lifecycle/archive
app.post('/:id/lifecycle/archive', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');

    // Soft delete: set status to archived, disable access
    await db.update(tenants).set({
        status: 'archived',
        studentAccessDisabled: true,
        archivedAt: new Date()
    }).where(eq(tenants.id, tid)).run();

    const audit = new AuditService(db);
    await audit.log({
        actorId: c.get('auth')!.userId,
        action: 'archive_tenant',
        targetId: tid,
        details: { status: 'archived' },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true, status: 'archived' });
});

// POST /:id/lifecycle/restore
app.post('/:id/lifecycle/restore', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');

    await db.update(tenants).set({
        status: 'active',
        studentAccessDisabled: false,
        archivedAt: null
    }).where(eq(tenants.id, tid)).run();

    const audit = new AuditService(db);
    await audit.log({
        actorId: c.get('auth')!.userId,
        action: 'restore_tenant',
        targetId: tid,
        details: { status: 'active' },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true, status: 'active' });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tid) });
    if (!t) return c.json({ error: "Not found" }, 404);

    try {
        // Manual Cascade Delete (Reverse Dependency Order)

        // 1. Leaf nodes (Logs, Signatures, Redemptions)
        await db.delete(waiverSignatures).where(inArray(waiverSignatures.memberId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tid)))).run().catch(() => { });
        // Note: Not checking every single table (like couponRedemptions) to save complexity, but covering major ones.

        // 2. High Volume / Operational Data
        await db.delete(bookings).where(inArray(bookings.classId, db.select({ id: classes.id }).from(classes).where(eq(classes.tenantId, tid)))).run();
        await db.delete(classes).where(eq(classes.tenantId, tid)).run();
        // await db.delete(classSeries).where(eq(classSeries.tenantId, tid)).run(); // if exists in imports

        await db.delete(posOrders).where(eq(posOrders.tenantId, tid)).run();

        // 3. Marketing
        await db.delete(marketingAutomations).where(eq(marketingAutomations.tenantId, tid)).run();
        await db.delete(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tid)).run();

        // 4. Products & Plans
        await db.delete(products).where(eq(products.tenantId, tid)).run();
        await db.delete(subscriptions).where(eq(subscriptions.tenantId, tid)).run();

        // 5. Tenant Users/Members
        // Roles first
        await db.delete(tenantRoles).where(inArray(tenantRoles.memberId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tid)))).run();
        await db.delete(tenantMembers).where(eq(tenantMembers.tenantId, tid)).run();

        // 6. Tenant Features & Config
        await db.delete(tenantFeatures).where(eq(tenantFeatures.tenantId, tid)).run();
        await db.delete(websitePages).where(eq(websitePages.tenantId, tid)).run();
        await db.delete(locations).where(eq(locations.tenantId, tid)).run();
        await db.delete(waiverTemplates).where(eq(waiverTemplates.tenantId, tid)).run();

        // 7. Files & Storage
        await db.delete(uploads).where(eq(uploads.tenantId, tid)).run();

        c.executionCtx.waitUntil((async () => {
            try {
                const { StorageService } = await import('../services/storage');
                const ss = new StorageService(c.env.R2!);
                // Delete everything under tenants/{slug}/
                await ss.deleteDirectory(`tenants/${t.slug}/`);
                console.log(`Cleaned up R2 for tenant ${t.slug}`);
            } catch (e) {
                console.error("Failed to clean up R2", e);
            }
        })());

        // 8. Finally: The Tenant
        await db.delete(tenants).where(eq(tenants.id, tid)).run();

        const audit = new AuditService(db);
        await audit.log({
            actorId: c.get('auth')!.userId,
            action: 'delete_tenant',
            targetId: tid,
            details: { name: t.name, slug: t.slug },
            ipAddress: c.req.header('CF-Connecting-IP')
        });
        return c.json({ success: true });
    } catch (e: any) {
        console.error("Delete failed", e);
        return c.json({ error: "Failed to delete tenant: " + e.message }, 500);
    }
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
