import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '../db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { tenantMembers, tenantRoles, studentNotes, users, classes, bookings, tenants, marketingAutomations, emailLogs, coupons, automationLogs, purchasedPacks, waiverSignatures } from '@studio/db/src/schema';
import { HonoContext } from '../types';

import { ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = new OpenAPIHono<HonoContext>();

// --- Schemas ---

const MemberUserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    profile: z.any().optional(),
    isPlatformAdmin: z.boolean().optional()
});

const MemberRoleSchema = z.object({
    role: z.string()
});

const MemberSchema = z.object({
    id: z.string(),
    userId: z.string(),
    status: z.string(),
    joinedAt: z.string().or(z.date()).optional(),
    user: MemberUserSchema,
    roles: z.array(MemberRoleSchema).optional(),
    customFields: z.record(z.string(), z.any()).optional()
}).openapi('Member');

const MemberListResponse = z.object({
    members: z.array(MemberSchema)
});

const SettingsSchema = z.record(z.string(), z.any()).openapi('MemberSettings');



// --- Routes ---

// GET /members
const listMembersRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Members'],
    summary: 'List all members',
    request: {
        query: z.object({
            q: z.string().optional().openapi({ description: 'Search query' })
        })
    },
    responses: {
        200: {
            content: { 'application/json': { schema: MemberListResponse } },
            description: 'List of members'
        },
        403: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Unauthorized'
        }
    }
});

app.openapi(listMembersRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const q = c.req.valid('query').q?.toLowerCase();

    let list = await db.query.tenantMembers.findMany({ where: eq(tenantMembers.tenantId, tenant.id), with: { roles: true, user: true }, orderBy: [desc(tenantMembers.joinedAt)] });

    // Manual search filtering
    if (q) list = list.filter((m: any) => `${m.user.email} ${(m.user.profile as any)?.firstName} ${(m.user.profile as any)?.lastName}`.toLowerCase().includes(q));

    const result = list.filter((m: any) => !m.user.isPlatformAdmin).map((m: any) => ({
        ...m,
        joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : undefined
    }));

    return c.json({ members: result }, 200);
});

// POST /members
const createMemberRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Members'],
    summary: 'Create a new member',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        email: z.string().email(),
                        firstName: z.string(),
                        lastName: z.string(),
                        role: z.string().optional()
                    })
                }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ success: z.boolean(), memberId: z.string() }) } },
            description: 'Member created'
        },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Bad Request' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Forbidden' },
        409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Conflict' }
    }
});

app.openapi(createMemberRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { email, firstName, lastName, role } = c.req.valid('json');

    const { UsageService } = await import('../services/pricing');
    const us = new UsageService(db, tenant.id);
    if (!(await us.checkLimit('students', tenant.tier || 'launch'))) return c.json({ error: "Limit reached", code: "LIMIT_REACHED" }, 403);

    let u = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!u) {
        const uid = crypto.randomUUID();
        await db.insert(users).values({ id: uid, email, profile: { firstName, lastName }, createdAt: new Date() }).run();
        u = await db.query.users.findFirst({ where: eq(users.id, uid) });
    }
    if (!u) return c.json({ error: "User error" }, 500) as any;

    const exists = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, u.id), eq(tenantMembers.tenantId, tenant.id)) });
    if (exists) return c.json({ error: 'Exists' }, 409);

    const mid = crypto.randomUUID();
    const token = !u.lastActiveAt ? crypto.randomUUID() : null;
    await db.insert(tenantMembers).values({ id: mid, tenantId: tenant.id, userId: u.id, status: token ? 'inactive' : 'active', joinedAt: new Date(), profile: { firstName, lastName }, settings: token ? { invitationToken: token } : {} }).run();

    const assigned = (c.get('can')('manage_staff') && role === 'instructor') ? 'instructor' : 'student';
    if (assigned === 'instructor' && !(await us.checkLimit('instructors', tenant.tier || 'launch'))) {
        await db.delete(tenantMembers).where(eq(tenantMembers.id, mid)).run();
        return c.json({ error: "Inst limit", code: "LIMIT_REACHED" }, 403);
    }
    await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: assigned }).run();

    c.executionCtx.waitUntil((async () => {
        try {
            const es = c.get('email');
            if (token) {
                await es.sendInvitation(email, `${c.req.header('origin')}/login?email=${encodeURIComponent(email)}&token=${token}`);
            }
            await es.syncContact(email, firstName, lastName);
            const { AutomationsService } = await import('../services/automations');
            const { SmsService } = await import('../services/sms');
            const { PushService } = await import('../services/push');
            const ps = new PushService(db, tenant.id);
            const as = new AutomationsService(db, tenant.id, es, new SmsService(tenant.twilioCredentials as any, c.env, us, db, tenant.id), ps);
            await as.dispatchTrigger('new_student', { userId: u!.id, email: u!.email, firstName, data: { memberId: mid } });
        } catch (e) { console.error(e); }
    })());

    return c.json({ success: true, memberId: mid }, 200);
});

