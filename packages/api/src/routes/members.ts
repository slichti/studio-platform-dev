import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '../db';
import { eq, and, or, desc, sql, inArray, lte } from 'drizzle-orm';
import { tenantMembers, tenantRoles, studentNotes, users, classes, bookings, tenants, marketingAutomations, emailLogs, coupons, couponRedemptions, automationLogs, purchasedPacks, waiverSignatures, posOrders, subscriptions, tenantInvitations } from '@studio/db/src/schema';
import { HonoContext } from '../types';
import { quotaMiddleware } from '../middleware/quota';

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
    invitedAt: z.string().or(z.date()).optional(),
    acceptedAt: z.string().or(z.date()).optional(),
    user: MemberUserSchema,
    roles: z.array(MemberRoleSchema).optional(),
    customFields: z.record(z.string(), z.any()).optional()
}).openapi('Member');

const MemberListResponse = z.object({
    members: z.array(MemberSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number()
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
            q: z.string().optional().openapi({ description: 'Search query' }),
            role: z.string().optional().openapi({ description: 'Filter by role' }),
            status: z.string().optional().openapi({ description: 'Filter by status' }),
            limit: z.coerce.number().int().positive().default(50).optional(),
            offset: z.coerce.number().int().nonnegative().default(0).optional()
        })
    },
    responses: {
        200: {
            content: { 'application/json': { schema: MemberListResponse } },
            description: 'List of members'
        },
        400: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Tenant context required'
        },
        403: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Unauthorized'
        },
        500: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
});

