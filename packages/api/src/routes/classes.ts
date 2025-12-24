import { Hono } from 'hono';
import { classes, tenants, bookings, tenantMembers, users, tenantRoles, classSeries } from 'db/src/schema';
import { createDb } from '../db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { ZoomService } from '../services/zoom';

type Bindings = {
    DB: D1Database;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
    STRIPE_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    // Assuming tenant middleware sets c.var.tenant, or we filter by query param?
    // Use auth tenant or similar. 
    // The current architecture assumes a tenant-aware middleware or we pass tenantId.
    // For now, let's assume we want all classes for the CURRENT tenant from the URL (which the middleware should handle but we haven't fully linked it to domain decoding yet).
    // Let's rely on a query param `tenantId` for basic testing OR c.var.tenant if available.
    // However, the `studios` implementation doesn't strictly assume we are "inside" a tenant context.
    // Let's use specific tenantId query for now to be explicit, or rely on c.var.tenant if the middleware sets it.

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const query = c.req.query();
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    let conditions = eq(classes.tenantId, tenant.id);

    if (startDate && endDate) {
        conditions = and(
            eq(classes.tenantId, tenant.id),
            gte(classes.startTime, startDate),
            lte(classes.startTime, endDate)
        ) as any;
    }

    const results = await db.select().from(classes).where(conditions);
    return c.json(results);
});

app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member context required' }, 403);
    const userId = c.get('auth').userId;

    // RBAC: Only Instructors or Owners can create classes
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Only instructors or owners can create classes' }, 403);
    }

    const body = await c.req.json();

    // Zod Validation
    const { z } = await import('zod');
    const createClassSchema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startTime: z.string().or(z.date()).pipe(z.coerce.date()), // Handle ISO strings
        durationMinutes: z.number().int().positive(),
        capacity: z.number().int().positive().optional(),
        locationId: z.string().optional(),
        createZoomMeeting: z.boolean().optional(),
        price: z.number().int().nonnegative().optional().default(0),
        currency: z.string().default('usd'),
        recurrenceRule: z.string().optional(), // RRule string
        recurrenceEnd: z.string().or(z.date()).pipe(z.coerce.date()).optional(),
        isRecurring: z.boolean().optional()
    });

    const parseResult = createClassSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }

    const { title, description, startTime, durationMinutes, capacity, locationId, createZoomMeeting, price, currency, recurrenceRule, recurrenceEnd, isRecurring } = parseResult.data;

    // Logic:
    // If isRecurring && recurrenceRule:
    // 1. Create ClassSeries
    // 2. Generate instances via RRule
    // 3. Create Classes linked to Series

    if (isRecurring && recurrenceRule) {
        const { RRule } = await import('rrule');
        const seriesId = crypto.randomUUID();

        // 1. Create Series
        await db.insert(classSeries).values({
            id: seriesId,
            tenantId: tenant.id,
            instructorId: member.id,
            locationId,
            title,
            description,
            durationMinutes,
            price: price,
            currency: currency,
            recurrenceRule,
            validFrom: new Date(startTime),
            validUntil: recurrenceEnd ? new Date(recurrenceEnd) : undefined
        });

        // 2. Generate Instances
        // Parse RRule. Ensure dtstart is set correctly.
        // We need to construct the rule object.
        let ruleOptions;
        try {
            ruleOptions = RRule.parseString(recurrenceRule);
            ruleOptions.dtstart = new Date(startTime);
        } catch (e) {
            return c.json({ error: 'Invalid recurrence rule' }, 400);
        }

        const rule = new RRule(ruleOptions);

        // Limit generation: Either until recurrenceEnd OR 3 months max to prevent infinite
        const limitDate = recurrenceEnd ? new Date(recurrenceEnd) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days default
        const dates = rule.between(new Date(startTime), limitDate, true); // true = include start if matches

        const newClasses = [];

        for (const date of dates) {
            const classId = crypto.randomUUID();
            let zoomUrl = undefined;

            if (createZoomMeeting && c.env.ZOOM_ACCOUNT_ID) {
                // Warning: Creating 50 zoom meetings sequentially will be slow and might rate limit.
                // Ideally this is a background job. For now, let's only create Zoom for the FIRST occurrence 
                // and warn user, OR skip zoom for recurring in this MVP Sync flow?
                // Or just create for first one. 
                // Let's create for the first one only for speed/safety in MVP.
                if (date.getTime() === dates[0].getTime()) {
                    try {
                        const zoom = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET);
                        zoomUrl = await zoom.createMeeting(userId, title, date, durationMinutes);
                    } catch (e) { console.error("Zoom failed", e); }
                }
            }

            // Insert Class
            await db.insert(classes).values({
                id: classId,
                tenantId: tenant.id,
                instructorId: member.id,
                seriesId,
                title,
                description,
                startTime: date,
                durationMinutes,
                capacity,
                locationId,
                zoomMeetingUrl: zoomUrl,
                price: price || 0,
                currency: currency || 'usd'
            });
            newClasses.push({ id: classId, startTime: date });
        }

        return c.json({ message: 'Series created', seriesId, count: newClasses.length }, 201);
    }

    // Single Class Flow
    const id = crypto.randomUUID();
    let zoomMeetingUrl: string | undefined = undefined;

    if (createZoomMeeting && c.env.ZOOM_ACCOUNT_ID) {
        try {
            const zoom = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET);
            zoomMeetingUrl = await zoom.createMeeting(userId, title, new Date(startTime), durationMinutes);
        } catch (e) {
            console.error("Zoom creation failed:", e);
        }
    }

    try {
        await db.insert(classes).values({
            id,
            tenantId: tenant.id,
            instructorId: member.id, // Fixed: Use Tenant Member ID
            title,
            description,
            startTime: new Date(startTime),
            durationMinutes,
            capacity,
            locationId,
            zoomMeetingUrl,
            price: price || 0,
            currency: currency || 'usd'
        });
        return c.json({ id, title, zoomMeetingUrl }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/:id/book', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const auth = c.get('auth');
    if (!auth || !auth.userId) {
        return c.json({ error: 'Authentication required' }, 401);
    }
    const userId = auth.userId;

    // Optional: Check class existence and capacity
    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo) return c.json({ error: 'Class not found' }, 404);

    // Check if already booked
    // const existing = await db.select().from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.userId, userId))).get();
    // if (existing) return c.json({ error: 'Already booked' }, 400);

    const id = crypto.randomUUID();

    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

        // Find or Auto-Join Member
        let member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id))
        });

        if (!member) {
            // Auto-join as Student?
            const memberId = crypto.randomUUID();
            await db.insert(tenantMembers).values({
                id: memberId,
                tenantId: tenant.id,
                userId: userId
            });
            // Add student role
            await db.insert(tenantRoles).values({
                memberId: memberId,
                role: 'student'
            });
            member = { id: memberId } as any;
        }

        await db.insert(bookings).values({
            id,
            classId,
            memberId: member!.id,
            status: 'confirmed'
        });

        return c.json({ id, status: 'confirmed' }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/:id/bookings', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');

    // RBAC: Instructor or Owner only
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        const results = await db.select({
            id: bookings.id,
            status: bookings.status,
            user: {
                id: users.id,
                email: users.email,
                profile: users.profile
            },
            createdAt: bookings.createdAt
        })
            .from(bookings)
            .innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(bookings.classId, classId));

        return c.json(results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