// DELETE /members/:id
const deleteMemberRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['Members'],
    summary: 'Archive a member',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: SuccessResponseSchema } }, description: 'Archived' },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Bad Request' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' }
    }
});

app.openapi(deleteMemberRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const mid = c.req.valid('param').id;
    const m = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, c.get('tenant')!.id)) });
    if (!m) return c.json({ error: 'Not found' }, 404);
    if (m.userId === c.get('auth').userId) return c.json({ error: 'Self' }, 400);

    await db.update(tenantMembers).set({ status: 'archived' }).where(eq(tenantMembers.id, mid)).run();
    await db.delete(tenantRoles).where(eq(tenantRoles.memberId, mid)).run();
    return c.json({ success: true }, 200);
});

// POST /members/accept-invite
const acceptInviteRoute = createRoute({
    method: 'post',
    path: '/accept-invite',
    tags: ['Members'],
    summary: 'Accept an invitation',
    request: {
        body: {
            content: { 'application/json': { schema: z.object({ token: z.string() }) } }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), tenantId: z.string() }) } }, description: 'Accepted' },
        401: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid token' },
        409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Already joined' }
    }
});

app.openapi(acceptInviteRoute, async (c) => {
    const db = createDb(c.env.DB);
    const { token } = c.req.valid('json');
    const auth = c.get('auth');
    if (!auth?.userId || !token) return c.json({ error: "Unauthorized/Missing" }, 401);

    const pending = (await db.select().from(tenantMembers).where(sql`json_extract(settings, '$.invitationToken') = ${token}`).limit(1))[0];
    if (!pending) return c.json({ error: "Invalid" }, 404);

    const exists = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, pending.tenantId)) });
    if (exists) return c.json({ error: "Exists" }, 409);

    const s = (pending.settings as any) || {}; delete s.invitationToken;
    await db.update(tenantMembers).set({ userId: auth.userId, status: 'active', settings: s }).where(eq(tenantMembers.id, pending.id)).run();
    return c.json({ success: true, tenantId: pending.tenantId }, 200);
});

// GET /me/bookings
const getMyBookingsRoute = createRoute({
    method: 'get',
    path: '/me/bookings',
    tags: ['Members'],
    summary: 'Get current member bookings',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ bookings: z.array(z.any()) }) } }, description: 'List of bookings' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not a member' }
    }
});

app.openapi(getMyBookingsRoute, async (c) => {
    const member = c.get('member');
    if (!member) return c.json({ error: 'Not a member' }, 404);
    const db = createDb(c.env.DB);
    const list = await db.query.bookings.findMany({ where: eq(bookings.memberId, member.id), with: { class: { with: { location: true, instructor: { with: { user: true } } } } }, orderBy: [desc(bookings.createdAt)] });
    return c.json({ bookings: list as any[] }, 200);
});

// GET /me
const getMeRoute = createRoute({
    method: 'get',
    path: '/me',
    tags: ['Members'],
    summary: 'Get current member details',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ member: z.any() }) } }, description: 'Member details' }, // Relaxed schema
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not a member' }
    }
});

app.openapi(getMeRoute, async (c) => {
    const member = await createDb(c.env.DB).query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, c.get('auth').userId), eq(tenantMembers.tenantId, c.get('tenant')!.id)), with: { roles: true, user: true } });
    if (!member) return c.json({ error: 'Not a member' }, 404);

    const result = {
        ...member,
        joinedAt: member.joinedAt ? new Date(member.joinedAt).toISOString() : undefined
    };

    return c.json({ member: result as any }, 200);
});

// PATCH /me/settings
const updateMySettingsRoute = createRoute({
    method: 'patch',
    path: '/me/settings',
    tags: ['Members'],
    summary: 'Update current member settings',
    request: {
        body: {
            content: { 'application/json': { schema: SettingsSchema } }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), settings: SettingsSchema }) } }, description: 'Updated' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not a member' }
    }
});

app.openapi(updateMySettingsRoute, async (c) => {
    const member = c.get('member');
    if (!member) return c.json({ error: 'Not a member' }, 404);
    const db = createDb(c.env.DB);
    const body = c.req.valid('json');
    const currentSettings = (member.settings as Record<string, any>) || {};
    const currentNotifications = (currentSettings.notifications as Record<string, any>) || {};
    const bodyNotifications = (body.notifications as Record<string, any>) || {};

    const s = {
        ...currentSettings,
        ...body,
        notifications: {
            ...currentNotifications,
            ...bodyNotifications
        }
    };
    await db.update(tenantMembers).set({ settings: s }).where(eq(tenantMembers.id, member.id)).run();
    return c.json({ success: true, settings: s }, 200);
});

// PATCH /members/:id/role
const updateMemberRoleRoute = createRoute({
    method: 'patch',
    path: '/{id}/role',
    tags: ['Members'],
    summary: 'Update member role',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: { 'application/json': { schema: z.object({ role: z.string() }) } }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: SuccessResponseSchema } }, description: 'Role updated' },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Bad Request / Self' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized / Limit' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' }
    }
});

