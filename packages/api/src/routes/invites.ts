
import { Hono } from 'hono';
import { createDb } from '../db';
import { users, tenantMembers, tenantRoles, tenants, tenantInvitations } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

/**
 * GET /invites/:token
 * Verify token and return invite details (for frontend to display)
 */
app.get('/:token', async (c) => {
    const token = c.req.param('token');
    const db = createDb(c.env.DB);

    const invite = await db.select().from(tenantInvitations).where(eq(tenantInvitations.token, token)).get();

    if (!invite) return c.json({ error: "Invalid invitation" }, 404);
    if (invite.acceptedAt) return c.json({ error: "Invitation already accepted" }, 400);
    if (new Date(invite.expiresAt) < new Date()) return c.json({ error: "Invitation expired" }, 400);

    const tenant = await db.select().from(tenants).where(eq(tenants.id, invite.tenantId)).get();
    const inviter = await db.select().from(users).where(eq(users.id, invite.invitedBy)).get();

    return c.json({
        email: invite.email,
        role: invite.role,
        tenantName: tenant?.name,
        inviterName: inviter?.profile ? `${(inviter.profile as any).firstName}` : 'Admin',
        expiresAt: invite.expiresAt
    });
});

/**
 * POST /invites/:token/accept
 * Accept invitation. Requires authenticated user matching the email (or we auto-link if auth matches).
 */
app.post('/:token/accept', async (c) => {
    const token = c.req.param('token');
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized. Please log in first." }, 401);

    const db = createDb(c.env.DB);

    // 1. Validate Invite
    const invite = await db.select().from(tenantInvitations).where(eq(tenantInvitations.token, token)).get();
    if (!invite) return c.json({ error: "Invalid invitation" }, 404);
    if (invite.acceptedAt) return c.json({ error: "Invitation already accepted" }, 400);
    if (new Date(invite.expiresAt) < new Date()) return c.json({ error: "Invitation expired" }, 400);

    // 2. Validate User
    const user = await db.select().from(users).where(eq(users.id, auth.userId)).get();
    if (!user) return c.json({ error: "User not found" }, 404);

    // Security: Ensure email matches (optional, but good practice).
    // For now, let's allow accepting if logged in, maybe warn if emails differ?
    // Strict mode:
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
        return c.json({ error: `This invitation is for ${invite.email}, but you are logged in as ${user.email}.` }, 403);
    }

    // 3. Link Member
    let member = await db.select().from(tenantMembers).where(and(
        eq(tenantMembers.tenantId, invite.tenantId),
        eq(tenantMembers.userId, user.id)
    )).get();

    if (!member) {
        const memberId = crypto.randomUUID();
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId: invite.tenantId,
            userId: user.id,
            status: 'active'
        }).run();
        member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();
    }

    if (!member) return c.json({ error: "Failed to create member" }, 500);

    // 4. Assign Role
    // Check if role exists
    const existingRule = await db.select().from(tenantRoles).where(and(
        eq(tenantRoles.memberId, member.id),
        eq(tenantRoles.role, invite.role as any)
    )).get();

    if (!existingRule) {
        await db.insert(tenantRoles).values({
            id: crypto.randomUUID(),
            memberId: member.id,
            role: invite.role as any
        }).run();
    }

    // 5. Mark Invite Accepted
    await db.update(tenantInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(tenantInvitations.id, invite.id))
        .run();

    return c.json({ success: true, tenantId: invite.tenantId });
});

export default app;
