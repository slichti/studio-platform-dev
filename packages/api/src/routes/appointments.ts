import { Hono } from 'hono';
import { createDb } from '../db';
import { appointmentServices, availabilities, appointments, tenantMembers, users, tenants } from 'db/src/schema';
import { eq, and, gte, lte, or, lt, gt, inArray, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ENCRYPTION_SECRET: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
    features: Set<string>;
    isImpersonating?: boolean;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// --- Services ---

// List Services (Public)
app.get('/services', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const services = await db.select().from(appointmentServices)
        .where(
            and(
                eq(appointmentServices.tenantId, tenant.id),
                eq(appointmentServices.isActive, true)
            )
        )
        .all();

    return c.json({ services });
});

// Create Service (Admin) - internal usage for now
app.post('/services', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles');

    if (!roles?.includes('owner') && !roles?.includes('admin')) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    const body = await c.req.json();
    const id = crypto.randomUUID();

    await db.insert(appointmentServices).values({
        id,
        tenantId: tenant.id,
        title: body.title,
        description: body.description,
        durationMinutes: body.durationMinutes,
        price: body.price,
        currency: body.currency,
        isActive: true
    });

    return c.json({ id });
});


// --- Availability ---

// Get Availability for a Service + Instructor (Optional)
app.get('/availability', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const query = c.req.query();

    const serviceId = query.serviceId;
    const instructorId = query.instructorId;
    const dateStr = query.date; // YYYY-MM-DD

    if (!serviceId || !dateStr) return c.json({ error: "Missing serviceId or date" }, 400);

    // 1. Get Service Duration
    const service = await db.select().from(appointmentServices).where(eq(appointmentServices.id, serviceId)).get();
    if (!service) return c.json({ error: "Service not found" }, 404);

    const durationMs = service.durationMinutes * 60 * 1000;
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay(); // 0-6

    // 2. Find Instructors
    // If instructorId provided, check them. Else, check all instructors who have availability for this day
    let availQuery = db.select().from(availabilities)
        .where(and(
            eq(availabilities.tenantId, tenant.id),
            eq(availabilities.dayOfWeek, dayOfWeek)
        ));

    if (instructorId) {
        availQuery = db.select().from(availabilities)
            .where(and(
                eq(availabilities.tenantId, tenant.id),
                eq(availabilities.dayOfWeek, dayOfWeek),
                eq(availabilities.instructorId, instructorId)
            ));
    }

    const availableWindows = await availQuery.all();

    if (availableWindows.length === 0) return c.json({ slots: [] });

    // Fetch Instructor Details
    const instructorIds = [...new Set(availableWindows.map(w => w.instructorId))];
    const instructors = await db.select({
        id: tenantMembers.id,
        firstName: sql<string>`json_extract(${users.profile}, '$.firstName')`,
        lastName: sql<string>`json_extract(${users.profile}, '$.lastName')`
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(inArray(tenantMembers.id, instructorIds))
        .all();

    const instructorMap = new Map(instructors.map(i => [i.id, `${i.firstName} ${i.lastName || ''}`.trim()]));

    // 3. Calculate Slots
    const slots: any[] = [];

    // Check existing appointments for the day to block conflicts
    // Range: Start of day to End of day
    const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await db.select().from(appointments)
        .where(and(
            eq(appointments.tenantId, tenant.id),
            gte(appointments.startTime, dayStart),
            lte(appointments.endTime, dayEnd),
            eq(appointments.status, 'confirmed')
        )).all();

    for (const win of availableWindows) {
        // Parse Window Start/End (HH:MM)
        const [startHour, startMin] = win.startTime.split(':').map(Number);
        const [endHour, endMin] = win.endTime.split(':').map(Number);

        const winStart = new Date(targetDate);
        winStart.setHours(startHour, startMin, 0, 0);

        const winEnd = new Date(targetDate);
        winEnd.setHours(endHour, endMin, 0, 0);

        let curr = new Date(winStart);

        // Generate slots
        while (curr.getTime() + durationMs <= winEnd.getTime()) {
            const slotEnd = new Date(curr.getTime() + durationMs);

            // Conflict Check
            const isBlocked = existingAppointments.some(appt => {
                // Check if same instructor
                if (appt.instructorId !== win.instructorId) return false;

                // Overlap logic: (StartA < EndB) and (EndA > StartB)
                const apptStart = new Date(appt.startTime);
                const apptEnd = new Date(appt.endTime);

                return (curr < apptEnd && slotEnd > apptStart);
            });

            if (!isBlocked) {
                slots.push({
                    startTime: curr.toISOString(),
                    endTime: slotEnd.toISOString(),
                    instructorId: win.instructorId,
                    instructorName: instructorMap.get(win.instructorId) || 'Instructor'
                });
            }

            // Advance by 30 mins or duration? 
            // Usually slots are offered at fixed intervals (e.g. every 15 or 30 mins, or back-to-back)
            // Let's assume 30 minute granularity for start times
            curr = new Date(curr.getTime() + 30 * 60 * 1000);
        }
    }

    return c.json({ slots });
});

// Book Appointment
app.post('/book', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!auth.userId) return c.json({ error: "Unauthorized" }, 401);

    // Find Tenant Member
    let member = c.get('member');
    if (!member) {
        member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, auth.userId!), eq(tenantMembers.tenantId, tenant.id))
        });
        if (!member) return c.json({ error: "Must be a member" }, 403);
    }

    const body = await c.req.json();
    const { serviceId, instructorId, startTime } = body; // startTime ISO string

    // Validate inputs
    const service = await db.select().from(appointmentServices).where(eq(appointmentServices.id, serviceId)).get();
    if (!service) return c.json({ error: "Invalid Service" }, 400);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

    // Double Check Availability (Optimistic locking avoided for MVP, strict check here)
    // See if any overlapping appointment for this instructor
    const conflict = await db.select().from(appointments)
        .where(and(
            eq(appointments.instructorId, instructorId),
            eq(appointments.status, 'confirmed'),
            lt(appointments.startTime, end),
            gt(appointments.endTime, start)
        )).get();

    if (conflict) {
        return c.json({ error: "Slot already taken" }, 409);
    }

    // Create Appointment
    const id = crypto.randomUUID();
    await db.insert(appointments).values({
        id,
        tenantId: tenant.id,
        serviceId,
        instructorId,
        memberId: member.id,
        startTime: start,
        endTime: end,
        status: 'confirmed'
    });


    // Google Calendar Sync
    if (tenant.googleCalendarCredentials) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { GoogleCalendarService } = await import('../services/google-calendar');
                const { EncryptionUtils } = await import('../utils/encryption');
                const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
                const creds = tenant.googleCalendarCredentials as any;
                const accessToken = await encryption.decrypt(creds.accessToken);

                const gService = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, '');

                const event = {
                    summary: `Appointment: ${service.title}`,
                    description: `Client: ${member.profile?.firstName || 'User'}`,
                    start: { dateTime: start.toISOString() },
                    end: { dateTime: end.toISOString() }
                };

                const gEvent = await gService.createEvent(accessToken, 'primary', event);

                if (gEvent.id) {
                    await db.update(appointments)
                        .set({ googleEventId: gEvent.id })
                        .where(eq(appointments.id, id))
                        .run();
                }
            } catch (e: any) {
                console.error("Google Sync Appt Failed", e);
            }
        })());
    }

    return c.json({ id, status: 'confirmed' }, 201);
});

