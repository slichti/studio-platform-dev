import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { tenantMembers, tenantRoles, studentNotes, users, classes, bookings } from 'db/src/schema';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: any;
    roles?: string[];
    isImpersonating?: boolean;
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /members: List all members (Owner only)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Fetch members with roles
    const members = await db.query.tenantMembers.findMany({
        where: eq(tenantMembers.tenantId, tenant.id),
        with: {
            roles: true,
            user: true // assuming relation exists
        }
    });

    return c.json({ members });
    return c.json({ members });
});

// GET /me: Current Member Details
app.get('/me', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth'); // userId guaranteed by authMiddleware

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)),
        with: {
            roles: true
        }
    });

    if (!member) return c.json({ error: 'Not a member of this studio' }, 404);

    return c.json({ member });
});

// PATCH /me/settings: Update Preferences
app.patch('/me/settings', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    const body = await c.req.json(); // { notifications: { sms: true } }

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Not a member' }, 404);

    // Merge settings
    const currentSettings = (member.settings as any) || {};
    const newSettings = {
        ...currentSettings,
        ...body, // Shallow merge top level? Or deep? 
        // If body is { notifications: { sms: true } }, we might overwrite other notifications.
        // Ideally assume body is partial update. 
        // Let's do simple top-level merge for now, but handle notifications specifically if needed.
        // Better: Deep merge if possible, or just expect full object for nested?
        // Let's rely on client sending full 'notifications' object if they update it.
        notifications: {
            ...(currentSettings.notifications || {}),
            ...(body.notifications || {})
        }
    };

    await db.update(tenantMembers)
        .set({ settings: newSettings })
        .where(eq(tenantMembers.id, member.id))
        .run();

    return c.json({ success: true, settings: newSettings });
});

// PATCH /members/:id/role: Update member role (Owner only)
app.patch('/:id/role', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');
    const { role } = await c.req.json(); // 'instructor' or 'student'

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied: Only Owners can manage roles' }, 403);
    }

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    if (member.userId === c.get('auth').userId) {
        return c.json({ error: 'Cannot change your own role' }, 400);
    }

    // Replace roles logic: simple swap for now. 
    // Remove existing roles
    await db.delete(tenantRoles).where(eq(tenantRoles.memberId, memberId)).run();

    // Add new role
    if (role === 'instructor') {
        await db.insert(tenantRoles).values({
            memberId,
            role: 'instructor'
        }).run();
    }
    // If student, we just leave them with no specific extra role (or add 'student' if we treat it as explicit role)
    // Assuming 'student' is default/implicit if no other role.
    // Or if we need explicit 'student' role:
    // await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId, role: 'student' }).run();

    return c.json({ success: true });
});

// GET /members/:id: Get single member details
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id)),
        with: {
            user: true,
            roles: true,
            memberships: {
                with: {
                    plan: true
                }
            },
            purchasedPacks: {
                with: {
                    definition: true
                },
                orderBy: (purchasedPacks, { desc }) => [desc(purchasedPacks.createdAt)]
            },
            bookings: {
                with: {
                    class: true
                },
                orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
                limit: 20
            }
        }
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    return c.json({ member });
});

// GET /members/:id/notes: Get notes for a student
app.get('/:id/notes', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Ensure member belongs to tenant
    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });
    if (!member) return c.json({ error: 'Member not found' }, 404);

    const notes = await db.query.studentNotes.findMany({
        where: eq(studentNotes.studentId, memberId),
        orderBy: (notes, { desc }) => [desc(notes.createdAt)],
        with: {
            author: {
                with: {
                    user: true // To get author name
                }
            }
        }
    });

    return c.json({ notes });
});

// POST /members/:id/notes: Create a note
app.post('/:id/notes', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');
    const { note } = await c.req.json();
    const authorUserId = c.get('auth').userId;

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Find author member ID within this tenant
    const authorMember = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, authorUserId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!authorMember) return c.json({ error: 'Author not found in tenant' }, 400);

    const newNote = {
        id: crypto.randomUUID(),
        studentId: memberId,
        authorId: authorMember.id,
        note,
        tenantId: tenant.id,
        createdAt: new Date()
    };

    await db.insert(studentNotes).values(newNote).run();

    return c.json({ note: newNote });
});

// DELETE /members/:id/notes/:noteId: Delete a note
app.delete('/:id/notes/:noteId', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const noteId = c.req.param('noteId');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Verify note belongs to tenant (security check)
    const note = await db.query.studentNotes.findFirst({
        where: and(eq(studentNotes.id, noteId), eq(studentNotes.tenantId, tenant.id))
    });

    if (!note) return c.json({ error: 'Note not found' }, 404);

    await db.delete(studentNotes).where(eq(studentNotes.id, noteId)).run();

    return c.json({ success: true });
});

// PUT /members/:id/notes/:noteId: Update a note
app.put('/:id/notes/:noteId', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const noteId = c.req.param('noteId');
    const { note: content } = await c.req.json();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Verify note belongs to tenant
    const existingNote = await db.query.studentNotes.findFirst({
        where: and(eq(studentNotes.id, noteId), eq(studentNotes.tenantId, tenant.id))
    });

    if (!existingNote) return c.json({ error: 'Note not found' }, 404);

    await db.update(studentNotes)
        .set({ note: content })
        .where(eq(studentNotes.id, noteId))
        .run();

    return c.json({ success: true, note: { ...existingNote, note: content } });
});

// PATCH /members/:id/status: Update member status (Owner only)
app.patch('/:id/status', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');
    const { status } = await c.req.json(); // 'active', 'inactive', 'archived'

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied: Only Owners can manage status' }, 403);
    }

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    if (member.userId === c.get('auth').userId) {
        return c.json({ error: 'Cannot change your own status' }, 400);
    }

    await db.update(tenantMembers)
        .set({ status })
        .where(eq(tenantMembers.id, memberId))
        .run();

    return c.json({ success: true, status });
});

// POST /members/:id/email: Send Generic Email (Owner/Instructor)
app.post('/:id/email', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');
    const { subject, body } = await c.req.json();
    const { EmailService } = await import('../services/email');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    if (!body || !subject) return c.json({ error: 'Subject and Body required' }, 400);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });

    if (!member || !member.user) return c.json({ error: 'Member or User not found' }, 404);

    const emailService = new EmailService(c.env.RESEND_API_KEY);

    // Wrap body in simple template
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <p>${body.replace(/\n/g, '<br/>')}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">Sent from ${tenant.name}</p>
        </div>
    `;

    try {
        await emailService.sendGenericEmail(member.user.email, subject, html);
    } catch (e: any) {
        return c.json({ error: 'Failed to send email: ' + e.message }, 500);
    }

    return c.json({ success: true });
});

export default app;
