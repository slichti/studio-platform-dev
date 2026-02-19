import { Hono } from 'hono';
import { sign } from 'hono/jwt';
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
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    const search = c.req.query('search');
    const tenantId = c.req.query('tenantId');
    const sort = c.req.query('sort') || 'joined_desc';

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(...(function () {
        const conds = [];
        if (search) conds.push(or(like(users.email, `%${search}%`), like(users.id, `%${search}%`), sql`LOWER(json_extract(${users.profile}, '$.firstName')) LIKE ${`%${search.toLowerCase()}%`}`, sql`LOWER(json_extract(${users.profile}, '$.lastName')) LIKE ${`%${search.toLowerCase()}%`}`));
        if (tenantId) conds.push(exists(db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, users.id), eq(tenantMembers.tenantId, tenantId)))));
        return conds;
    })())).get();

    const total = countResult?.count || 0;

    // Additional stats for the admin
    const [{ count: assignedCount }] = await db.select({ count: sql<number>`count(distinct ${tenantMembers.userId})` }).from(tenantMembers).all();
    const stats = {
        total,
        assigned: assignedCount || 0,
        orphans: total - (assignedCount || 0)
    };

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
        limit,
        offset
    });
    return c.json({
        users: results,
        total,
        stats,
        limit,
        offset
    });
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

// POST /impersonate
app.post('/impersonate', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const auth = c.get('auth')!;
    const { targetUserId } = await c.req.json();

    if (!targetUserId) return c.json({ error: "Target User ID required" }, 400);
    if (targetUserId === auth.userId) return c.json({ error: "Cannot impersonate self" }, 400);

    const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId)
    });

    if (!targetUser) return c.json({ error: "Target user not found" }, 404);

    const realId = auth.claims?.impersonatorId || auth.userId;
    const token = await sign({
        sub: targetUserId,
        impersonatorId: realId,
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    }, c.env.CLERK_SECRET_KEY as string);

    try {
        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            action: 'impersonate_user',
            actorId: realId,
            targetId: targetUserId,
            details: { targetEmail: targetUser.email },
            ipAddress: c.req.header('CF-Connecting-IP'),
            createdAt: new Date()
        }).run();
    } catch (err) {
        console.error("Failed to log impersonation event:", err);
    }

    return c.json({ token, user: targetUser, targetEmail: targetUser.email });
});

// POST /cleanup - Purge orphaned users
app.post('/cleanup', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const auth = c.get('auth')!;

    try {
        // Find users who have no memberships and are NOT platform admins
        const orphans = await db.select({ id: users.id })
            .from(users)
            .where(
                and(
                    eq(users.isPlatformAdmin, false),
                    ne(users.role, 'admin'),
                    ne(users.id, auth.userId),
                    sql`NOT EXISTS (SELECT 1 FROM ${tenantMembers} WHERE ${tenantMembers.userId} = ${users.id})`
                )
            )
            .all();

        if (orphans.length === 0) {
            return c.json({ success: true, count: 0, message: "No orphaned users found." });
        }

        const orphanIds = orphans.map(o => o.id);
        const CHUNK_SIZE = 50;
        let deletedCount = 0;

        for (let i = 0; i < orphanIds.length; i += CHUNK_SIZE) {
            const chunk = orphanIds.slice(i, i + CHUNK_SIZE);
            await db.delete(users).where(inArray(users.id, chunk)).run();
            deletedCount += chunk.length;
        }

        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            action: 'purge_orphans',
            actorId: auth.userId,
            details: { count: deletedCount },
            ipAddress: c.req.header('CF-Connecting-IP'),
            createdAt: new Date()
        }).run();

        return c.json({ success: true, count: deletedCount, message: `Successfully purged ${deletedCount} orphaned users.` });
    } catch (e: any) {
        console.error("Orphan purge failed:", e);
        return c.json({ error: "Failed to purge orphans: " + e.message }, 500);
    }
});

export default app;