// Set Availability (Instructor)
// Set Availability (Instructor)
app.post('/availability', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const roles = c.get('roles');

    // Verify is Instructor
    if (!member || (!roles?.includes('instructor') && !roles?.includes('owner'))) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    // Expected: { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" } or Array

    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
        const id = crypto.randomUUID();
        await db.insert(availabilities).values({
            id,
            tenantId: tenant.id,
            instructorId: member.id,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime
        });
    }

    return c.json({ success: true });
});

// Get Availability Settings (Instructor)
app.get('/availability/settings', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const inputs = await db.select().from(availabilities).where(
        and(
            eq(availabilities.tenantId, tenant.id),
            eq(availabilities.instructorId, member.id)
        )
    ).all();

    return c.json({ availabilities: inputs });
});

// List My Appointments
app.get('/me', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const myAppointments = await db.query.appointments.findMany({
        where: eq(appointments.memberId, member.id),
        with: {
            service: true,
            instructor: {
                with: { user: { columns: { profile: true } } }
            }
        },
        orderBy: (appointments, { desc }) => [desc(appointments.startTime)]
    });

    return c.json({ appointments: myAppointments });
});

export default app;

// --- CRUD Endpoints matching Front-end ---

// GET / -> List appointments for a week
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const query = c.req.query();
    const weekStart = query.weekStart; // YYYY-MM-DD

    if (!weekStart) return c.json({ error: 'weekStart required' }, 400);

    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    // Fetch appointments
    const results = await db.query.appointments.findMany({
        where: and(
            eq(appointments.tenantId, tenant.id),
            gte(appointments.startTime, start),
            lt(appointments.startTime, end)
        ),
        with: {
            service: true,
            member: {
                with: {
                    user: {
                        columns: {
                            profile: true,
                            email: true
                        }
                    }
                }
            },
            instructor: {
                with: {
                    user: {
                        columns: {
                            profile: true
                        }
                    }
                }
            }
        }
    });

    return c.json(results);
});