app.openapi(listMembersRoute, async (c) => {
    try {
        const can = c.get('can');
        if (typeof can !== 'function' || !can('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
        const db = createDb(c.env.DB);
        const { q, role, status, limit = 50, offset = 0 } = c.req.valid('query');

        const conds = [eq(tenantMembers.tenantId, tenant.id)];
        if (status && status !== 'all') {
            conds.push(eq(tenantMembers.status, status as any));
        }
        let whereClause = and(...conds);

        if (q) {
            const searchPattern = `%${q.toLowerCase()}%`;
            whereClause = and(
                whereClause,
                or(
                    sql`lower(${users.email}) LIKE ${searchPattern}`,
                    sql`lower(json_extract(${users.profile}, '$.firstName')) LIKE ${searchPattern}`,
                    sql`lower(json_extract(${users.profile}, '$.lastName')) LIKE ${searchPattern}`
                )
            );
        }

        const query = db.select({
            // Explicit columns only (avoids missing columns in DBs before migrations 0077/0080)
            member: {
                id: tenantMembers.id,
                tenantId: tenantMembers.tenantId,
                userId: tenantMembers.userId,
                profile: tenantMembers.profile,
                settings: tenantMembers.settings,
                customFields: tenantMembers.customFields,
                status: tenantMembers.status,
                joinedAt: tenantMembers.joinedAt,
            },
            user: {
                id: users.id,
                email: users.email,
                profile: users.profile,
                isPlatformAdmin: users.isPlatformAdmin,
                role: users.role,
            }
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id));

        const countQuery = db.select({ count: sql<number>`count(*)` })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id));

        let finalWhere = whereClause;
        let finalQuery = query;
        let finalCountQuery = countQuery;

        if (role) {
            finalQuery = finalQuery.innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id));
            finalCountQuery = finalCountQuery.innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id));
            finalWhere = and(finalWhere, eq(tenantRoles.role, role as any));
        }

        const [list, countRes] = await Promise.all([
            finalQuery
                .where(finalWhere)
                .orderBy(desc(tenantMembers.joinedAt))
                .limit(limit)
                .offset(offset)
                .all(),
            finalCountQuery
                .where(finalWhere)
                .get()
        ]);

        const membersList = list;
        const totalCount = Number((countRes as any)?.count ?? 0);

        // Fetch roles for all members in the list
        const memberIds = membersList.map(m => m.member.id);
        const allRoles = memberIds.length > 0
            ? await db.select().from(tenantRoles).where(inArray(tenantRoles.memberId, memberIds)).all()
            : [];

        const result = membersList
            .filter((row: any) => !row.user?.isPlatformAdmin)
            .map((row: any) => {
                const memberRoles = allRoles.filter(r => r.memberId === row.member.id).map(r => ({ role: r.role }));
                return {
                    ...row.member,
                    user: row.user,
                    roles: memberRoles,
                    joinedAt: row.member.joinedAt ? new Date(row.member.joinedAt).toISOString() : undefined
                };
            });

        return c.json({
            members: result,
            total: totalCount,
            limit,
            offset
        }, 200);
    } catch (err: any) {
        console.error('[Members] GET / list error:', err?.message ?? err, err?.stack);
        return c.json({ error: err?.message ?? 'Failed to load members' }, 500);
    }
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

    // Quota Check
    const { UsageService } = await import('../services/pricing');
    const us = new UsageService(db, tenant.id);
    if (!(await us.checkLimit('students', tenant.tier || 'launch'))) {
        return c.json({
            error: `Quota Exceeded: Your plan limit for students has been reached.`,
            code: 'QUOTA_EXCEEDED'
        }, 402);
    }

    const { email, firstName, lastName, role } = c.req.valid('json');

    let u = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!u) {
        const uid = crypto.randomUUID();
        await db.insert(users).values({ id: uid, email, profile: { firstName, lastName }, createdAt: new Date() }).run();
        u = await db.query.users.findFirst({ where: eq(users.id, uid) });
    }
    if (!u) return c.json({ error: "User error" }, 500) as any;

    if (u.isPlatformAdmin) {
        return c.json({
            error: "Platform Admin",
            code: "PLATFORM_ADMIN_EXISTS",
            message: "This user is a Platform Admin and cannot be added as a member."
        }, 409);
    }

    const exists = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, u.id), eq(tenantMembers.tenantId, tenant.id)) });
    if (exists) {
        if (exists.status === 'archived') {
            return c.json({
                error: "Exists (Archived)",
                code: "TENANT_MEMBER_ARCHIVED",
                message: "This user is archived. Please reactivate them from the members list."
            }, 409);
        }
        return c.json({
            error: "Exists",
            code: "TENANT_MEMBER_EXISTS",
            message: "This user is already a member of this studio."
        }, 409);
    }

    const mid = crypto.randomUUID();
    const token = !u.lastActiveAt ? crypto.randomUUID() : null;
    await db.insert(tenantMembers).values({ id: mid, tenantId: tenant.id, userId: u.id, status: 'active', joinedAt: new Date(), profile: { firstName, lastName }, settings: token ? { invitationToken: token } : {} }).run();

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
                const webBase = c.env.WEB_APP_URL || c.req.header('origin') || 'https://studio-platform-dev.slichti.org';
                const inviteUrl = `${String(webBase).replace(/\/$/, '')}/accept-invite?token=${token}`;
                await es.sendInvitation(email, inviteUrl);
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

    // Flow 1: Token in tenant_members.settings (create-member invite)
    let pending = (await db.select().from(tenantMembers).where(sql`json_extract(settings, '$.invitationToken') = ${token}`).limit(1))[0];

    // Flow 2: Token in tenant_invitations (resend invite)
    if (!pending) {
        const inv = await db.query.tenantInvitations.findFirst({
            where: eq(tenantInvitations.token, token),
            columns: { tenantId: true, email: true, id: true }
        });
        if (inv) {
            const user = await db.query.users.findFirst({ where: eq(users.id, auth.userId), columns: { email: true } });
            const emailMatch = user?.email && String(user.email).toLowerCase() === String(inv.email).toLowerCase();
            const existing = await db.query.tenantMembers.findFirst({
                where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, inv.tenantId))
            });
            if (existing) {
                await db.update(tenantInvitations).set({ acceptedAt: new Date() }).where(eq(tenantInvitations.id, inv.id)).run();
                return c.json({ success: true, tenantId: inv.tenantId }, 200);
            }
            if (emailMatch) {
                const mid = crypto.randomUUID();
                await db.insert(tenantMembers).values({
                    id: mid,
                    tenantId: inv.tenantId,
                    userId: auth.userId,
                    status: 'active',
                    joinedAt: new Date(),
                    profile: {},
                    invitedAt: new Date(),
                    acceptedAt: new Date()
                }).run();
                await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: 'student' }).run();
                await db.update(tenantInvitations).set({ acceptedAt: new Date() }).where(eq(tenantInvitations.id, inv.id)).run();
                return c.json({ success: true, tenantId: inv.tenantId }, 200);
            }
        }
        return c.json({ error: "Invalid" }, 404);
    }

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

