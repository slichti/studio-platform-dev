import { Hono } from 'hono';
import { createDb } from '../db';
import { classes, bookings } from '@studio/db/src/schema';
import { eq, sql, desc, and, gte, lte, inArray } from 'drizzle-orm';
import { EncryptionUtils } from '../utils/encryption';
import { ZoomService } from '../services/zoom';
import { ConflictService } from '../services/conflicts';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { start, end, instructorId, locationId } = c.req.query();
    const conds = [eq(classes.tenantId, tenant.id)];
    if (start) conds.push(gte(classes.startTime, new Date(start)));
    if (end) conds.push(lte(classes.startTime, new Date(end)));
    if (instructorId) conds.push(eq(classes.instructorId, instructorId));
    if (locationId) conds.push(eq(classes.locationId, locationId));

    const results = await db.query.classes.findMany({ where: and(...conds), with: { instructor: { with: { user: true } }, location: true }, orderBy: [desc(classes.startTime)] });
    if (!results.length) return c.json([]);

    const classIds = results.map(r => r.id);
    const [bc, wc] = await Promise.all([
        db.select({ classId: bookings.classId, c: sql<number>`count(*)` }).from(bookings).where(and(inArray(bookings.classId, classIds), eq(bookings.status, 'confirmed'))).groupBy(bookings.classId).all(),
        db.select({ classId: bookings.classId, c: sql<number>`count(*)` }).from(bookings).where(and(inArray(bookings.classId, classIds), eq(bookings.status, 'waitlisted'))).groupBy(bookings.classId).all()
    ]);
    const bm = new Map(bc.map(b => [b.classId, b.c]));
    const wm = new Map(wc.map(w => [w.classId, w.c]));
    return c.json(results.map(r => ({ ...r, bookingCount: bm.get(r.id) || 0, waitlistCount: wm.get(r.id) || 0 })));
});

// GET /:id
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const res = await db.query.classes.findFirst({ where: and(eq(classes.id, c.req.param('id')), eq(classes.tenantId, tenant.id)), with: { instructor: { with: { user: true } }, location: true } });
    if (!res) return c.json({ error: "Not found" }, 404);
    const [bc, wc] = await Promise.all([
        db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, res.id), eq(bookings.status, 'confirmed'))).get(),
        db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, res.id), eq(bookings.status, 'waitlisted'))).get()
    ]);
    return c.json({ ...res, bookingCount: bc?.c || 0, waitlistCount: wc?.c || 0 });
});

// POST /
app.post('/', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const body = await c.req.json();
    const { title, startTime, durationMinutes, instructorId, locationId, zoomEnabled } = body;
    if (!title || !startTime || !durationMinutes) return c.json({ error: "Missing fields" }, 400);

    const cs = new ConflictService(db);
    const start = new Date(startTime);
    const dur = parseInt(durationMinutes);
    if (instructorId && (await cs.checkInstructorConflict(instructorId, start, dur)).length) return c.json({ error: "Instructor conflict" }, 409);
    if (locationId && (await cs.checkRoomConflict(locationId, start, dur)).length) return c.json({ error: "Location conflict" }, 409);

    const id = crypto.randomUUID();
    let zm = { id: null, url: null, pwd: null };
    if (zoomEnabled) {
        try {
            const zs = await ZoomService.getForTenant(tenant, c.env, new EncryptionUtils(c.env.ENCRYPTION_SECRET));
            if (zs) {
                const m: any = await zs.createMeeting(title, start, dur);
                zm = { id: m.id?.toString(), url: m.join_url, pwd: m.password };
            }
        } catch (e) { console.error(e); }
    }

    const [nc] = await db.insert(classes).values({ id, tenantId: tenant.id, instructorId, locationId, title, description: body.description, startTime: start, durationMinutes: dur, capacity: body.capacity ? parseInt(body.capacity) : null, price: body.price ? parseInt(body.price) : 0, memberPrice: body.memberPrice ? parseInt(body.memberPrice) : null, type: 'class', allowCredits: body.allowCredits !== false, includedPlanIds: body.includedPlanIds || [], zoomEnabled: !!zoomEnabled, zoomMeetingId: zm.id, zoomMeetingUrl: zm.url, zoomPassword: zm.pwd, status: 'active', createdAt: new Date() }).returning();
    return c.json(nc, 201);
});

// PATCH /:id
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.get('tenant')!.id;
    const cid = c.req.param('id');
    const body = await c.req.json();
    const ex = await db.query.classes.findFirst({ where: and(eq(classes.id, cid), eq(classes.tenantId, tid)) });
    if (!ex) return c.json({ error: "Not found" }, 404);

    const up: any = {};
    const keys = ['title', 'description', 'startTime', 'durationMinutes', 'capacity', 'price', 'memberPrice', 'allowCredits', 'includedPlanIds', 'zoomEnabled', 'status', 'instructorId', 'locationId'];
    for (const k of keys) if (body[k] !== undefined) up[k] = (['price', 'memberPrice', 'durationMinutes', 'capacity'].includes(k) && body[k] !== null) ? parseInt(body[k]) : (k === 'startTime' ? new Date(body[k]) : body[k]);

    if (up.startTime || up.durationMinutes || up.instructorId || up.locationId) {
        const cs = new ConflictService(db);
        if ((up.instructorId || ex.instructorId) && (await cs.checkInstructorConflict(up.instructorId || ex.instructorId!, up.startTime || ex.startTime, up.durationMinutes || ex.durationMinutes, cid)).length) return c.json({ error: "Conflict" }, 409);
    }

    await db.update(classes).set(up).where(eq(classes.id, cid)).run();
    return c.json({ success: true });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const cid = c.req.param('id');
    const res = await db.update(classes).set({ status: 'cancelled' }).where(and(eq(classes.id, cid), eq(classes.tenantId, c.get('tenant')!.id))).run();
    if (!res.meta.changes) return c.json({ error: "Not found" }, 404);
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.classId, cid)).run();
    return c.json({ success: true });
});

export default app;
