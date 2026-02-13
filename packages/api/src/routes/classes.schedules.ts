import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { classes, bookings, classSeries } from '@studio/db/src/schema';
import { eq, sql, desc, and, gte, lte, inArray } from 'drizzle-orm';
import { RRule } from 'rrule';
import { EncryptionUtils } from '../utils/encryption';
import { ZoomService } from '../services/zoom';
import { ConflictService } from '../services/conflicts';
import { cacheMiddleware } from '../middleware/cache';
import { quotaMiddleware } from '../middleware/quota';

const app = createOpenAPIApp<StudioVariables>();

// Schemas
const ClassSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    startTime: z.string().or(z.date()), // API returns string usually, internal is Date
    durationMinutes: z.number(),
    capacity: z.number().nullable().optional(),
    price: z.number(),
    memberPrice: z.number().nullable().optional(),
    instructorId: z.string().nullable().optional(),
    locationId: z.string().nullable().optional(),
    zoomEnabled: z.boolean(),
    status: z.string(),
    // Payroll (Phase 7)
    payrollModel: z.enum(['flat', 'percentage', 'hourly']).optional().nullable(),
    payrollValue: z.number().optional().nullable(),
    // Augmented fields
    bookingCount: z.number().optional(),
    waitlistCount: z.number().optional(),
    instructor: z.any().optional(), // Expand later
    location: z.any().optional()
}).openapi('Class');

export const CreateClassSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    startTime: z.coerce.date(),
    durationMinutes: z.coerce.number().int().positive(),
    capacity: z.coerce.number().int().optional(),
    price: z.coerce.number().min(0).optional(),
    memberPrice: z.coerce.number().min(0).nullable().optional(),
    instructorId: z.string().nullable().optional(),
    locationId: z.union([z.string(), z.null()]).optional().transform(v => v || undefined),
    zoomEnabled: z.coerce.boolean().optional(),
    createZoomMeeting: z.coerce.boolean().optional(), // Match frontend
    allowCredits: z.coerce.boolean().optional(),
    includedPlanIds: z.array(z.string()).optional(),
    payrollModel: z.enum(['flat', 'percentage', 'hourly']).nullable().optional(),
    payrollValue: z.number().nullable().optional(),

    // Recurring Logic
    isRecurring: z.coerce.boolean().optional().default(false),
    recurrenceRule: z.string().optional(),
    recurrenceEnd: z.coerce.date().optional(), // Coerce for flexibility
    minStudents: z.coerce.number().int().optional(),
    autoCancelThreshold: z.coerce.number().int().optional(),
    autoCancelEnabled: z.coerce.boolean().optional(),
    type: z.enum(['class', 'workshop', 'event', 'appointment']).optional().default('class')
});

const UpdateClassSchema = CreateClassSchema.partial();

// Routes

// GET /
app.use('/', cacheMiddleware({ maxAge: 60, staleWhileRevalidate: 300 }));

app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Classes'],
    summary: 'List classes',
    request: {
        query: z.object({
            start: z.string().optional(),
            end: z.string().optional(),
            instructorId: z.string().optional(),
            locationId: z.string().optional(),
            limit: z.coerce.number().int().positive().default(50).optional(),
            offset: z.coerce.number().int().nonnegative().default(0).optional()
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.array(ClassSchema) } }, description: 'List of classes' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { start, end, instructorId, locationId, limit, offset } = c.req.valid('query');

    const conds = [eq(classes.tenantId, tenant.id)];
    if (start) conds.push(gte(classes.startTime, new Date(start)));
    if (end) conds.push(lte(classes.startTime, new Date(end)));
    if (instructorId) conds.push(eq(classes.instructorId, instructorId));
    if (locationId) conds.push(eq(classes.locationId, locationId));

    const results = await db.query.classes.findMany({
        where: and(...conds),
        with: { instructor: { with: { user: true } }, location: true },
        orderBy: [desc(classes.startTime)],
        limit: limit || 100, // Safety fallback
        offset: offset || 0
    });
    if (!results.length) return c.json([]);

    const classIds = results.map(r => r.id);
    const [bc, wc] = await Promise.all([
        db.select({ classId: bookings.classId, c: sql<number>`count(*)` }).from(bookings).where(and(inArray(bookings.classId, classIds), eq(bookings.status, 'confirmed'))).groupBy(bookings.classId).all(),
        db.select({ classId: bookings.classId, c: sql<number>`count(*)` }).from(bookings).where(and(inArray(bookings.classId, classIds), eq(bookings.status, 'waitlisted'))).groupBy(bookings.classId).all()
    ]);
    const bm = new Map(bc.map(b => [b.classId, b.c]));
    const wm = new Map(wc.map(w => [w.classId, w.c]));

    return c.json(results.map(r => ({
        ...r,
        startTime: r.startTime.toISOString(), // Ensure string
        price: (r.price ?? 0) as any as number,
        bookingCount: bm.get(r.id) || 0,
        waitlistCount: wm.get(r.id) || 0,
        zoomEnabled: !!r.zoomEnabled
    })));
});