// GET /me/packs — student's purchased class packs with remaining credits
app.get('/me/packs', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) {
        const auth = c.get('auth');
        if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
        const tenant = c.get('tenant')!;
        const found = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
        if (!found) return c.json({ error: 'Not a member' }, 404);
        const packs = await db.query.purchasedPacks.findMany({
            where: and(eq(purchasedPacks.memberId, found.id)),
            with: { definition: true },
            orderBy: [desc(purchasedPacks.createdAt)],
        });
        return c.json(packs);
    }
    const packs = await db.query.purchasedPacks.findMany({
        where: eq(purchasedPacks.memberId, member.id),
        with: { definition: true },
        orderBy: [desc(purchasedPacks.createdAt)],
    });
    return c.json(packs);
});

// GET /me/streak — current and longest attendance streak (for StreakCard / mobile)
app.get('/me/streak', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    let memberId: string;
    if (member) {
        memberId = member.id;
    } else {
        const auth = c.get('auth');
        if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
        const tenant = c.get('tenant')!;
        const found = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
        if (!found) return c.json({ error: 'Not a member' }, 404);
        memberId = found.id;
    }

    const now = new Date();
    const pastBookings = await db.select({ startTime: classes.startTime })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(bookings.memberId, memberId),
            eq(bookings.status, 'confirmed'),
            lte(classes.startTime, now)
        ))
        .all();

    const dateSet = new Set<string>();
    for (const row of pastBookings) {
        const d = new Date(row.startTime);
        dateSet.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
    }
    const sortedDates = Array.from(dateSet).sort();

    const oneDay = 24 * 60 * 60 * 1000;
    const toDate = (s: string) => new Date(s + 'T12:00:00Z').getTime();

    let currentStreak = 0;
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const yesterdayStr = new Date(now.getTime() - oneDay).toISOString().slice(0, 10);
    if (dateSet.has(todayStr) || dateSet.has(yesterdayStr)) {
        const start = dateSet.has(todayStr) ? todayStr : yesterdayStr;
        let t = toDate(start);
        while (dateSet.has(new Date(t).toISOString().slice(0, 10))) {
            currentStreak++;
            t -= oneDay;
        }
    }

    let longestStreak = 0;
    let run = 1;
    for (let i = 1; i < sortedDates.length; i++) {
        if (toDate(sortedDates[i]) === toDate(sortedDates[i - 1]) + oneDay) run++;
        else { longestStreak = Math.max(longestStreak, run); run = 1; }
    }
    longestStreak = Math.max(longestStreak, run, currentStreak);

    return c.json({ currentStreak, longestStreak });
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
    const tenant = c.get('tenant')!;
    const memberId = c.req.valid('param').id;

    const m = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id)),
        with: {
            user: true,
            roles: true,
            memberships: { with: { plan: true } },
            purchasedPacks: { with: { definition: true }, orderBy: [desc(purchasedPacks.createdAt)] },
            bookings: { with: { class: true }, orderBy: [desc(bookings.createdAt)], limit: 20 },
            waiverSignatures: { with: { template: true }, orderBy: [desc(waiverSignatures.signedAt)] },
            communityTopics: { with: { topic: true } }
        }
    });

    if (!m) return c.json({ error: 'Not found' }, 404);

    // Also get all topics they have access to via rules (courses, plans, etc.)
    const { CommunityService } = await import('../services/community');
    const cs = new CommunityService(db);
    const visibleTopics = await cs.getVisibleTopics(tenant.id, m.id, false);

    return c.json({
        member: {
            ...m,
            visibleCommunityTopics: visibleTopics
        }
    }, 200);
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
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Member not found' },
        500: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Internal Server Error' }
    }
});

