import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, classes, tenantMembers, users, tenants, tenantRoles } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { checkAndPromoteWaitlist } from './waitlist';
import { HonoContext } from '../types';
import { BookingService } from '../services/bookings';
import { ConflictService } from '../services/conflicts';

const app = new Hono<HonoContext>();

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
app.post('/', async (c) => {
    const json = await c.req.json();
    const { classId, attendanceType, memberId } = json;
    console.log(`[DEBUG] POST /bookings - Class: ${classId}, AuthUser: ${c.get('auth')?.userId}, Tenant: ${c.get('tenant')?.id}`);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    let targetId = memberId;

    // Resolve Target Member (Self or Family)
    if (!targetId) {
        // Default to self
        let m = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, c.get('auth')!.userId), eq(tenantMembers.tenantId, tenant.id))).get();

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
                m = { id: newMemberId };
            } catch (e) {
                // Ignore race condition if already created
                m = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, c.get('auth')!.userId), eq(tenantMembers.tenantId, tenant.id))).get();
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
                m = { id: newMemberId };
            } else {
                return c.json({ error: "Member not found" }, 403);
            }
        }
        targetId = m!.id;
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
        console.error("Booking Error:", e);
        return c.json({ error: e.message || "Booking failed" }, 400);
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
