import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { tenantMembers, tenantRoles, studentNotes, users, classes, bookings, tenants, marketingAutomations, emailLogs, coupons, automationLogs } from 'db/src/schema';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
    features: Set<string>;
    isImpersonating?: boolean;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /members: List all members (Owner only)
// GET /members: List all members (Owner only)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const query = c.req.query('q')?.toLowerCase();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Basic fetch
    let members = await db.query.tenantMembers.findMany({
        where: eq(tenantMembers.tenantId, tenant.id),
        with: {
            roles: true,
            user: true
        },
        orderBy: (tenantMembers, { desc }) => [desc(tenantMembers.joinedAt)]
    });

    // In-memory filter for search (SQLite LIKE across joined tables is tricky with Drizzle Query Builder sometimes)
    // Optimization: If list gets huge, move to raw SQL or better relational query.
    if (query) {
        members = members.filter(m => {
            const email = m.user.email.toLowerCase();
            const first = (m.user.profile as any)?.firstName?.toLowerCase() || '';
            const last = (m.user.profile as any)?.lastName?.toLowerCase() || '';
            const full = `${first} ${last}`;
            return email.includes(query) || first.includes(query) || last.includes(query) || full.includes(query);
        });
    }

    // Filter out platform admins from the member list
    members = members.filter(m => !(m.user as any).isPlatformAdmin);

    return c.json({ members });
});

// POST /members: Add/Invite Member manually
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const { email, firstName, lastName, role } = await c.req.json();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    } // Instructors can add students

    if (!email) return c.json({ error: 'Email is required' }, 400);

    // 1. Check if user exists globally
    let userId: string;
    let user = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (user) {
        userId = user.id;
    } else {
        // Create new Skeleton User
        userId = crypto.randomUUID();
        await db.insert(users).values({
            id: userId,
            email,
            profile: { firstName, lastName },
            createdAt: new Date()
        }).run();
    }

    // 2. Check if already a member of THIS tenant
    const existingMember = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (existingMember) {
        return c.json({ error: 'User is already a member of this studio' }, 409);
    }

    // 3. Add as Member
    const memberId = crypto.randomUUID();
    await db.insert(tenantMembers).values({
        id: memberId,
        tenantId: tenant.id,
        userId,
        status: 'active',
        joinedAt: new Date(),
        profile: { firstName, lastName } // Snapshot
    }).run();

    // 4. Assign Role
    const assignedRole = (roles.includes('owner') && role === 'instructor') ? 'instructor' : 'student';
    await db.insert(tenantRoles).values({
        memberId,
        role: assignedRole
    }).run();

    // 5. Send Invitation Email
    let emailWarning: string | undefined;

    if (c.env.RESEND_API_KEY) {
        try {
            const { EmailService } = await import('../services/email');
            const { UsageService } = await import('../services/pricing');

            const usageService = new UsageService(db, tenant.id);
            const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
            const isByok = !!(tenant.resendCredentials as any)?.apiKey;

            const emailService = new EmailService(
                resendKey,
                { settings: tenant.settings as any, branding: tenant.branding as any },
                { slug: tenant.slug, customDomain: tenant.customDomain },
                usageService,
                isByok
            );

            // Determine URL (Use custom domain if available, else platform subdomain)
            const baseUrl = tenant.customDomain
                ? `https://${tenant.customDomain}`
                : `https://${tenant.slug}.studio-platform.com`; // Adjust based on actual platform domain logic

            const inviteUrl = `${baseUrl}/login?email=${encodeURIComponent(email)}`;

            // Use waitUntil for performance, but we can't catch the error then.
            // Trade-off: Performance vs Feedback. 
            // For "Fix Issues", feedback is prioritized. Let's await it or partially await?
            // Actually, `waitUntil` is best practice for workers. 
            // BUT the issue is "Silent Failure".
            // If we want to report failure, we must await.
            // Let's await. It's an important transaction.
            await emailService.sendInvitation(email, tenant.name, inviteUrl);
        } catch (e: any) {
            console.error("Failed to send invitation email", e);
            emailWarning = "Member created via DB, but email invitation failed: " + e.message;
        }
    } else {
        emailWarning = "Member created, but no email provider is configured.";
    }

    return c.json({ success: true, memberId, warning: emailWarning });
});

// DELETE /members/:id: Remove (Archive) Member
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    // Only Owners can delete members? Or Instructors too? owner for now.
    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);
    if (member.userId === c.get('auth').userId) return c.json({ error: 'Cannot remove yourself' }, 400);

    // Hard Delete or Archive? 
    // "Remove from Studio" usually implies access revocation.
    // Let's Delete roles and then Member record to keep it clean, 
    // UNLESS they have financial history (bookings/purchases).
    // Safe approach: Soft Delete (status=archived).
    // User requested "Remove", let's try Soft Delete first as it preserves history.

    await db.update(tenantMembers)
        .set({ status: 'archived' })
        .where(eq(tenantMembers.id, memberId))
        .run();

    // Also remove roles to prevent login? Or does status=archived block it?
    // tenantMiddleware checks role list. If archvied, we should probably strip roles.
    await db.delete(tenantRoles).where(eq(tenantRoles.memberId, memberId)).run();

    return c.json({ success: true });
});