app.openapi(getMemberNotesRoute, async (c) => {
    try {
        if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
        const db = createDb(c.env.DB);
        const tenant = c.get('tenant')!;
        const memberId = c.req.valid('param').id;

        // Ensure the member exists within the current tenant
        const member = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.id, memberId),
                eq(tenantMembers.tenantId, tenant.id)
            ),
            columns: { id: true }
        });
        if (!member) return c.json({ error: 'Member not found' }, 404);

        // Scope notes to both the member and tenant for isolation
        const list = await db.query.studentNotes.findMany({
            where: and(
                eq(studentNotes.studentId, memberId),
                eq(studentNotes.tenantId, tenant.id)
            ),
            orderBy: [desc(studentNotes.createdAt)],
            with: { author: { with: { user: true } } }
        });
        return c.json({ notes: list as any[] }, 200);
    } catch (e) {
        console.error('[API] Error fetching member notes:', e);
        return c.json({ error: 'Internal Server Error', details: (e as any).message }, 500);
    }
});

// GET /members/:id/coupons
const getMemberCouponsRoute = createRoute({
    method: 'get',
    path: '/{id}/coupons',
    tags: ['Members'],
    summary: 'Get member coupons',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        coupons: z.array(z.object({
                            id: z.string(),
                            code: z.string(),
                            type: z.enum(['percent', 'amount']),
                            value: z.number(),
                            active: z.boolean().nullable(),
                            expiresAt: z.string().nullable().or(z.date().nullable()),
                            redeemedAt: z.string().nullable().or(z.date().nullable()),
                            orderId: z.string().nullable()
                        }))
                    })
                }
            },
            description: 'Coupons'
        },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Member not found' },
        500: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Internal Server Error' }
    }
});

app.openapi(getMemberCouponsRoute, async (c) => {
    try {
        if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
        const db = createDb(c.env.DB);
        const mid = c.req.valid('param').id;

        const member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, c.get('tenant')!.id))
        });

        if (!member) return c.json({ error: 'Member not found' }, 404);

        const list = await db.select({
            redemption: couponRedemptions,
            coupon: coupons
        })
            .from(couponRedemptions)
            .innerJoin(coupons, eq(couponRedemptions.couponId, coupons.id))
            .where(and(
                eq(couponRedemptions.userId, member.userId),
                eq(couponRedemptions.tenantId, c.get('tenant')!.id)
            ))
            .orderBy(desc(couponRedemptions.redeemedAt));

        const result = list.map(item => ({
            ...item.coupon,
            redeemedAt: item.redemption.redeemedAt,
            orderId: item.redemption.orderId
        }));

        return c.json({ coupons: result }, 200);
    } catch (e) {
        console.error('[API] Error fetching member coupons:', e);
        return c.json({ error: 'Internal Server Error', details: (e as any).message }, 500);
    }
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
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Member not found' }
    }
});

