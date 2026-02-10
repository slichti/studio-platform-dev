import { Hono } from 'hono';
import { createDb } from '../db';
import { users, tenantMembers, tenantRoles, tenants } from '@studio/db/src/schema'; // Updated path
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// Middleware: Platform Admin Only
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDb(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, auth.userId)).get();

    if (!user?.isPlatformAdmin) {
        return c.json({ error: "Forbidden: Platform Admin only" }, 403);
    }
    await next();
});

// GET /admin/tenants/:id/owners
app.get('/:id/owners', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');

    const owners = await db.select({
        userId: users.id,
        email: users.email,
        profile: users.profile,
        memberId: tenantMembers.id,
        roleId: tenantRoles.id
    })
        .from(tenantMembers)
        .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantRoles.role, 'owner')
        ))
        .all();

    return c.json(owners);
});

// POST /admin/tenants/:id/owners
app.post('/:id/owners', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { email } = await c.req.json();

    if (!email) return c.json({ error: "Email is required" }, 400);

    // 1. Find User by Email
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
        // TODO: Invite flow. For now, require existing user.
        return c.json({ error: "User not found. Please create a user account first." }, 404);
    }

    // 2. Check if Member exists
    let member = await db.select().from(tenantMembers).where(and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, user.id)
    )).get();

    if (!member) {
        // Create Member
        const memberId = crypto.randomUUID();
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId,
            userId: user.id,
            status: 'active'
        }).run();
        member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();
    }

    if (!member) return c.json({ error: "Failed to create/find member" }, 500);

    // 3. Add Owner Role (if not exists)
    const existingRole = await db.select().from(tenantRoles).where(and(
        eq(tenantRoles.memberId, member.id),
        eq(tenantRoles.role, 'owner')
    )).get();

    if (existingRole) {
        return c.json({ message: "User is already an owner" });
    }

    await db.insert(tenantRoles).values({
        id: crypto.randomUUID(),
        memberId: member.id,
        role: 'owner'
    }).run();

    return c.json({ success: true, memberId: member.id });
});

// DELETE /admin/tenants/:id/owners/:userId
app.delete('/:id/owners/:userId', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const userId = c.req.param('userId');

    // 1. Find Member
    const member = await db.select().from(tenantMembers).where(and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId)
    )).get();

    if (!member) return c.json({ error: "Member not found" }, 404);

    // 2. Remove Owner Role
    await db.delete(tenantRoles).where(and(
        eq(tenantRoles.memberId, member.id),
        eq(tenantRoles.role, 'owner')
    )).run();

    // Check if user has other roles? If not, maybe keep as member or remove member?
    // Let's keep member record for history/other roles.

    return c.json({ success: true });
});

export default app;
