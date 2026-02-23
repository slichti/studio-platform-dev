import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, classes, tenantMembers, users, tenants, tenantRoles } from '@studio/db/src/schema';
import { eq, and, sql, inArray, lt, desc } from 'drizzle-orm';
import { checkAndPromoteWaitlist } from './waitlist';
import { WebhookService } from '../services/webhooks';
import { HonoContext } from '../types';
import { BookingService } from '../services/bookings';
import { ConflictService } from '../services/conflicts';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const app = new Hono<HonoContext>();

// Stricter rate limits for booking mutations (abuse control)
const bookingLimit = rateLimitMiddleware({ limit: 20, window: 60, keyPrefix: 'booking' });

// GET /my-upcoming
app.get('/my-upcoming', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const auth = c.get('auth')!;
    const member = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!member) return c.json({ error: "Member not found" }, 403);

    const list = await db.query.bookings.findMany({ where: eq(bookings.memberId, member.id), with: { class: { with: { instructor: { with: { user: true } } } } }, limit: 50, orderBy: [sql`${bookings.createdAt} desc`] });
    return c.json(list.map(b => ({
        id: b.id,
        status: b.status,
        waitlistPosition: b.waitlistPosition,
        attendanceType: b.attendanceType,
        class: {
            id: b.class.id,
            title: b.class.title,
            startTime: b.class.startTime,
            instructor: (b.class.instructor?.user?.profile as any)?.firstName || "Staff",
            zoomMeetingUrl: b.class.zoomMeetingUrl,
            zoomPassword: b.class.zoomPassword
        }
    })).sort((a, b) => new Date(a.class.startTime).getTime() - new Date(b.class.startTime).getTime()));
});

// POST /waitlist — join the waitlist for a full class
app.post('/waitlist', bookingLimit, async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const auth = c.get('auth')!;
    const { classId, attendanceType } = await c.req.json<{ classId: string; attendanceType?: 'in_person' | 'zoom' }>();

    if (!classId) return c.json({ error: 'classId required' }, 400);

    const member = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!member) return c.json({ error: 'Not a member of this studio' }, 403);

    const cl = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))).get();
    if (!cl) return c.json({ error: 'Class not found' }, 404);

    const existing = await db.select({ id: bookings.id }).from(bookings).where(
        and(eq(bookings.classId, classId), eq(bookings.memberId, member.id), inArray(bookings.status, ['confirmed', 'waitlisted']))
    ).get();
    if (existing) return c.json({ error: 'Already booked or on waitlist' }, 400);

    // Count current waitlist size to assign next position
    const waitlistCount = await db.select({ c: sql<number>`count(*)` }).from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'waitlisted'))).get();
    const position = ((waitlistCount?.c) || 0) + 1;

    const id = crypto.randomUUID();
    await db.insert(bookings).values({
        id, classId, memberId: member.id,
        status: 'waitlisted',
        waitlistPosition: position,
        attendanceType: attendanceType || 'in_person',
        createdAt: new Date(),
    }).run();

    return c.json({ success: true, id, waitlistPosition: position });
});

// GET /history — past bookings for the current member (paginated)
app.get('/history', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const auth = c.get('auth')!;
    const member = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!member) return c.json({ error: "Member not found" }, 403);

    const limit = Math.min(Number(c.req.query('limit') || 20), 100);
    const offset = Number(c.req.query('offset') || 0);

    const list = await db.select({
        id: bookings.id,
        status: bookings.status,
        attendanceType: bookings.attendanceType,
        checkedInAt: bookings.checkedInAt,
        classId: classes.id,
        classTitle: classes.title,
        classStartTime: classes.startTime,
        classDurationMinutes: classes.durationMinutes,
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(bookings.memberId, member.id),
            lt(classes.startTime, sql`unixepoch()`)
        ))
        .orderBy(desc(classes.startTime))
        .limit(limit)
        .offset(offset)
        .all();

    return c.json(list);
});