app.openapi(createMemberNoteRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const author = await db.query.tenantMembers.findFirst({
        where: and(
            eq(tenantMembers.userId, c.get('auth').userId),
            eq(tenantMembers.tenantId, tenant.id)
        )
    });
    if (!author) return c.json({ error: 'Author error' }, 400);
    const memberId = c.req.valid('param').id;
    const member = await db.query.tenantMembers.findFirst({
        where: and(
            eq(tenantMembers.id, memberId),
            eq(tenantMembers.tenantId, tenant.id)
        ),
        columns: { id: true }
    });
    if (!member) return c.json({ error: 'Member not found' }, 404);

    const { note } = c.req.valid('json');
    const id = crypto.randomUUID();
    await db.insert(studentNotes).values({
        id,
        studentId: memberId,
        authorId: author.id,
        note,
        tenantId: tenant.id,
        createdAt: new Date()
    }).run();
    return c.json({ note: { id, note } }, 200);
});

// PATCH /members/:id/notes/:noteId
const updateMemberNoteRoute = createRoute({
    method: 'patch',
    path: '/{id}/notes/{noteId}',
    tags: ['Members'],
    summary: 'Update member note',
    request: {
        params: z.object({ id: z.string(), noteId: z.string() }),
        body: {
            content: { 'application/json': { schema: z.object({ note: z.string() }) } }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Note updated' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Note not found' }
    }
});

app.openapi(updateMemberNoteRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { noteId } = c.req.valid('param');
    const { note } = c.req.valid('json');

    const existing = await db.query.studentNotes.findFirst({
        where: and(
            eq(studentNotes.id, noteId),
            eq(studentNotes.tenantId, tenant.id)
        )
    });
    if (!existing) return c.json({ error: 'Note not found' }, 404);

    await db.update(studentNotes)
        .set({ note })
        .where(and(
            eq(studentNotes.id, noteId),
            eq(studentNotes.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true }, 200);
});

// DELETE /members/:id/notes/:noteId
const deleteMemberNoteRoute = createRoute({
    method: 'delete',
    path: '/{id}/notes/{noteId}',
    tags: ['Members'],
    summary: 'Delete member note',
    request: {
        params: z.object({ id: z.string(), noteId: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Note deleted' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Note not found' }
    }
});

app.openapi(deleteMemberNoteRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { noteId } = c.req.valid('param');

    const existing = await db.query.studentNotes.findFirst({
        where: and(
            eq(studentNotes.id, noteId),
            eq(studentNotes.tenantId, tenant.id)
        )
    });
    if (!existing) return c.json({ error: 'Note not found' }, 404);

    await db.delete(studentNotes)
        .where(and(
            eq(studentNotes.id, noteId),
            eq(studentNotes.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true }, 200);
});

// POST /members/:id/resend-invitation-email
const resendInvitationEmailRoute = createRoute({
    method: 'post',
    path: '/{id}/resend-invitation-email',
    tags: ['Members'],
    summary: 'Resend invitation email',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Invitation resent' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Member not found' }
    }
});

app.openapi(resendInvitationEmailRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403) as any;
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const mid = c.req.valid('param').id;

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });

    if (!member) return c.json({ error: 'Member not found' }, 404) as any;

    // 1. Get/Create Invitation
    let invite = await db.query.tenantInvitations.findFirst({
        where: and(
            eq(tenantInvitations.tenantId, tenant.id),
            // Invitations always store lower-cased email; match on lower-case to avoid uniqueness conflicts.
            eq(tenantInvitations.email, member.user.email.toLowerCase())
        )
    });

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (!invite) {
        await db.insert(tenantInvitations).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            email: member.user.email.toLowerCase(),
            role: 'student',
            token,
            expiresAt,
            invitedBy: c.get('auth').userId,
        }).run();
    } else {
        await db.update(tenantInvitations)
            .set({ token, expiresAt, createdAt: new Date() })
            .where(eq(tenantInvitations.id, invite.id))
            .run();
    }

    // 2. Update member invitedAt
    await db.update(tenantMembers).set({ invitedAt: new Date() }).where(eq(tenantMembers.id, mid)).run();

    // 3. Send Email
    const { EmailService } = await import('../services/email');
    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(db, tenant.id);
    const apiKey = c.env.RESEND_API_KEY || '';
    const emailService = new EmailService(apiKey, {}, { name: tenant.name }, usageService, false, db, tenant.id);
    const webBase = c.env.WEB_APP_URL || 'https://studio-platform-dev.slichti.org';
    const inviteUrl = `${webBase.replace(/\/$/, '')}/accept-invite?token=${token}`;

    await emailService.sendInvitation(member.user.email, inviteUrl);

    return c.json({ success: true }, 200) as any;
});