// POST /members: Add a member (Owner/Instructor)
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const { email, firstName, lastName } = await c.req.json();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    if (!email) return c.json({ error: 'Email is required' }, 400);

    // 1. Check if user exists
    let user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });

    // 2. If not, create placeholder user
    if (!user) {
        const userId = `u_${crypto.randomUUID()}`; // Prefix to indicate generated
        await db.insert(users).values({
            id: userId,
            email,
            profile: { firstName, lastName },
            createdAt: new Date(),
            // Mark as placeholder if schema supports, or just rely on ID format
        }).run();
        user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    }

    if (!user) return c.json({ error: "Failed to resolve user" }, 500);

    // 3. Check if already member
    const existingMember = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenant.id))
    });

    if (existingMember) {
        return c.json({ error: "User is already a member of this studio" }, 409);
    }

    // 4. Create Member
    const memberId = crypto.randomUUID();
    const isNewUser = !existingMember && user.id.startsWith('u_') && !user.lastActiveAt; // User created just now
    let invitationToken = null;

    if (isNewUser) {
        invitationToken = crypto.randomUUID();
    }

    await db.insert(tenantMembers).values({
        id: memberId,
        tenantId: tenant.id,
        userId: user.id,
        status: invitationToken ? 'inactive' : 'active', // Invitees are inactive until acceptance
        joinedAt: new Date(),
        settings: invitationToken ? { invitationToken } : {}
    }).run();

    // Default role: student
    await db.insert(tenantRoles).values({
        memberId,
        role: 'student'
    }).run();

    // Send Invitation Email
    if (invitationToken) {
        const { EmailService } = await import('../services/email');
        const emailService = new EmailService(c.env.RESEND_API_KEY, {
            branding: tenant.branding as any,
            settings: tenant.settings as any
        });

        // Construct Invite URL (Need app URL, let's assume standard based on environment or request origin)
        // Hardcoded generic for now, ideally env variable or c.req.header('origin')
        const origin = c.req.header('origin') || 'https://studio-platform.com'; // Fallback
        const inviteUrl = `${origin}/accept-invite?token=${invitationToken}`;

        try {
            await emailService.sendGenericEmail(
                email,
                `You've been invited to join ${tenant.name}`,
                `<p>Hello ${firstName},</p>
                 <p>You have been invited to join <strong>${tenant.name}</strong> on Studio Platform.</p>
                 <p><a href="${inviteUrl}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
                 <p>Or paste this link: ${inviteUrl}</p>`
            );
        } catch (e) {
            console.error("Failed to send invitation", e);
            // Don't fail the request, just log
        }
    }

    // Fetch complete member object to return
    const newMember = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.id, memberId),
        with: {
            user: true,
            roles: true
        }
    });

    // --- Marketing Automation: New Student (Handled by dispatchTrigger below) ---


    // --- Automation Dispatch (New Student) ---
    try {
        if (newMember && newMember.user) {
            const { AutomationsService } = await import('../services/automations');
            const { EmailService } = await import('../services/email');
            const { SmsService } = await import('../services/sms');
            const { UsageService } = await import('../services/pricing');

            const usageService = new UsageService(db, tenant.id);
            const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
            const isByok = !!(tenant.resendCredentials as any)?.apiKey;

            const emailService = new EmailService(
                resendKey,
                { branding: tenant.branding as any, settings: tenant.settings as any },
                { slug: tenant.slug },
                usageService,
                isByok
            );

            const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);
            const autoService = new AutomationsService(db, tenant.id, emailService, smsService);

            const userProfile = newMember.user.profile as any || {};

            c.executionCtx.waitUntil(autoService.dispatchTrigger('new_student', {
                userId: newMember.userId,
                email: newMember.user.email,
                firstName: userProfile.firstName,
                data: { memberId: newMember.id }
            }));
        }
    } catch (e) {
        console.error("Automation dispatch failed", e);
    }

    // --- Webhook Dispatch ---
    try {
        if (newMember) {
            const { WebhookService } = await import('../services/webhooks');
            const hook = new WebhookService(db);
            const userProfile = newMember.user?.profile as any || {};
            c.executionCtx.waitUntil(hook.dispatch(tenant.id, 'student.created', {
                memberId: newMember.id,
                userId: newMember.user?.id,
                email: newMember.user?.email,
                firstName: userProfile.firstName,
                lastName: userProfile.lastName,
                joinedAt: newMember.joinedAt
            }));
        }
    } catch (e) {
        console.error("Webhook dispatch failed", e);
    }

    return c.json({ success: true, member: newMember });
});