// GET /:id
app.openapi(createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Classes'],
    summary: 'Get class by ID',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: ClassSchema } }, description: 'Class details' },
        404: { description: 'Not found' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');

    const res = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tenant.id)), with: { instructor: { with: { user: true } }, location: true } });
    if (!res) return c.json({ error: "Not found" }, 404);

    const [bc, wc] = await Promise.all([
        db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, res.id), eq(bookings.status, 'confirmed'))).get(),
        db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, res.id), eq(bookings.status, 'waitlisted'))).get()
    ]);

    return c.json({
        ...res,
        startTime: res.startTime.toISOString(), // Ensure string
        bookingCount: bc?.c || 0,
        waitlistCount: wc?.c || 0
    });
});

// POST /
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Classes'],
    summary: 'Create class',
    request: {
        body: { content: { 'application/json': { schema: CreateClassSchema } } }
    },
    responses: {
        201: { content: { 'application/json': { schema: ClassSchema } }, description: 'Class created' },
        400: { content: { 'application/json': { schema: z.object({ error: z.string(), details: z.any() }) } }, description: 'Invalid input' },
        409: { description: 'Conflict' },
        403: { description: 'Unauthorized' },
        402: { description: 'Quota Exceeded' }
    }
}), async (c) => {
    // [DIAGNOSTIC] Log Zod errors
    const reqBody = await c.req.json().catch(() => ({}));
    const parseResult = CreateClassSchema.safeParse(reqBody);
    if (!parseResult.success) {
        console.error(`[CLASSES API 400] Validation failed:`, parseResult.error.format());
        return c.json({ error: 'Invalid input', details: parseResult.error.format(), received: reqBody }, 400);
    }

    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    // Quota Enforcement
    const { UsageService } = await import('../services/pricing');
    const us = new UsageService(db, tenant.id);
    const canCreate = await us.checkLimit('classesPerWeek', tenant.tier || 'launch');
    if (!canCreate) {
        return c.json({
            error: `Quota Exceeded: Your plan limit for classes per week has been reached.`,
            code: 'QUOTA_EXCEEDED',
            tier: tenant.tier || 'launch'
        }, 402);
    }

    const body = c.req.valid('json');
    const { title, startTime, durationMinutes, instructorId, locationId, zoomEnabled, createZoomMeeting, isRecurring, recurrenceRule, recurrenceEnd } = body;

    const cs = new ConflictService(db);
    const start = new Date(startTime);
    const dur = durationMinutes;

    if (instructorId && (await cs.checkInstructorConflict(instructorId, start, dur)).length) return c.json({ error: "Instructor conflict" }, 409);
    if (locationId && (await cs.checkRoomConflict(locationId, start, dur)).length) return c.json({ error: "Location conflict" }, 409);

    let zm = { id: null, url: null, pwd: null };
    const shouldCreateZoom = createZoomMeeting || zoomEnabled;

    const createMeeting = async (mTitle: string, mStart: Date) => {
        if (shouldCreateZoom) {
            try {
                const zs = await ZoomService.getForTenant(tenant, c.env, new EncryptionUtils(c.env.ENCRYPTION_SECRET as string));
                if (zs) {
                    const m: any = await zs.createMeeting(mTitle, mStart, dur);
                    return { id: m.id?.toString(), url: m.join_url, pwd: m.password };
                }
            } catch (e) { console.error(e); }
        }
        return { id: null, url: null, pwd: null };
    };

    if (isRecurring && recurrenceRule) {
        const seriesId = crypto.randomUUID();
        await db.insert(classSeries).values({
            id: seriesId,
            tenantId: tenant.id,
            instructorId: instructorId || null,
            locationId: locationId || null,
            title,
            description: body.description,
            durationMinutes: dur,
            price: body.price || 0,
            recurrenceRule,
            validFrom: start,
            validUntil: recurrenceEnd ? new Date(recurrenceEnd) : null,
            createdAt: new Date()
        }).run();

        const ruleStrings = recurrenceRule.split(';');
        const options = RRule.parseString(recurrenceRule);
        options.dtstart = start;
        if (recurrenceEnd) options.until = new Date(recurrenceEnd);

        const rule = new RRule(options);
        const occurrences = rule.all();

        const insertedClasses = [];
        for (const occ of occurrences) {
            const id = crypto.randomUUID();
            const meeting = await createMeeting(title, occ);

            const [nc] = await db.insert(classes).values({
                id,
                tenantId: tenant.id,
                instructorId: instructorId || null,
                locationId,
                seriesId,
                title,
                description: body.description,
                startTime: occ,
                durationMinutes: dur,
                capacity: body.capacity || null,
                price: body.price || 0,
                memberPrice: body.memberPrice || null,
                type: body.type as any,
                minStudents: body.minStudents || 1,
                autoCancelThreshold: body.autoCancelThreshold || null,
                autoCancelEnabled: !!body.autoCancelEnabled,
                allowCredits: body.allowCredits !== false,
                includedPlanIds: body.includedPlanIds || [],
                zoomEnabled: !!zoomEnabled,
                zoomMeetingId: meeting.id,
                zoomMeetingUrl: meeting.url,
                zoomPassword: meeting.pwd,
                status: 'active',
                payrollModel: body.payrollModel || null,
                payrollValue: body.payrollValue || null,
                createdAt: new Date()
            }).returning();
            insertedClasses.push(nc);
        }
        return c.json({ seriesId, classes: insertedClasses.length }, 201);
    } else {
        const id = crypto.randomUUID();
        const meeting = await createMeeting(title, start);

        const [nc] = await db.insert(classes).values({
            id,
            tenantId: tenant.id,
            instructorId: instructorId || null,
            locationId,
            title,
            description: body.description,
            startTime: start,
            durationMinutes: dur,
            capacity: body.capacity || null,
            price: body.price || 0,
            memberPrice: body.memberPrice || null,
            type: body.type as any,
            minStudents: body.minStudents || 1,
            autoCancelThreshold: body.autoCancelThreshold || null,
            autoCancelEnabled: !!body.autoCancelEnabled,
            allowCredits: body.allowCredits !== false,
            includedPlanIds: body.includedPlanIds || [],
            zoomEnabled: !!zoomEnabled,
            zoomMeetingId: meeting.id,
            zoomMeetingUrl: meeting.url,
            zoomPassword: meeting.pwd,
            status: 'active',
            payrollModel: body.payrollModel || null,
            payrollValue: body.payrollValue || null,
            createdAt: new Date()
        }).returning();

        return c.json({ ...nc, startTime: nc.startTime.toISOString() }, 201);
    }
});