// POST /members/:id/email - one-off direct email from studio to member
const sendMemberEmailRoute = createRoute({
    method: 'post',
    path: '/{id}/email',
    tags: ['Members'],
    summary: 'Send a direct email to a member',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        subject: z.string().min(1),
                        body: z.string().min(1)
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: SuccessResponseSchema } }, description: 'Email sent' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Member not found' }
    }
});

app.openapi(sendMemberEmailRoute, async (c) => {
    // Require member or marketing permissions
    if (!c.get('can')('manage_members') && !c.get('can')('manage_marketing')) {
        return c.json({ error: 'Unauthorized' }, 403) as any;
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const mid = c.req.valid('param').id;
    const { subject, body } = c.req.valid('json');

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });

    if (!member || !member.user?.email) {
        return c.json({ error: 'Member or email not found' }, 404) as any;
    }

    const { EmailService } = await import('../services/email');
    const { UsageService } = await import('../services/pricing');

    const usageService = new UsageService(db, tenant.id);
    const apiKey = c.env.RESEND_API_KEY || '';
    const emailService = new EmailService(apiKey, {}, { name: tenant.name }, usageService, false, db, tenant.id);

    // Simple HTML wrapper for the message body
    const htmlBody = `<p>${body.replace(/\n/g, '<br/>')}</p>`;

    await emailService.sendGenericEmail(
        member.user.email,
        subject,
        htmlBody,
        true
    );

    return c.json({ success: true }, 200) as any;
});

// POST /members/:id/resend-invitation-sms
const resendInvitationSmsRoute = createRoute({
    method: 'post',
    path: '/{id}/resend-invitation-sms',
    tags: ['Members'],
    summary: 'Resend invitation SMS',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Invitation resent' },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Phone number missing' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Member not found' }
    }
});

app.openapi(resendInvitationSmsRoute, async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403) as any;
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const mid = c.req.valid('param').id;

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });

    if (!member) return c.json({ error: 'Member not found' }, 404) as any;
    const profile = member.user.profile as any;
    const phone = ((member.user.profile as any)?.phoneNumber || (member.user as any).phone) as string | undefined;
    if (!phone) return c.json({ error: 'Member phone number not found' }, 400) as any;

    // 1. Get/Create Invitation
    let invite = await db.query.tenantInvitations.findFirst({
        where: and(
            eq(tenantInvitations.tenantId, tenant.id),
            eq(tenantInvitations.email, member.user.email.toLowerCase())
        )
    });

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (!invite) {
        await db.insert(tenantInvitations).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            email: member.user.email.toLowerCase(),
            role: 'student',
            token,
            expiresAt,
            invitedBy: c.get('auth').userId,
        }).run();
    } else {
        await db.update(tenantInvitations)
            .set({ token, expiresAt, createdAt: new Date() })
            .where(eq(tenantInvitations.id, invite.id))
            .run();
    }

    // 2. Update member invitedAt
    await db.update(tenantMembers).set({ invitedAt: new Date() }).where(eq(tenantMembers.id, mid)).run();

    // 3. Send SMS
    const { SmsService } = await import('../services/sms');
    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(db, tenant.id);
    const smsService = new SmsService(undefined, c.env, usageService, db, tenant.id);
    const webBase = c.env.WEB_APP_URL || 'https://studio-platform-dev.slichti.org';
    const inviteUrl = `${webBase.replace(/\/$/, '')}/accept-invite?token=${token}`;

    await smsService.sendInvitation(phone, tenant.name, inviteUrl);

    return c.json({ success: true }, 200) as any;
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