// POST /members/accept-invite: Claim a profile
app.post('/accept-invite', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    const { token } = await c.req.json();

    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
    if (!token) return c.json({ error: "Token required" }, 400);

    // 1. Find the member with this invitation token
    // We need to scan permissions? No, settings is JSON. Drizzle doesn't query JSON easily in SQLite without raw SQL sometimes.
    // Query: SELECT * FROM tenant_members WHERE json_extract(settings, '$.invitationToken') = ?
    // Using Drizzle's sql operator

    // We must find which tenant this belongs to. The token should be unique enough or we search all.
    // Ideally we'd optimize this, but for MVP scanning is heavy?
    // Let's rely on the token being a UUID.

    // BETTER: User clicks link knowing nothing.
    // We need to find the pending member record.
    // const { sql } = await import('drizzle-orm');

    // NOTE: This scan might be slow if millions of members. 
    // For now, let's assume we can query it.

    const pendingMembers = await db.select().from(tenantMembers)
        .where(sql`json_extract(settings, '$.invitationToken') = ${token}`)
        .limit(1);

    const pendingMember = pendingMembers[0];

    if (!pendingMember) {
        return c.json({ error: "Invalid invitation code" }, 404);
    }

    // 2. "Merge" Logic
    // The pending member points to a placeholder ID (e.g. u_123).
    // The auth.userId is the real Clerk ID (e.g. user_xyz).
    // We need to update the tenantMember to point to auth.userId.

    // 2a. Check if auth user is ALREADY a member of this tenant?
    const existingReal = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, pendingMember.tenantId))
    });

    if (existingReal) {
        // User already joined this studio independently?
        // Maybe merge data?
        // For simple MVP: Error or just point the old data to new?
        // Let's just update the pending one and if conflict, we might have issues.
        // If unique index on (tenantId, userId), we can't update.
        return c.json({ error: "You are already a member of this studio." }, 409);
    }

    // 3. Update Member
    // - Clear token
    // - Set status active
    // - Set userId to real ID

    const settings = (pendingMember.settings as any) || {};
    delete settings.invitationToken;

    await db.update(tenantMembers).set({
        userId: auth.userId,
        status: 'active',
        settings
    }).where(eq(tenantMembers.id, pendingMember.id)).run();

    // 4. Cleanup Placeholder User?
    // If the placeholder user has no other members, delete it.
    // const placeholderUserId = pendingMember.userId;
    // ... check and delete ... (Optional cleanup)

    return c.json({ success: true, tenantId: pendingMember.tenantId });
});

// GET /me/bookings: Current Member Bookings
app.get('/me/bookings', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId!), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Not a member of this studio' }, 404);

    const myBookings = await db.query.bookings.findMany({
        where: eq(bookings.memberId, member.id),
        with: {
            class: {
                with: {
                    location: true,
                    instructor: {
                        with: {
                            user: true
                        }
                    }
                }
            }
        },
        orderBy: (bookings, { desc }) => [desc(bookings.createdAt)]
    });

    return c.json({ bookings: myBookings });
});

// GET /me: Current Member Details
app.get('/me', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth'); // userId guaranteed by authMiddleware

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId!), eq(tenantMembers.tenantId, tenant.id)),
        with: {
            roles: true,
            user: true
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
        where: and(eq(tenantMembers.userId, auth.userId!), eq(tenantMembers.tenantId, tenant.id))
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
        // Enforce Limit
        const { UsageService } = await import('../services/pricing');
        const usageService = new UsageService(db, tenant.id);
        const canAdd = await usageService.checkLimit('instructors', tenant.tier || 'basic');

        if (!canAdd) {
            return c.json({
                error: "Instructor limit reached for your plan. Upgrade to add more instructors.",
                code: "LIMIT_REACHED"
            }, 403);
        }

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
            },
            waiverSignatures: {
                with: {
                    template: true
                },
                orderBy: (waiverSignatures, { desc }) => [desc(waiverSignatures.signedAt)]
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
        where: and(eq(tenantMembers.userId, authorUserId!), eq(tenantMembers.tenantId, tenant.id))
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
    const { UsageService } = await import('../services/pricing');

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

    const usageService = new UsageService(db, tenant.id);
    const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
    const isByok = !!(tenant.resendCredentials as any)?.apiKey;

    const emailService = new EmailService(
        resendKey,
        { settings: tenant.settings as any, branding: tenant.branding as any },
        { slug: tenant.slug },
        usageService,
        isByok
    );

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

// GET /members/:id/coupons: List Automation Coupons
app.get('/:id/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const memberId = c.req.param('id');
    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    // 1. Find Automation Logs for this user that have metadata.couponCode
    const logs = await db.select().from(automationLogs) // Ensure imported
        .where(and(
            eq(automationLogs.userId, member.userId),
            eq(automationLogs.tenantId, tenant.id)
        )).all();

    const couponCodes = logs
        .map(l => (l.metadata as any)?.couponCode)
        .filter(Boolean);

    if (couponCodes.length === 0) return c.json({ coupons: [] });

    // 2. Fetch Coupons
    const list = await db.select().from(coupons)
        .where(and(
            eq(coupons.tenantId, tenant.id),
            sql`${coupons.code} IN ${couponCodes}`
        ))
        .orderBy(desc(coupons.createdAt))
        .all();

    return c.json({ coupons: list });
});



export default app;
