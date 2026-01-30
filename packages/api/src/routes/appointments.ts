import { Hono } from 'hono';
import { createDb } from '../db';
import { appointmentServices, availabilities, appointments, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, gte, lte, lt, gt, inArray, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /services - List Services (Public)
app.get('/services', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const services = await db.select().from(appointmentServices)
        .where(and(eq(appointmentServices.tenantId, tenant.id), eq(appointmentServices.isActive, true))).all();

    return c.json({ services });
});

// POST /services - Create Service (Admin)
app.post('/services', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: "Unauthorized" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant required" }, 400);

    const body = await c.req.json();
    const id = crypto.randomUUID();

    await db.insert(appointmentServices).values({
        id, tenantId: tenant.id, title: body.title, description: body.description,
        durationMinutes: body.durationMinutes, price: body.price, currency: body.currency, isActive: true
    }).run();

    return c.json({ id });
});

// PUT /services/:id
app.put('/services/:id', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: "Unauthorized" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant required" }, 400);
    const serviceId = c.req.param('id');

    const existing = await db.select().from(appointmentServices).where(and(eq(appointmentServices.id, serviceId), eq(appointmentServices.tenantId, tenant.id))).get();
    if (!existing) return c.json({ error: "Service not found" }, 404);

    const body = await c.req.json();
    await db.update(appointmentServices).set({
        title: body.title ?? existing.title, description: body.description ?? existing.description,
        durationMinutes: body.durationMinutes ?? existing.durationMinutes,
        price: body.price ?? existing.price, currency: body.currency ?? existing.currency,
        isActive: body.isActive ?? existing.isActive
    }).where(eq(appointmentServices.id, serviceId)).run();

    return c.json({ success: true });
});

// DELETE /services/:id
app.delete('/services/:id', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: "Unauthorized" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant required" }, 400);
    const serviceId = c.req.param('id');

    const existing = await db.select().from(appointmentServices).where(and(eq(appointmentServices.id, serviceId), eq(appointmentServices.tenantId, tenant.id))).get();
    if (!existing) return c.json({ error: "Service not found" }, 404);

    await db.update(appointmentServices).set({ isActive: false }).where(eq(appointmentServices.id, serviceId)).run();
    return c.json({ success: true });
});

// GET /availability - Public Slot Search
app.get('/availability', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant missing" }, 400);
    const { serviceId, instructorId, date } = c.req.query();

    if (!serviceId || !date) return c.json({ error: "Missing serviceId or date" }, 400);

    const service = await db.select().from(appointmentServices).where(eq(appointmentServices.id, serviceId)).get();
    if (!service) return c.json({ error: "Service not found" }, 404);

    const durationMs = service.durationMinutes * 60 * 1000;
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    let availQuery = db.select().from(availabilities).where(and(eq(availabilities.tenantId, tenant.id), eq(availabilities.dayOfWeek, dayOfWeek)));
    if (instructorId) availQuery = db.select().from(availabilities).where(and(eq(availabilities.tenantId, tenant.id), eq(availabilities.dayOfWeek, dayOfWeek), eq(availabilities.instructorId, instructorId)));

    const availableWindows = await availQuery.all();
    if (availableWindows.length === 0) return c.json({ slots: [] });

    const instructorIds = [...new Set(availableWindows.map(w => w.instructorId))];
    const instructors = await db.select({
        id: tenantMembers.id, firstName: sql<string>`json_extract(${users.profile}, '$.firstName')`, lastName: sql<string>`json_extract(${users.profile}, '$.lastName')`
    })
        .from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).where(inArray(tenantMembers.id, instructorIds)).all();

    const instructorMap = new Map(instructors.map(i => [i.id, `${i.firstName} ${i.lastName || ''}`.trim()]));
    const slots: any[] = [];
    const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await db.select().from(appointments).where(and(eq(appointments.tenantId, tenant.id), gte(appointments.startTime, dayStart), lte(appointments.endTime, dayEnd), eq(appointments.status, 'confirmed'))).all();

    for (const win of availableWindows) {
        const [sh, sm] = win.startTime.split(':').map(Number);
        const [eh, em] = win.endTime.split(':').map(Number);
        const winStart = new Date(targetDate); winStart.setHours(sh, sm, 0, 0);
        const winEnd = new Date(targetDate); winEnd.setHours(eh, em, 0, 0);

        let curr = new Date(winStart);
        while (curr.getTime() + durationMs <= winEnd.getTime()) {
            const slotEnd = new Date(curr.getTime() + durationMs);
            const isBlocked = existingAppointments.some(appt => appt.instructorId === win.instructorId && (curr < new Date(appt.endTime) && slotEnd > new Date(appt.startTime)));

            if (!isBlocked) {
                slots.push({
                    startTime: curr.toISOString(), endTime: slotEnd.toISOString(),
                    instructorId: win.instructorId, instructorName: instructorMap.get(win.instructorId) || 'Instructor'
                });
            }
            curr = new Date(curr.getTime() + 30 * 60 * 1000);
        }
    }
    return c.json({ slots });
});

