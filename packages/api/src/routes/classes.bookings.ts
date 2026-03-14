import { Hono } from 'hono';
import { createDb } from '../db';
import { classes, bookings, tenantMembers, users, progressMetricDefinitions, tenantRoles } from '@studio/db/src/schema'; // Added progressMetricDefinitions
import { eq, and, inArray } from 'drizzle-orm';
import { HonoContext } from '../types';
import { BookingService, TagRequiredError } from '../services/bookings';
import { AuditService } from '../services/audit';

const app = new Hono<HonoContext>();

// Booking-on-behalf policy (aligned with POST /bookings): allowed only for self, or when caller has
// manage_classes, or when tenant enables instructorCanManageEnrollments and caller is an instructor.

// POST /:id/book
app.post('/:id/book', async (c) => {
    const db = createDb(c.env.DB);
    const cid = c.req.param('id');
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Auth required' }, 401);
    const tenant = c.get('tenant')!;
    const tid = tenant.id;
    const body = await c.req.json().catch(() => ({}));
    const { attendanceType = 'in_person', memberId: targetId } = body;

    let mem = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tid)) });
    if (!mem && !targetId) {
        const mid = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: mid, tenantId: tid, userId: auth.userId });
        mem = { id: mid } as any;
    }
    let mid = targetId || mem?.id;
    if (!mid) return c.json({ error: 'Member required' }, 400);

    // If booking for another member, enforce on-behalf policy and audit
    if (targetId) {
        const tm = await db.select().from(tenantMembers).where(and(eq(tenantMembers.id, targetId), eq(tenantMembers.tenantId, tid))).get();
        if (!tm) return c.json({ error: 'Target member not found' }, 404);
        if (tm.userId !== auth.userId) {
            const canManageClasses = c.get('can')('manage_classes');
            const allowInstructorEnrollments = (tenant.settings as any)?.classSettings?.instructorCanManageEnrollments === true;
            let isInstructor = false;
            if (allowInstructorEnrollments && mem) {
                const roleRow = await db.select().from(tenantRoles).where(and(eq(tenantRoles.memberId, mem.id), eq(tenantRoles.role, 'instructor'))).get();
                isInstructor = !!roleRow;
            }
            if (!canManageClasses && !(allowInstructorEnrollments && isInstructor)) {
                return c.json({ error: 'Forbidden' }, 403);
            }
            const audit = new AuditService(db);
            await audit.log({
                actorId: auth.userId,
                tenantId: tid,
                action: 'booking.create_on_behalf',
                targetId: tm.id,
                targetType: 'tenant_member',
                details: { classId: cid, targetMemberId: tm.id, attendanceType: attendanceType || 'in_person', via: canManageClasses ? 'manage_classes' : 'instructor_enrollments' },
                ipAddress: c.req.header('CF-Connecting-IP') || undefined
            });
        }
        mid = tm.id;
    }

    const service = new BookingService(db, c.env);
    try {
        const result = await service.createBooking(cid, mid, attendanceType);
        return c.json(result, 201);
    } catch (e: any) {
        if (e instanceof TagRequiredError) return c.json({ error: e.message, code: e.code, requiredTags: e.requiredTags }, 403);
        if (e.message === 'Class is full') return c.json({ error: 'Class is full', code: 'CLASS_FULL' }, 409);
        return c.json({ error: e.message }, 500);
    }
});

// Helper: determine if current user is an instructor for a given class
async function isInstructorForClass(c: any, db: any, classId: string): Promise<boolean> {
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant || !auth?.userId) return false;

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)),
        with: { roles: true }
    });
    if (!member) return false;
    const isInstructorRole = (member.roles || []).some((r: any) => r.role === 'instructor');
    if (!isInstructorRole) return false;

    const cls = await db.select({ instructorId: classes.instructorId }).from(classes)
        .where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))).get();
    if (!cls) return false;
    return cls.instructorId === member.id;
}

// GET /:id/bookings
app.get('/:id/bookings', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const canManage = c.get('can')('manage_classes');
    if (!canManage) {
    const classSettings = (tenant.settings as any)?.classSettings || {};
    const allowInstructorView = classSettings.instructorCanViewRosters === true;
        if (!allowInstructorView) return c.json({ error: 'Unauthorized' }, 403);
        const allowed = await isInstructorForClass(c, db, c.req.param('id'));
        if (!allowed) return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json(await db.select({
        id: bookings.id,
        status: bookings.status,
        memberId: bookings.memberId,
        checkedInAt: bookings.checkedInAt,
        waitlistPosition: bookings.waitlistPosition,
        user: { id: users.id, email: users.email, profile: users.profile }
    })
        .from(bookings)
        .innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(bookings.classId, c.req.param('id')))
        .orderBy(bookings.waitlistPosition, bookings.createdAt) // Default sort
        .all());
});