// POST / -> Create Appointment (Admin/Instructor or Self)
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!auth.userId) return c.json({ error: "Unauthorized" }, 401);

    const roles = c.get('roles') || [];
    const isStaff = roles.includes('instructor') || roles.includes('owner');

    const body = await c.req.json();
    const { serviceId, instructorId, memberId, startTime, notes } = body;

    // Resolve Acting Member
    let actingMember = c.get('member');
    if (!actingMember) {
        actingMember = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, auth.userId!), eq(tenantMembers.tenantId, tenant.id))
        });
    }

    if (!actingMember) return c.json({ error: "Must be a member" }, 403);

    // Permission Check
    // If setting memberId to someone else, must be staff
    const targetMemberId = memberId || actingMember.id;
    if (targetMemberId !== actingMember.id && !isStaff) {
        return c.json({ error: "Cannot book for others" }, 403);
    }

    // Validate Service
    const service = await db.select().from(appointmentServices).where(eq(appointmentServices.id, serviceId)).get();
    if (!service) return c.json({ error: "Invalid Service" }, 400);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

    // Availability Check (Strict for now)
    const conflict = await db.select().from(appointments)
        .where(and(
            eq(appointments.instructorId, instructorId),
            eq(appointments.status, 'confirmed'),
            lt(appointments.startTime, end),
            gt(appointments.endTime, start)
        )).get();

    if (conflict) {
        return c.json({ error: "Slot already taken" }, 409);
    }

    const id = crypto.randomUUID();
    await db.insert(appointments).values({
        id,
        tenantId: tenant.id,
        serviceId,
        instructorId,
        memberId: targetMemberId,
        startTime: start,
        endTime: end,
        notes,
        status: 'confirmed'
    });


    // Google Calendar Sync
    if (tenant.googleCalendarCredentials) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { GoogleCalendarService } = await import('../services/google-calendar');
                const { EncryptionUtils } = await import('../utils/encryption');
                const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
                const creds = tenant.googleCalendarCredentials as any;
                const accessToken = await encryption.decrypt(creds.accessToken);

                const service = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, '');

                const event = {
                    summary: `Appointment: ${service.title}`, // From scope? No, service variable is 'service' (db row)
                    description: `Client: ${actingMember.profile?.firstName || 'User'}\nNotes: ${notes || ''}`,
                    start: { dateTime: start.toISOString() },
                    end: { dateTime: end.toISOString() }
                };

                const gEvent = await service.createEvent(accessToken, 'primary', event);

                if (gEvent.id) {
                    await db.update(appointments)
                        .set({ googleEventId: gEvent.id })
                        .where(eq(appointments.id, id))
                        .run();
                }
            } catch (e: any) {
                console.error("Google Sync Appt Failed", e);
            }
        })());
    }

    return c.json({ id, status: 'confirmed' }, 201);
});

// PATCH /:id -> Update Status
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const roles = c.get('roles') || [];

    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    const body = await c.req.json();
    const { status } = body;

    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
        return c.json({ error: "Invalid status" }, 400);
    }

    await db.update(appointments)
        .set({ status })
        .where(and(
            eq(appointments.id, id),
            eq(appointments.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true });
});