// GET /history/export — CSV export of full booking history for the member
app.get('/history/export', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const auth = c.get('auth')!;
    const member = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!member) return c.json({ error: "Member not found" }, 403);

    const list = await db.select({
        id: bookings.id,
        status: bookings.status,
        attendanceType: bookings.attendanceType,
        checkedInAt: bookings.checkedInAt,
        classTitle: classes.title,
        classStartTime: classes.startTime,
        classDurationMinutes: classes.durationMinutes,
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(bookings.memberId, member.id),
            lt(classes.startTime, sql`unixepoch()`)
        ))
        .orderBy(desc(classes.startTime))
        .all() as any[];

    const rows = [
        ["Date", "Time", "Class", "Duration (min)", "Status", "Attendance Type", "Checked In At"],
        ...list.map((b: any) => {
            const start = b.classStartTime instanceof Date ? b.classStartTime : new Date(b.classStartTime * 1000);
            const checkedIn = b.checkedInAt ? (b.checkedInAt instanceof Date ? b.checkedInAt : new Date(b.checkedInAt * 1000)) : null;
            return [
                start.toLocaleDateString("en-US"),
                start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                `"${(b.classTitle || "").replace(/"/g, '""')}"`,
                b.classDurationMinutes ?? "",
                b.status,
                b.attendanceType,
                checkedIn ? checkedIn.toLocaleString("en-US") : "",
            ];
        })
    ];

    const csv = rows.map(r => r.join(",")).join("\n");
    return new Response(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="class-history.csv"`,
        }
    });
});

// GET /:id
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const b = await db.query.bookings.findFirst({
        where: eq(bookings.id, c.req.param('id')),
        with: { class: true }
    });
    if (!b) return c.json({ error: "Not found" }, 404);
    if ((b as any).class?.tenantId !== c.get('tenant')!.id) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const auth = c.get('auth')!;
    const roles = c.get('roles') || [];
    const member = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, c.get('tenant')!.id))).get();

    if (!member) return c.json({ error: "Unauthorized" }, 401);

    // Security: Only the member who booked or someone with manage_classes permission can view the booking
    if (b.memberId !== member.id && !c.get('can')('manage_classes')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    return c.json(b);
});

// POST /
app.post('/', bookingLimit, async (c) => {
    const json = await c.req.json();
    const { classId, attendanceType, memberId } = json;
    console.log(`[DEBUG] POST /bookings - Class: ${classId}, AuthUser: ${c.get('auth')?.userId}, Tenant: ${c.get('tenant')?.id}`);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    let targetId = memberId;

    // Resolve Target Member (Self or Family)
    if (!targetId) {
        // Default to self
        const m = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, c.get('auth')!.userId), eq(tenantMembers.tenantId, tenant.id))).get();

        if (!m && c.get('isPlatformAdmin')) {
            // Auto-create for Platform Admin if missing
            console.log(`[BOOKING] Creating admin member record for ${c.get('auth')!.userId}`);
            const newMemberId = crypto.randomUUID();
            try {
                await db.insert(tenantMembers).values({
                    id: newMemberId,
                    tenantId: tenant.id,
                    userId: c.get('auth')!.userId,
                    status: 'active',
                    joinedAt: new Date()
                }).run();
                await db.insert(tenantRoles).values({
                    id: crypto.randomUUID(),
                    memberId: newMemberId,
                    role: 'owner',
                    createdAt: new Date()
                }).run();
                targetId = newMemberId;
            } catch (e) {
                // Ignore race condition if already created
                const existing = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, c.get('auth')!.userId), eq(tenantMembers.tenantId, tenant.id))).get();
                if (existing) targetId = existing.id;
            }
        } else if (!m) {
            // Auto-join Logic
            const settings = tenant.settings as any;
            if (settings?.enableStudentRegistration) {
                console.log(`[BOOKING] Auto-joining student ${c.get('auth')!.userId}`);
                const newMemberId = crypto.randomUUID();
                await db.insert(tenantMembers).values({
                    id: newMemberId,
                    tenantId: tenant.id,
                    userId: c.get('auth')!.userId,
                    status: 'active',
                    joinedAt: new Date()
                }).run();
                await db.insert(tenantRoles).values({
                    id: crypto.randomUUID(),
                    memberId: newMemberId,
                    role: 'student',
                    createdAt: new Date()
                }).run();
                targetId = newMemberId;

                // Dispatch Webhook
                const webhookService = new WebhookService(db, c.env.SVIX_AUTH_TOKEN as string);
                webhookService.dispatch(tenant.id, 'member.created', {
                    id: newMemberId,
                    userId: c.get('auth')!.userId,
                    role: 'student'
                });
            } else {
                return c.json({ error: "Member not found" }, 403);
            }
        } else {
            targetId = m.id;
        }
    } else {
        // Verify target member belongs to user (Family check)
        // TODO: Strict family check. For now, we trust the ID if it belongs to the tenant, 
        // but ideally we should check if `targetId` is linked to `auth.userId` via family relationship.
        // Assuming the select below verifies existence in tenant.
        const tm = await db.select().from(tenantMembers).where(and(eq(tenantMembers.id, targetId), eq(tenantMembers.tenantId, tenant.id))).get();
        if (!tm) return c.json({ error: "Target member not found" }, 404);
    }

    const cl = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))).get();
    if (!cl) return c.json({ error: "Not found" }, 404);

    // FIX: Check for BOTH confirmed and waitlisted to prevent duplicates
    const existing = await db.select().from(bookings).where(
        and(
            eq(bookings.classId, classId),
            eq(bookings.memberId, targetId),
            inArray(bookings.status, ['confirmed', 'waitlisted'])
        )
    ).all();

    if (existing.length > 0) return c.json({ error: "Already booked or waitlisted" }, 400);

    const count = (await db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed'))).get())?.c || 0;
    if (!cl.zoomEnabled && cl.capacity && count >= cl.capacity) return c.json({ error: "Class is full" }, 400);

    try {
        const { BookingService } = await import('../services/bookings');
        const service = new BookingService(db, c.env);
        const result = await service.createBooking(classId, targetId, attendanceType);
        return c.json({ success: true, id: result.id });
    } catch (e: any) {
        const message = e?.message ?? '';
        const isDbError = message.includes('Failed query') || message.includes('insert into') || message.includes('SQLITE_');
        const safeMessage = isDbError
            ? 'Booking failed. Please try again or contact the studio.'
            : (message || 'Booking failed');
        console.error("Booking Error:", isDbError ? safeMessage : message, e);
        return c.json({
            error: safeMessage,
            ...(isDbError ? { code: 'BOOKING_SERVICE_ERROR' } : {})
        }, 400);
    }
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const bid = c.req.param('id');
    const auth = c.get('auth')!;
    const tenant = c.get('tenant')!;

    const b = await db.query.bookings.findFirst({
        where: eq(bookings.id, bid),
        with: { member: true }
    });
    if (!b) return c.json({ error: "Not found" }, 404);

    if (b.member.userId !== auth.userId && !c.get('can')('manage_classes')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const service = new BookingService(db, c.env as any);
    await service.cancelBooking(bid);
    return c.json({ success: true });
});

// PATCH /:id
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const b = await db.select().from(bookings).where(eq(bookings.id, c.req.param('id'))).get();
    if (!b) return c.json({ error: "Not found" }, 404);

    const auth = c.get('auth')!;
    const member = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, c.get('tenant')!.id))).get();
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    if (b.memberId !== member.id && !c.get('can')('manage_classes')) return c.json({ error: "Forbidden" }, 403);

    const { attendanceType, memberId } = await c.req.json();

    // Check if switching TO Zoom from something else
    const wasZoom = b.attendanceType === 'zoom';
    const isZoom = attendanceType === 'zoom';

    await db.update(bookings).set({ attendanceType }).where(eq(bookings.id, b.id)).run();

    // Trigger email if switching to Zoom
    if (!wasZoom && isZoom) {
        c.executionCtx.waitUntil((async () => {
            const { BookingService } = await import('../services/bookings');
            const service = new BookingService(db, c.env);
            // We use 'class_booked' as it serves as the confirmation email which contains the link
            await service.dispatchAutomation('class_booked', b.id);
        })());
    }

    return c.json({ success: true });
});

export default app;