// POST /availability - Set Availability (Instructor)
app.post('/availability', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
        // Permission: Can only set for self unless has manage_classes
        if (item.instructorId && item.instructorId !== member.id && !c.get('can')('manage_classes')) {
            return c.json({ error: "Unauthorized to set for others" }, 403);
        }
        const instId = item.instructorId || member.id;
        await db.insert(availabilities).values({
            id: crypto.randomUUID(), tenantId: tenant!.id, instructorId: instId,
            dayOfWeek: item.dayOfWeek, startTime: item.startTime, endTime: item.endTime
        }).run();
    }
    return c.json({ success: true });
});

// GET /availability/settings
app.get('/availability/settings', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const list = await db.select().from(availabilities).where(and(eq(availabilities.tenantId, tenant!.id), eq(availabilities.instructorId, member.id))).all();
    return c.json({ availabilities: list });
});

// GET /me - List My Appointments
app.get('/me', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const list = await db.query.appointments.findMany({
        where: eq(appointments.memberId, member.id),
        with: { service: true, instructor: { with: { user: { columns: { profile: true } } } } },
        orderBy: (a, { desc }) => [desc(a.startTime)]
    });
    return c.json({ appointments: list });
});

// GET / - List for Week (Admin/Staff)
app.get('/', async (c) => {
    if (!c.get('can')('view_classes')) return c.json({ error: "Access Denied" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { weekStart } = c.req.query();
    if (!weekStart) return c.json({ error: 'weekStart required' }, 400);

    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 7);

    const results = await db.query.appointments.findMany({
        where: and(eq(appointments.tenantId, tenant!.id), gte(appointments.startTime, start), lt(appointments.startTime, end)),
        with: { service: true, member: { with: { user: { columns: { profile: true, email: true } } } }, instructor: { with: { user: { columns: { profile: true } } } } }
    });
    return c.json(results);
});

// POST / - Book
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { serviceId, instructorId, memberId, startTime, notes } = body;

    let actingMember = c.get('member');
    if (!actingMember) actingMember = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant!.id)) });
    if (!actingMember) return c.json({ error: "Member context missing" }, 403);

    const targetMemberId = memberId || actingMember.id;
    if (targetMemberId !== actingMember.id && !c.get('can')('manage_classes')) {
        return c.json({ error: "Cannot book for others" }, 403);
    }

    const service = await db.select().from(appointmentServices).where(eq(appointmentServices.id, serviceId)).get();
    if (!service) return c.json({ error: "Invalid Service" }, 400);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

    const conflict = await db.select().from(appointments).where(and(eq(appointments.instructorId, instructorId), eq(appointments.status, 'confirmed'), lt(appointments.startTime, end), gt(appointments.endTime, start))).get();
    if (conflict) return c.json({ error: "Slot taken" }, 409);

    const id = crypto.randomUUID();
    await db.insert(appointments).values({ id, tenantId: tenant!.id, serviceId, instructorId, memberId: targetMemberId, startTime: start, endTime: end, notes, status: 'confirmed' }).run();

    if (tenant!.googleCalendarCredentials) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { GoogleCalendarService } = await import('../services/google-calendar');
                const { EncryptionUtils } = await import('../utils/encryption');
                const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
                const creds = tenant!.googleCalendarCredentials as any;
                const token = await encryption.decrypt(creds.accessToken);
                const g = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, '');
                const event = await g.createEvent(token, 'primary', { summary: `Appt: ${service.title}`, description: `Client: ${actingMember!.profile && typeof actingMember!.profile === 'string' ? JSON.parse(actingMember!.profile).firstName : actingMember!.profile?.firstName}\nNotes: ${notes || ''}`, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } });
                if (event.id) await db.update(appointments).set({ googleEventId: event.id }).where(eq(appointments.id, id)).run();
            } catch (e) { console.error(e); }
        })());
    }
    return c.json({ id, status: 'confirmed' }, 201);
});

// PATCH /:id
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: "Unauthorized" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const { status } = await c.req.json();

    if (!['confirmed', 'cancelled', 'completed'].includes(status)) return c.json({ error: "Invalid status" }, 400);

    await db.update(appointments).set({ status }).where(and(eq(appointments.id, id), eq(appointments.tenantId, tenant!.id))).run();
    return c.json({ success: true });
});

export default app;
