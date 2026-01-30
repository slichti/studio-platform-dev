import { Hono } from 'hono';
import { createDb } from '../db';
import { classes, bookings, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { HonoContext } from '../types';

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

    const cl = await db.select().from(classes).where(eq(classes.id, cid)).get();
    if (!cl) return c.json({ error: 'Class not found' }, 404);

    const bid = crypto.randomUUID();
    await db.insert(bookings).values({ id: bid, classId: cid, memberId: mid, status: 'confirmed', attendanceType, createdAt: new Date() });
    return c.json({ id: bid, status: 'confirmed' }, 201);
});

// GET /:id/bookings
app.get('/:id/bookings', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    return c.json(await db.select({ id: bookings.id, status: bookings.status, memberId: bookings.memberId, checkedInAt: bookings.checkedInAt, user: { id: users.id, email: users.email, profile: users.profile } }).from(bookings).innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id)).where(eq(bookings.classId, c.req.param('id'))).all());
});

// PATCH /:id/bookings/:bookingId/check-in
app.patch('/:id/bookings/:bookingId/check-in', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { checkedIn } = await c.req.json();
    await db.update(bookings).set({ checkedInAt: checkedIn ? new Date() : null }).where(eq(bookings.id, c.req.param('bookingId'))).run();
    return c.json({ success: true });
});

// POST /:id/bulk-check-in
app.post('/:id/bulk-check-in', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { bookingIds, checkedIn } = await c.req.json();
    if (!bookingIds?.length) return c.json({ error: "Missing IDs" }, 400);
    await db.update(bookings).set({ checkedInAt: checkedIn ? new Date() : null }).where(inArray(bookings.id, bookingIds)).run();
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

    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, bid)).run();
    return c.json({ success: true });
});

// POST /:id/waitlist
app.post('/:id/waitlist', async (c) => {
    const db = createDb(c.env.DB);
    const mid = c.get('member')?.id;
    if (!mid) return c.json({ error: 'Member required' }, 403);
    const id = crypto.randomUUID();
    await db.insert(bookings).values({ id, classId: c.req.param('id'), memberId: mid, status: 'waitlisted', createdAt: new Date() });
    return c.json({ id, status: 'waitlisted' }, 201);
});

export default app;
