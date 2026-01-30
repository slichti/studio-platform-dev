import { Hono } from 'hono';
import { createDb } from '../db';
import { users, tenantMembers, tenantRoles, auditLogs } from '@studio/db/src/schema';
import { eq, sql, desc, or, like, and, inArray, exists } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /users
app.get('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const search = c.req.query('search');
    const tenantId = c.req.query('tenantId');
    const sort = c.req.query('sort') || 'joined_desc';

    const results = await db.query.users.findMany({
        with: { memberships: { with: { tenant: true, roles: true } } },
        where: (u, { and, or, like }) => {
            const conds = [];
            if (search) conds.push(or(like(u.email, `%${search}%`), like(u.id, `%${search}%`), sql`LOWER(json_extract(${u.profile}, '$.firstName')) LIKE ${`%${search.toLowerCase()}%`}`, sql`LOWER(json_extract(${u.profile}, '$.lastName')) LIKE ${`%${search.toLowerCase()}%`}`));
            if (tenantId) conds.push(exists(db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, u.id), eq(tenantMembers.tenantId, tenantId)))));
            return conds.length > 0 ? and(...conds) : undefined;
        },
        orderBy: (u, { desc, asc }) => {
            const ord = [desc(u.isPlatformAdmin)];
            if (sort === 'name_asc') ord.push(asc(sql`json_extract(${u.profile}, '$.firstName')`));
            else if (sort === 'joined_asc') ord.push(asc(u.createdAt));
            else ord.push(desc(u.createdAt));
            return ord;
        },
        limit: 100
    });
    return c.json(results);
});

// GET /admins
app.get('/admins', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    return c.json(await db.query.users.findMany({ where: (u, { eq }) => eq(u.isPlatformAdmin, true), columns: { id: true, email: true, profile: true } }));
});

// PATCH /bulk
app.patch('/bulk', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const auth = c.get('auth')!;
    const { userIds, action, value } = await c.req.json();
    if (!userIds?.length) return c.json({ error: "None selected" }, 400);

    if (action === 'set_platform_admin') {
        await db.update(users).set({ isPlatformAdmin: !!value }).where(inArray(users.id, userIds)).run();
        await db.insert(auditLogs).values({ id: crypto.randomUUID(), action: value ? 'promote' : 'demote', actorId: auth.userId, targetId: userIds.join(','), details: { count: userIds.length, value }, ipAddress: c.req.header('CF-Connecting-IP') }).run();
        return c.json({ success: true, updated: userIds.length });
    }

    if (action === 'delete') {
        const safe = userIds.filter((id: string) => id !== auth.userId);
        if (!safe.length) return c.json({ error: "Invalid selection" }, 400);
        const mems = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(inArray(tenantMembers.userId, safe)).all();
        if (mems.length) {
            await db.delete(tenantRoles).where(inArray(tenantRoles.memberId, mems.map(m => m.id))).run();
            await db.delete(tenantMembers).where(inArray(tenantMembers.userId, safe)).run();
        }
        await db.delete(users).where(inArray(users.id, safe)).run();
        await db.insert(auditLogs).values({ id: crypto.randomUUID(), action: 'bulk_delete', actorId: auth.userId, targetId: safe.join(','), details: { count: safe.length }, ipAddress: c.req.header('CF-Connecting-IP') }).run();
        return c.json({ success: true, count: safe.length });
    }
    return c.json({ error: "Invalid action" }, 400);
});

// POST /
app.post('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { firstName, lastName, email, isPlatformAdmin: admin, initialTenantId, initialRole } = await c.req.json();
    if (!email) return c.json({ error: "Email required" }, 400);

    const exists = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (exists) return c.json({ error: "Exists" }, 409);

    const userId = crypto.randomUUID();
    await db.insert(users).values({ id: userId, email, profile: { firstName, lastName }, isPlatformAdmin: !!admin, role: 'user', createdAt: new Date() }).run();

    if (initialTenantId) {
        const mid = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: mid, tenantId: initialTenantId, userId, status: 'active', joinedAt: new Date(), profile: { firstName, lastName } }).run();
        await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: initialRole || 'student' }).run();
    }
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), action: 'create_user', actorId: c.get('auth')!.userId, targetId: userId, details: { email, initialTenantId }, ipAddress: c.req.header('CF-Connecting-IP') }).run();
    return c.json({ success: true, userId }, 201);
});

// GET /:id
app.get('/:id', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const u = await db.query.users.findFirst({ where: eq(users.id, c.req.param('id')), with: { memberships: { with: { tenant: true, roles: true } } } });
    if (!u) return c.json({ error: "Not found" }, 404);
    return c.json(u);
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const uid = c.req.param('id');
    if (uid === c.get('auth')!.userId) return c.json({ error: "Self" }, 400);

    const mems = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.userId, uid)).all();
    for (const m of mems) await db.delete(tenantRoles).where(eq(tenantRoles.memberId, m.id)).run();
    await db.delete(tenantMembers).where(eq(tenantMembers.userId, uid)).run();
    const res = await db.delete(users).where(eq(users.id, uid)).run();

    if (!res.meta.changes) return c.json({ error: "Not found" }, 404);
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), action: 'delete_user', actorId: c.get('auth')!.userId, targetId: uid, details: { deleted: true }, ipAddress: c.req.header('CF-Connecting-IP') }).run();
    return c.json({ success: true });
});

export default app;