// PATCH /:id/bookings/:bookingId/check-in
app.patch('/:id/bookings/:bookingId/check-in', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const canManage = c.get('can')('manage_classes');
    if (!canManage) {
    const classSettings = (tenant.settings as any)?.classSettings || {};
    const allowAny = classSettings.instructorCanCheckInAnyClass === true;
    const allowOwn = classSettings.instructorCanManageEnrollments === true;
        if (!allowAny && !allowOwn) return c.json({ error: 'Unauthorized' }, 403);

        let allowed = false;
        if (allowAny) {
            // Any instructor with the instructor role may check in
            const auth = c.get('auth');
            if (auth?.userId) {
                const member = await db.query.tenantMembers.findFirst({
                    where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)),
                    with: { roles: true }
                });
                allowed = !!member && (member.roles || []).some((r: any) => r.role === 'instructor');
            }
        } else if (allowOwn) {
            allowed = await isInstructorForClass(c, db, c.req.param('id'));
        }

        if (!allowed) return c.json({ error: 'Unauthorized' }, 403);
    }

    const { checkedIn } = await c.req.json();
    const service = new BookingService(db, c.env);

    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
        await service.checkIn(c.req.param('bookingId'), !!checkedIn, tenant.id);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /:id/bulk-check-in
app.post('/:id/bulk-check-in', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const canManage = c.get('can')('manage_classes');
    if (!canManage) {
    const classSettings = (tenant.settings as any)?.classSettings || {};
    const allowAny = classSettings.instructorCanCheckInAnyClass === true;
    const allowOwn = classSettings.instructorCanManageEnrollments === true;
        if (!allowAny && !allowOwn) return c.json({ error: 'Unauthorized' }, 403);

        let allowed = false;
        if (allowAny) {
            const auth = c.get('auth');
            if (auth?.userId) {
                const member = await db.query.tenantMembers.findFirst({
                    where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)),
                    with: { roles: true }
                });
                allowed = !!member && (member.roles || []).some((r: any) => r.role === 'instructor');
            }
        } else if (allowOwn) {
            allowed = await isInstructorForClass(c, db, c.req.param('id'));
        }

        if (!allowed) return c.json({ error: 'Unauthorized' }, 403);
    }

    const { bookingIds, checkedIn } = await c.req.json();
    if (!bookingIds?.length) return c.json({ error: "Missing IDs" }, 400);

    const service = new BookingService(db, c.env);
    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

        for (const bid of bookingIds) {
            await service.checkIn(bid, !!checkedIn, tenant.id);
        }
        return c.json({ success: true, count: bookingIds.length });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /:id/check-in-all
app.post('/:id/check-in-all', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { checkedIn } = await c.req.json();
    const service = new BookingService(db, c.env);

    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
        const count = await service.checkInAll(c.req.param('id'), !!checkedIn, tenant.id);
        return c.json({ success: true, affected: count });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /:id/bookings/:bookingId/cancel
app.post('/:id/bookings/:bookingId/cancel', async (c) => {
    const db = createDb(c.env.DB);
    const bid = c.req.param('bookingId');
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Auth required' }, 401);

    const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bid), with: { member: true } });
    if (!b) return c.json({ error: 'Not found' }, 404);
    if (!c.get('can')('manage_classes') && b.member.userId !== auth.userId) return c.json({ error: 'Unauthorized' }, 403);

    const service = new BookingService(db, c.env);
    await service.cancelBooking(bid);
    return c.json({ success: true });
});

// POST /:id/waitlist
app.post('/:id/waitlist', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Auth required' }, 401);
    const tid = c.get('tenant')!.id;
    const cid = c.req.param('id');

    // Member logic (reuse from book, maybe abstract?)
    let mem = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tid)) });
    if (!mem) return c.json({ error: 'Member required' }, 400);

    const service = new BookingService(db, c.env);
    try {
        const result = await service.joinWaitlist(cid, mem.id);
        return c.json(result, 201);
    } catch (e: any) {
        if (e.message === 'Waitlist is full') return c.json({ error: 'Waitlist is full', code: 'WAITLIST_FULL' }, 409);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
