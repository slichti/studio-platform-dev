import { Hono } from 'hono';
import { createDb } from '../db';
import { classes, bookings, tenantMembers, users, progressMetricDefinitions } from '@studio/db/src/schema'; // Added progressMetricDefinitions
import { eq, and, inArray } from 'drizzle-orm';
import { HonoContext } from '../types';
import { BookingService } from '../services/bookings';

const app = new Hono<HonoContext>();

// POST /:id/book
app.post('/:id/book', async (c) => {
    const db = createDb(c.env.DB);
    const cid = c.req.param('id');
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Auth required' }, 401);
    const tid = c.get('tenant')!.id;
    const body = await c.req.json().catch(() => ({}));
    const { attendanceType = 'in_person', memberId: targetId } = body;

    let mem = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tid)) });
    if (!mem && !targetId) {
        const mid = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: mid, tenantId: tid, userId: auth.userId });
        mem = { id: mid } as any;
    }
    const mid = targetId || mem?.id;
    if (!mid) return c.json({ error: 'Member required' }, 400);

    const service = new BookingService(db, c.env);
    try {
        const result = await service.createBooking(cid, mid, attendanceType);
        return c.json(result, 201);
    } catch (e: any) {
        if (e.message === 'Class is full') return c.json({ error: 'Class is full', code: 'CLASS_FULL' }, 409);
        return c.json({ error: e.message }, 500);
    }
});

// GET /:id/bookings
app.get('/:id/bookings', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
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
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { checkedIn } = await c.req.json();
    await db.update(bookings).set({ checkedInAt: checkedIn ? new Date() : null }).where(eq(bookings.id, c.req.param('bookingId'))).run();

    // Auto-Log Progress
    if (checkedIn) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { ProgressService } = await import('../services/progress');
                const auth = c.get('auth');
                const tenantId = c.get('tenant')!.id;
                // Fetch memberId from booking
                const booking = await db.select().from(bookings).where(eq(bookings.id, c.req.param('bookingId'))).get();
                if (booking) {
                    const ps = new ProgressService(db, tenantId);
                    await ps.logEntry({ memberId: booking.memberId, metricDefinitionId: '', value: 1, source: 'auto', metadata: { bookingId: booking.id }, recordedAt: new Date() })
                        .catch(async () => {
                            // Fallback: Resolve metric name if ID is unknown (Service usually needs name, but logEntry takes ID. Need to look up ID by Name first or use helper)
                            // Refactoring: ProgressService.logEntryByName helper would be better, but let's do it manually for now or update service.
                            // Checking existing Service... it takes { metricDefinitionId }
                            // I need to look up the ID for "Classes Attended" first.
                            const metric = await db.query.progressMetricDefinitions.findFirst({
                                where: and(eq(progressMetricDefinitions.tenantId, tenantId), eq(progressMetricDefinitions.name, 'Classes Attended'))
                            });
                            if (metric) {
                                await ps.logEntry({ memberId: booking.memberId, metricDefinitionId: metric.id, value: 1, source: 'auto', metadata: { bookingId: booking.id }, recordedAt: new Date() });
                            }
                        });
                }
            } catch (e) { console.error("Progress Log Error", e); }
        })());
    }
    return c.json({ success: true });
});

// POST /:id/bulk-check-in
app.post('/:id/bulk-check-in', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { bookingIds, checkedIn } = await c.req.json();
    if (!bookingIds?.length) return c.json({ error: "Missing IDs" }, 400);
    await db.update(bookings).set({ checkedInAt: checkedIn ? new Date() : null }).where(inArray(bookings.id, bookingIds)).run();

    // Auto-Log Bulk
    if (checkedIn) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { ProgressService } = await import('../services/progress');
                const tenantId = c.get('tenant')!.id;
                const ps = new ProgressService(db, tenantId);
                // Resolve Metric ID once
                const metric = await db.query.progressMetricDefinitions.findFirst({
                    where: and(eq(progressMetricDefinitions.tenantId, tenantId), eq(progressMetricDefinitions.name, 'Classes Attended'))
                });
                if (!metric) return;

                const bList = await db.select().from(bookings).where(inArray(bookings.id, bookingIds)).all();
                for (const b of bList) {
                    await ps.logEntry({ memberId: b.memberId, metricDefinitionId: metric.id, value: 1, source: 'auto', metadata: { bookingId: b.id }, recordedAt: new Date() });
                }
            } catch (e) { console.error("Bulk Progress Log Error", e); }
        })());
    }
    return c.json({ success: true, count: bookingIds.length });
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