// GET /members/:id/communications - Communication history (emails + automations)
app.get('/:id/communications', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const memberId = c.req.param('id');

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });
    if (!member) return c.json({ error: 'Not found' }, 404);

    // Email logs sent to this member
    const emails = await db.select()
        .from(emailLogs)
        .where(and(
            eq(emailLogs.tenantId, tenant.id),
            eq(emailLogs.recipientEmail, member.user.email)
        ))
        .orderBy(desc(emailLogs.sentAt))
        .limit(50)
        .all();

    // Automation logs for this member
    const automations = await db.select({
        log: automationLogs,
        automation: marketingAutomations
    })
        .from(automationLogs)
        .leftJoin(marketingAutomations, eq(automationLogs.automationId, marketingAutomations.id))
        .where(and(
            eq(automationLogs.tenantId, tenant.id),
            eq(automationLogs.userId, member.userId)
        ))
        .orderBy(desc(automationLogs.triggeredAt))
        .limit(50)
        .all();

    const timeline = [
        ...emails.map(e => ({
            type: 'email' as const,
            date: e.sentAt,
            subject: e.subject,
            status: e.status,
            templateId: e.templateId,
            campaignId: e.campaignId
        })),
        ...automations.map(a => ({
            type: 'automation' as const,
            date: a.log.triggeredAt,
            channel: a.log.channel,
            automationName: (a.automation?.metadata as any)?.name || a.automation?.triggerEvent || 'Unknown',
            stepIndex: a.log.stepIndex,
            openedAt: a.log.openedAt,
            clickedAt: a.log.clickedAt
        }))
    ].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db2 = b.date ? new Date(b.date).getTime() : 0;
        return db2 - da;
    });

    return c.json({ communications: timeline });
});

// GET /members/:id/purchases - Purchase timeline (packs + POS + subscriptions)
app.get('/:id/purchases', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const memberId = c.req.param('id');

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });
    if (!member) return c.json({ error: 'Not found' }, 404);

    // Purchased packs
    const packs = await db.query.purchasedPacks.findMany({
        where: eq(purchasedPacks.memberId, memberId),
        with: { definition: true },
        orderBy: [desc(purchasedPacks.createdAt)]
    });

    // POS orders
    const pos = await db.select()
        .from(posOrders)
        .where(and(
            eq(posOrders.tenantId, tenant.id),
            eq(posOrders.memberId, memberId)
        ))
        .orderBy(desc(posOrders.createdAt))
        .limit(50)
        .all();

    // Subscriptions
    const subs = await db.query.subscriptions.findMany({
        where: and(
            eq(subscriptions.tenantId, tenant.id),
            eq(subscriptions.memberId, memberId)
        ),
        with: { plan: true },
        orderBy: [desc(subscriptions.createdAt)]
    });

    const timeline = [
        ...packs.map(p => ({
            type: 'pack' as const,
            date: p.createdAt,
            name: (p as any).definition?.name || 'Class Pack',
            amount: p.price ? p.price / 100 : 0,
            creditsRemaining: p.remainingCredits,
            creditsTotal: (p as any).definition?.classCount || p.remainingCredits
        })),
        ...pos.map(o => ({
            type: 'pos' as const,
            date: o.createdAt,
            items: (o as any).items || [],
            amount: (o.totalAmount || 0) / 100,
            status: o.status
        })),
        ...subs.map(s => ({
            type: 'subscription' as const,
            date: s.createdAt,
            status: s.status,
            tier: s.tier,
            planId: s.planId,
            planName: (s as any).plan?.name,
            interval: (s as any).plan?.interval,
            amount: (s as any).plan?.price ? (s as any).plan.price / 100 : 0,
            currentPeriodEnd: s.currentPeriodEnd,
            canceledAt: s.canceledAt
        }))
    ].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db2 = b.date ? new Date(b.date).getTime() : 0;
        return db2 - da;
    });

    return c.json({ purchases: timeline });
});

export default app;
