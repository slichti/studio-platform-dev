
import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, classes, tenantMembers, users, tenants } from 'db/src/schema'; // Ensure imports
import { eq, and, sql } from 'drizzle-orm';
import { checkAndPromoteWaitlist } from './waitlist';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    auth: {
        userId: string | null;
        claims: any;
    };
    member?: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.use('*', authMiddleware);

// POST / - Create Booking
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const user = c.get('user');

    const body = await c.req.json();
    const { classId, attendanceType, memberId } = body;

    if (!classId) return c.json({ error: "Missing classId" }, 400);

    // 1. Resolve Member
    let targetMemberId;
    if (memberId) {
        // Booking for family member? Verify relationship or permission
        // Simplified: allow if user has access (TODO: strict check)
        targetMemberId = memberId;
    } else {
        // Find existing member for this user
        const member = await db.select().from(tenantMembers)
            .where(and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenant.id)))
            .get();
        if (!member) return c.json({ error: "Must be a member to book" }, 403);
        targetMemberId = member.id;
    }

    // 2. Check Capacity & Existing (and Tenant Ownership of Class)
    const classData = await db.select().from(classes)
        .where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id)))
        .get();

    if (!classData) return c.json({ error: "Class not found" }, 404);

    const existing = await db.select().from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.memberId, targetMemberId), eq(bookings.status, 'confirmed')))
        .get();

    if (existing) return c.json({ error: "Already booked" }, 400);

    // Capacity Check
    const countRes = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
        .get();

    const currentCount = countRes?.count || 0;
    if (!classData.zoomEnabled && classData.capacity && currentCount >= classData.capacity) {
        return c.json({ error: "Class is full" }, 400);
    }

    // 3. Create Booking
    const id = crypto.randomUUID();
    await db.insert(bookings).values({
        id,
        classId,
        memberId: targetMemberId,
        status: 'confirmed',
        attendanceType: attendanceType || 'in_person',
        createdAt: new Date()
    });

    return c.json({ success: true, id });
});

// DELETE /:id - Cancel Booking
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const bookingId = c.req.param('id');

    const booking = await db.select().from(bookings)
        .where(eq(bookings.id, bookingId))
        .get();

    if (!booking) return c.json({ error: "Booking not found" }, 404);

    // Verify Tenant via Class
    const classData = await db.select().from(classes)
        .where(and(eq(classes.id, booking.classId), eq(classes.tenantId, tenant.id)))
        .get();

    if (!classData) return c.json({ error: "Booking not found" }, 404);

    // [SECURITY] Permission Check (Own Booking OR Owner/Admin)
    // 1. Resolve Current Member
    const currentMember = await db.select().from(tenantMembers)
        .where(and(eq(tenantMembers.userId, c.get('auth').userId), eq(tenantMembers.tenantId, tenant.id)))
        .get();

    if (!currentMember) return c.json({ error: "Unauthorized" }, 401);

    const isOwnBooking = booking.memberId === currentMember.id;
    const { tenantRoles } = await import('db/src/schema');
    const roles = await db.select().from(tenantRoles).where(eq(tenantRoles.memberId, currentMember.id)).all();
    const hasPrivilege = roles.some(r => r.role === 'owner' || r.role === 'admin' || r.role === 'instructor'); // Instructors can cancel too? Let's say yes for now.

    if (!isOwnBooking && !hasPrivilege) {
        return c.json({ error: "Forbidden: You can only cancel your own bookings." }, 403);
    }

    await db.delete(bookings)
        .where(eq(bookings.id, bookingId))
        .run();

    // Trigger Auto-Promotion
    c.executionCtx.waitUntil(checkAndPromoteWaitlist(booking.classId, tenant.id, c.env));

    return c.json({ success: true });
});

// PATCH /:id - Switch Attendance
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const bookingId = c.req.param('id');
    const { attendanceType } = await c.req.json();

    const booking = await db.select().from(bookings)
        .where(eq(bookings.id, bookingId))
        .get();

    if (!booking) return c.json({ error: "Not found" }, 404);

    const classData = await db.select().from(classes)
        .where(and(eq(classes.id, booking.classId), eq(classes.tenantId, tenant.id)))
        .get();

    if (!classData) return c.json({ error: "Not found" }, 404);

    // [SECURITY] Permission Check
    const currentMember = await db.select().from(tenantMembers)
        .where(and(eq(tenantMembers.userId, c.get('user').id), eq(tenantMembers.tenantId, tenant.id)))
        .get();

    if (!currentMember) return c.json({ error: "Unauthorized" }, 401);

    // Only Owners/Admins/Instructors can change attendance type for others?
    // Or users can switch their own?
    // Let's allow users to switch their own.
    const isOwnBooking = booking.memberId === currentMember.id;
    // ... fetch roles ...
    const { tenantRoles } = await import('db/src/schema');
    const roles = await db.select().from(tenantRoles).where(eq(tenantRoles.memberId, currentMember.id)).all();
    const hasPrivilege = roles.some(r => r.role === 'owner' || r.role === 'admin' || r.role === 'instructor');

    if (!isOwnBooking && !hasPrivilege) {
        return c.json({ error: "Forbidden" }, 403);
    }

    await db.update(bookings)
        .set({ attendanceType }) // No updatedAt
        .where(eq(bookings.id, bookingId))
        .run();

    return c.json({ success: true });
});

export default app;