// PATCH /:id
app.openapi(createRoute({
    method: 'patch',
    path: '/{id}',
    tags: ['Classes'],
    summary: 'Update class',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: UpdateClassSchema } } }
    },
    responses: {
        200: { description: 'Class updated' },
        404: { description: 'Not found' },
        409: { description: 'Conflict' }
    }
}), async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.get('tenant').id;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const ex = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tid)) });
    if (!ex) return c.json({ error: "Not found" }, 404);

    const up: any = {};
    const keys = ['title', 'description', 'startTime', 'durationMinutes', 'capacity', 'price', 'memberPrice', 'allowCredits', 'includedPlanIds', 'zoomEnabled', 'status', 'instructorId', 'locationId', 'payrollModel', 'payrollValue'];
    // Manual mapping or loop, but since we parsed Validated JSON, we can trust keys
    Object.keys(body).forEach(k => {
        if (keys.includes(k)) {
            // @ts-ignore
            up[k] = (k === 'startTime' && body[k]) ? new Date(body[k]) : body[k];
        }
    });

    if (up.startTime || up.durationMinutes || up.instructorId || up.locationId) {
        const cs = new ConflictService(db);
        if ((up.instructorId || ex.instructorId) && (await cs.checkInstructorConflict(up.instructorId || ex.instructorId!, up.startTime || ex.startTime, up.durationMinutes || ex.durationMinutes, id)).length) return c.json({ error: "Conflict" }, 409);
        // Note: Missing room conflict check in patch? Adding it now for completeness.
        if ((up.locationId || ex.locationId) && (await cs.checkRoomConflict(up.locationId || ex.locationId!, up.startTime || ex.startTime, up.durationMinutes || ex.durationMinutes, id)).length) return c.json({ error: "Location Conflict" }, 409);
    }

    await db.update(classes).set(up).where(eq(classes.id, id)).run();
    return c.json({ success: true });
});

// DELETE /:id
app.openapi(createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['Classes'],
    summary: 'Cancel class',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { description: 'Class cancelled' },
        404: { description: 'Not found' }
    }
}), async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { id } = c.req.valid('param');
    const res = await db.update(classes).set({ status: 'cancelled' }).where(and(eq(classes.id, id), eq(classes.tenantId, c.get('tenant').id))).run();
    if (!res.meta.changes) return c.json({ error: "Not found" }, 404);
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.classId, id)).run();
    return c.json({ success: true });
});

export default app;