app.openapi(updateMemberRoleRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { role } = c.req.valid('json');
    const mid = c.req.valid('param').id;
    const m = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, c.get('tenant')!.id)) });
    if (!m) return c.json({ error: 'Not found' }, 404);
    if (m.userId === c.get('auth').userId) return c.json({ error: 'Self' }, 400);

    await db.delete(tenantRoles).where(eq(tenantRoles.memberId, mid)).run();
    if (role === 'instructor') {
        const { UsageService } = await import('../services/pricing');
        if (!(await new UsageService(db, c.get('tenant')!.id).checkLimit('instructors', c.get('tenant')!.tier || 'launch'))) return c.json({ error: "Limit", code: "LIMIT_REACHED" }, 403);
    }
    await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: role as any }).run();
    return c.json({ success: true }, 200);
});

// GET /members/:id
const getMemberRoute = createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Members'],
    summary: 'Get member details',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ member: z.any() }) } }, description: 'Member details' }, // Schema could be tighter
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' }
    }
});

app.openapi(getMemberRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const m = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.id, c.req.valid('param').id), eq(tenantMembers.tenantId, c.get('tenant')!.id)), with: { user: true, roles: true, memberships: { with: { plan: true } }, purchasedPacks: { with: { definition: true }, orderBy: [desc(purchasedPacks.createdAt)] }, bookings: { with: { class: true }, orderBy: [desc(bookings.createdAt)], limit: 20 }, waiverSignatures: { with: { template: true }, orderBy: [desc(waiverSignatures.signedAt)] } } });
    if (!m) return c.json({ error: 'Not found' }, 404);
    return c.json({ member: m }, 200);
});

// GET /members/:id/notes
const getMemberNotesRoute = createRoute({
    method: 'get',
    path: '/{id}/notes',
    tags: ['Members'],
    summary: 'Get member notes',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ notes: z.array(z.any()) }) } }, description: 'Notes' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(getMemberNotesRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const list = await db.query.studentNotes.findMany({ where: eq(studentNotes.studentId, c.req.valid('param').id), orderBy: [desc(studentNotes.createdAt)], with: { author: { with: { user: true } } } });
    return c.json({ notes: list as any[] }, 200);
});

// POST /members/:id/notes
const createMemberNoteRoute = createRoute({
    method: 'post',
    path: '/{id}/notes',
    tags: ['Members'],
    summary: 'Create member note',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: { 'application/json': { schema: z.object({ note: z.string() }) } }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ note: z.any() }) } }, description: 'Note created' }, // Schema could be tighter
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Author error' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(createMemberNoteRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const author = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, c.get('auth').userId), eq(tenantMembers.tenantId, c.get('tenant')!.id)) });
    if (!author) return c.json({ error: 'Author error' }, 400);
    const { note } = c.req.valid('json');
    const id = crypto.randomUUID();
    await db.insert(studentNotes).values({ id, studentId: c.req.valid('param').id, authorId: author.id, note, tenantId: c.get('tenant')!.id, createdAt: new Date() }).run();
    return c.json({ note: { id, note } }, 200);
});

// PATCH /members/:id/status
const updateMemberStatusRoute = createRoute({
    method: 'patch',
    path: '/{id}/status',
    tags: ['Members'],
    summary: 'Update member status',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: { 'application/json': { schema: z.object({ status: z.string() }) } }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), status: z.string() }) } }, description: 'Status updated' },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Self modification' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(updateMemberStatusRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const mid = c.req.valid('param').id;
    // Check self
    const me = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, c.get('auth').userId), eq(tenantMembers.tenantId, c.get('tenant')!.id)) });
    if (mid === me?.id) return c.json({ error: 'Self' }, 400);

    const { status } = c.req.valid('json');
    await db.update(tenantMembers).set({ status: status as any }).where(and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, c.get('tenant')!.id))).run();
    return c.json({ success: true, status }, 200);
});

// POST /members/bulk
const bulkMemberActionRoute = createRoute({
    method: 'post',
    path: '/bulk',
    tags: ['Members'],
    summary: 'Bulk member actions',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        action: z.string(),
                        memberIds: z.array(z.string()),
                        data: z.any()
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), affected: z.number() }) } }, description: 'Action complete' },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Some not found' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(bulkMemberActionRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { action, memberIds, data } = c.req.valid('json');
    const list = await db.select().from(tenantMembers).where(and(inArray(tenantMembers.id, memberIds), eq(tenantMembers.tenantId, c.get('tenant')!.id))).all();
    if (list.length !== memberIds.length) return c.json({ error: 'Some not found' }, 400);

    if (action === 'status') {
        await db.update(tenantMembers).set({ status: data.status }).where(inArray(tenantMembers.id, memberIds)).run();
        return c.json({ success: true, affected: list.length }, 200);
    }
    // ... other actions
    return c.json({ success: true, affected: list.length }, 200);
});

export default app;
