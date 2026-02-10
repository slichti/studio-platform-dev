import { Hono } from 'hono';
import { createDb } from '../db';
import { users, tenantMembers, tenantRoles, tenants, tenantInvitations } from '@studio/db/src/schema'; // Updated path
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';
import { EmailService } from '../services/email';

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

    // IF USER DOES NOT EXIST -> CREATE INVITATION
    if (!user) {
        // Check for existing invitation
        const existingInvite = await db.select().from(tenantInvitations).where(and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.email, email),
            eq(tenantInvitations.role, 'owner')
        )).get();

        if (existingInvite) {
            return c.json({ message: "Invitation already sent", inviteId: existingInvite.id });
        }

        const auth = c.get('auth');
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

        const token = crypto.randomUUID();
        const inviteId = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await db.insert(tenantInvitations).values({
            id: inviteId,
            tenantId,
            email,
            role: 'owner',
            token,
            expiresAt,
            invitedBy: auth.userId,
            createdAt: new Date()
        }).run();

        // Send Email
        const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
        const inviter = await db.select().from(users).where(eq(users.id, auth.userId)).get();

        if (tenant && inviter) {
            const emailService = new EmailService(c.env.RESEND_API_KEY!);
            // @ts-ignore
            const pagesUrl = c.env.PAGES_URL || 'https://studio-platform-dev.pages.dev';
            const inviteUrl = `${pagesUrl}/invite?token=${token}`; // Assuming frontend route
            // Use API URL for now if frontend route not ready, but usually frontend handles token.
            // We'll point to a generic invite handler on the frontend.

            const inviterName = inviter.profile ? `${(inviter.profile as any).firstName} ${(inviter.profile as any).lastName}` : 'An administrator';

            await emailService.sendOwnerInvitation(email, {
                url: inviteUrl,
                studioName: tenant.name,
                inviterName
            });
        }

        return c.json({ message: "Invitation sent", inviteId });
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
