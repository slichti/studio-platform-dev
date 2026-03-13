import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { classes, bookings, classSeries, classInstructors, classSeriesInstructors, tenantMembers, users } from '@studio/db/src/schema';
import { eq, sql, desc, asc, and, gte, lte, inArray, ne } from 'drizzle-orm';
import { RRule } from 'rrule';
import { EncryptionUtils } from '../utils/encryption';
import { ZoomService } from '../services/zoom';
import { ConflictService } from '../services/conflicts';
import { cacheMiddleware } from '../middleware/cache';
import { quotaMiddleware } from '../middleware/quota';
import { EmailService } from '../services/email';
import { UsageService } from '../services/pricing';
import { getFirstName } from '../utils/profile';

const app = createOpenAPIApp<StudioVariables>();

// Allow recurring classes to generate up to ~3 years of daily occurrences.
const MAX_RECURRENCE_OCCURRENCES = 3 * 365;

/**
 * Adjust RRule-generated UTC dates to preserve the original local time of day.
 * RRule generates dates aligned to the UTC time of dtstart, which causes local
 * times to shift when DST boundaries are crossed. This function corrects each
 * occurrence so the local time stays the same as the original.
 *
 * Example: 6:00 AM EST (UTC-5) = 11:00 UTC. After DST, 11:00 UTC = 7:00 AM EDT.
 * This function adjusts to 10:00 UTC = 6:00 AM EDT.
 */
function adjustForDST(occurrences: Date[], originalDate: Date, timezone: string): Date[] {
    // Get the original local hour and minute using Intl
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric', minute: 'numeric', hour12: false
    });
    const origParts = fmt.formatToParts(originalDate);
    const origHour = parseInt(origParts.find(p => p.type === 'hour')?.value || '0');
    const origMinute = parseInt(origParts.find(p => p.type === 'minute')?.value || '0');

    return occurrences.map(occ => {
        const occParts = fmt.formatToParts(occ);
        const occHour = parseInt(occParts.find(p => p.type === 'hour')?.value || '0');
        const occMinute = parseInt(occParts.find(p => p.type === 'minute')?.value || '0');

        // If local time differs from original, adjust the UTC time
        const hourDiff = origHour - occHour;
        const minDiff = origMinute - occMinute;
        if (hourDiff !== 0 || minDiff !== 0) {
            return new Date(occ.getTime() + (hourDiff * 60 + minDiff) * 60000);
        }
        return occ;
    });
}

async function sendInstructorAssignmentEmail(
    db: ReturnType<typeof createDb>,
    env: any,
    tenant: any,
    primaryInstructorId: string | null | undefined,
    clsTitle: string,
    clsStart: Date,
    duration: number
) {
    if (!primaryInstructorId) return;
    try {
        const tenantSettings = tenant.settings as any;
        const notify = tenantSettings?.notificationSettings?.instructorClassAssignedEmail !== false;
        if (!notify) return;

        const instructor = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, primaryInstructorId), eq(tenantMembers.tenantId, tenant.id)),
            with: { user: true }
        });
        if (!instructor?.user?.email) return;

        const usageService = new UsageService(db, tenant.id);
        const emailService = new EmailService(
            env.RESEND_API_KEY || '',
            { branding: tenant.branding as any, settings: tenant.settings as any },
            { slug: tenant.slug },
            usageService
        );
        const startsAt = clsStart instanceof Date ? clsStart : new Date(clsStart);
        const durationLabel = `${duration} min`;
        const html = `
                <h1 style="margin-bottom: 12px;">New Class Assigned</h1>
                <p>Hi ${getFirstName(instructor.user.profile, 'Instructor')},</p>
                <p>You’ve been assigned to teach the following class:</p>
                <ul>
                    <li><strong>Class:</strong> ${clsTitle}</li>
                    <li><strong>Date:</strong> ${startsAt.toLocaleDateString()}</li>
                    <li><strong>Time:</strong> ${startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</li>
                    <li><strong>Duration:</strong> ${durationLabel}</li>
                </ul>
                <p style="margin-top: 12px;">You can view your upcoming classes from your teaching schedule in the studio portal.</p>
            `;
        await emailService.sendGenericEmail(
            instructor.user.email,
            `New class assigned: ${clsTitle}`,
            html,
            true
        );
    } catch (err) {
        console.error('[Classes] Failed to send instructor assignment email', err);
    }
}

/** Schedule instructor email: use waitUntil when available (Workers), else fire-and-forget (tests). */
function scheduleInstructorEmail(c: any, promise: Promise<void>) {
    try {
        c.executionCtx.waitUntil(promise);
    } catch {
        promise.catch((err: unknown) => console.error('[Classes] Instructor assignment email failed', err));
    }
}

// Schemas
export const ClassSchema = z.object({
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
    type: z.enum(['class', 'workshop', 'event', 'appointment', 'course']).default('class'),
    // Gradient Styling (Phase 9)
    gradientPreset: z.string().nullable().optional(),
    gradientColor1: z.string().nullable().optional(),
    gradientColor2: z.string().nullable().optional(),
    gradientDirection: z.number().nullable().optional(),
    // Payroll (Phase 7)
    payrollModel: z.enum(['flat', 'percentage', 'hourly']).optional().nullable(),
    payrollValue: z.number().optional().nullable(),
    // Course (Phase 13+)
    isCourse: z.boolean().optional(),
    recordingPrice: z.number().nullable().optional(),
    contentCollectionId: z.string().nullable().optional(),
    courseId: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    seriesId: z.string().nullable().optional(),

    // Enrollment and Access Rules
    minStudents: z.number().nullable().optional(),
    autoCancelThreshold: z.number().nullable().optional(),
    autoCancelEnabled: z.boolean().nullable().optional(),
    allowCredits: z.boolean().nullable().optional(),
    includedPlanIds: z.any().nullable().optional(),
    // Augmented fields
    bookingCount: z.number().optional(),
    waitlistCount: z.number().optional(),
    instructor: z.any().optional(), // Expand later
    instructors: z.array(z.any()).optional(),
    location: z.any().optional(),
    myBooking: z.object({
        id: z.string(),
        status: z.string(),
        attendanceType: z.string(),
        zoomMeetingUrl: z.string().optional().nullable(),
        zoomPassword: z.string().optional().nullable()
    }).optional().nullable()
}).openapi('Class');

const BaseCreateClassSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    startTime: z.string(), // ISO string from frontend
    durationMinutes: z.coerce.number(),
    instructorId: z.string().optional(),
    instructorIds: z.array(z.string()).optional(),
    locationId: z.string().optional(),
    zoomEnabled: z.boolean().default(false),
    createZoomMeeting: z.boolean().optional(),
    capacity: z.coerce.number().optional(),
    price: z.coerce.number().optional(),
    memberPrice: z.coerce.number().optional().nullable(),
    type: z.enum(['class', 'workshop', 'event', 'appointment', 'course']).default('class'),
    minStudents: z.coerce.number().default(1),
    autoCancelThreshold: z.coerce.number().optional(),
    autoCancelEnabled: z.boolean().optional(),
    allowCredits: z.boolean().default(true),
    includedPlanIds: z.array(z.string()).optional(),
    // Payroll
    payrollModel: z.enum(['flat', 'percentage', 'hourly']).optional().nullable(),
    payrollValue: z.coerce.number().optional().nullable(),
    // Course
    isCourse: z.boolean().optional(),
    recordingPrice: z.coerce.number().optional().nullable(),
    contentCollectionId: z.string().optional().nullable(),
    courseId: z.string().optional().nullable(),
    thumbnailUrl: z.string().optional().nullable(),
    // Gradient Styling (Phase 9)
    gradientPreset: z.string().nullable().optional(),
    gradientColor1: z.string().nullable().optional(),
    gradientColor2: z.string().nullable().optional(),
    gradientDirection: z.coerce.number().nullable().optional(),
    // Recurrence
    isRecurring: z.boolean().optional(),
    recurrenceRule: z.string().optional(),
    recurrenceEnd: z.string().optional()
});

export const CreateClassSchema = BaseCreateClassSchema.superRefine((val, ctx) => {
    const ids = (val.instructorIds && val.instructorIds.length > 0)
        ? val.instructorIds
        : (val.instructorId ? [val.instructorId] : []);

    if (['class', 'appointment'].includes(val.type) && ids.length > 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['instructorIds'],
            message: 'Regular classes and private appointments can only have one instructor.',
        });
    }
}).openapi('CreateClass');

export const UpdateClassSchema = BaseCreateClassSchema.partial().superRefine((val, ctx) => {
    // Only validate instructor cardinality if type is provided on update.
    if (!val.type) return;
    const ids = (val.instructorIds && val.instructorIds.length > 0)
        ? val.instructorIds
        : (val.instructorId ? [val.instructorId] : []);
    if (['class', 'appointment'].includes(val.type) && ids.length > 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['instructorIds'],
            message: 'Regular classes and private appointments can only have one instructor.',
        });
    }
}).openapi('UpdateClass');

// Routes

// GET /
// app.use('/', cacheMiddleware({ maxAge: 60, staleWhileRevalidate: 300 }));

app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Classes'],
    summary: 'List classes',
    request: {
        query: z.object({
            start: z.string().optional(),
            end: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            instructorId: z.string().optional(),
            locationId: z.string().optional(),
            category: z.string().optional(),
            limit: z.coerce.number().int().positive().default(50).optional(),
            offset: z.coerce.number().int().nonnegative().default(0).optional(),
            isCourse: z.string().optional(),
            status: z.string().optional()
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.array(ClassSchema) } }, description: 'List of classes' }
    }
}), async (c: any) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    const q = c.req.valid('query');
    const start = q.start ?? q.startDate;
    const end = q.end ?? q.endDate;
    const { instructorId, locationId, limit, offset, category } = q;

    const conds = [eq(classes.tenantId, tenant.id)];
    if (start) conds.push(gte(classes.startTime, new Date(start)));
    if (end) conds.push(lte(classes.startTime, new Date(end)));
    if (instructorId) conds.push(eq(classes.instructorId, instructorId));
    if (locationId) conds.push(eq(classes.locationId, locationId));
    if (category && ['class', 'workshop', 'event', 'appointment', 'course'].includes(category)) {
        conds.push(eq(classes.type, category));
    }
    if (q.isCourse !== undefined) {
        conds.push(eq(classes.isCourse, q.isCourse === 'true'));
    }

    if (q.status && q.status !== 'all') {
        conds.push(eq(classes.status, q.status));
    } else if (!q.status || q.status === 'active') {
        // Default to active classes: exclude archived and cancelled
        conds.push(ne(classes.status, 'archived'));
        conds.push(ne(classes.status, 'cancelled'));
    }

    const results = await db.query.classes.findMany({
        where: and(...conds),
        with: { instructor: { with: { user: true } }, location: true, classInstructors: { with: { instructor: { with: { user: true } } } } },
        orderBy: [asc(classes.startTime)],
        limit: limit || 100,
        offset: offset || 0
    });
    if (!results.length) return c.json([]);

    const classIds = results.map(r => r.id);

    const bm = new Map();
    const wm = new Map();
    let myBookingsMap = new Map();

    // Optimized combined count query. If anything fails (e.g. edge-case DB error),
    // we log and continue returning classes without counts so the calendar still works.
    try {
        // SQLite has a limit on the number of bound parameters (999). When there are many
        // classes in the window, we need to batch the IN (...) queries to avoid hitting it.
        type BookingCountRow = { classId: string; status: string | null; count: number };
        const counts: BookingCountRow[] = [];
        const STATUS_FILTER = ['confirmed', 'waitlisted'] as const;
        const CLASS_ID_BATCH_SIZE = 300; // 300 ids * 1 + 2 statuses <= 302 params per query

        for (let i = 0; i < classIds.length; i += CLASS_ID_BATCH_SIZE) {
            const batchIds = classIds.slice(i, i + CLASS_ID_BATCH_SIZE);
            if (batchIds.length === 0) continue;

            const batchCounts = await db.select({
                classId: bookings.classId,
                status: bookings.status,
                count: sql<number>`count(*)`
            })
                .from(bookings)
                .where(and(inArray(bookings.classId, batchIds), inArray(bookings.status, STATUS_FILTER)))
                .groupBy(bookings.classId, bookings.status)
                .all();

            counts.push(...batchCounts);
        }

        counts.forEach((row: any) => {
            if (row.status === 'confirmed') bm.set(row.classId, row.count);
            if (row.status === 'waitlisted') wm.set(row.classId, row.count);
        });

        // Fetch My Bookings efficiently
        if (auth?.userId) {
            const member = c.get('member');
            if (member) {
                const myBookings: any[] = [];
                const MY_BOOKINGS_BATCH_SIZE = 300;

                for (let i = 0; i < classIds.length; i += MY_BOOKINGS_BATCH_SIZE) {
                    const batchIds = classIds.slice(i, i + MY_BOOKINGS_BATCH_SIZE);
                    if (batchIds.length === 0) continue;

                    const batch = await db.query.bookings.findMany({
                        where: and(
                            inArray(bookings.classId, batchIds),
                            eq(bookings.memberId, member.id),
                            inArray(bookings.status, STATUS_FILTER)
                        )
                    });
                    myBookings.push(...batch);
                }

                myBookings.forEach((b: any) => myBookingsMap.set(b.classId, b));
            }
        }
    } catch (err) {
        console.error('[CLASSES] Failed to compute booking counts/myBookings for classes list', err);
    }

    return c.json(results.map(r => {
        const myBooking = myBookingsMap.get(r.id);
        
        let instructors: any[] = [];
        if (r.instructor) instructors.push(r.instructor);
        if ((r as any).classInstructors && (r as any).classInstructors.length > 0) {
            instructors.push(...(r as any).classInstructors.map((ci: any) => ci.instructor));
        }
        // Deduplicate instructors
        instructors = instructors.filter((v, i, a) => a.findIndex((t: any) => (t.id === v.id)) === i);

        return {
            ...r,
            startTime: (r.startTime instanceof Date ? r.startTime : new Date(r.startTime)).toISOString(),
            price: (r.price ?? 0) as any as number,
            bookingCount: bm.get(r.id) || 0,
            waitlistCount: wm.get(r.id) || 0,
            zoomEnabled: !!r.zoomEnabled,
            inPersonCount: bm.get(r.id) || 0,
            virtualCount: 0,
            instructors,
            myBooking: myBooking ? {
                id: myBooking.id,
                status: myBooking.status,
                attendanceType: myBooking.attendanceType,
                zoomMeetingUrl: (myBooking.status === 'confirmed') ? r.zoomMeetingUrl : null,
                zoomPassword: (myBooking.status === 'confirmed') ? r.zoomPassword : null
            } : null
        };
    }));
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
}), async (c: any) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');

    const res = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tenant.id)), with: { instructor: { with: { user: true } }, location: true, classInstructors: { with: { instructor: { with: { user: true } } } } } });
    if (!res) return c.json({ error: "Not found" }, 404);

    const [bc, wc] = await Promise.all([
        db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, res.id), eq(bookings.status, 'confirmed'))).get(),
        db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, res.id), eq(bookings.status, 'waitlisted'))).get()
    ]);

    let instructors: any[] = [];
    if (res.instructor) instructors.push(res.instructor);
    if ((res as any).classInstructors && (res as any).classInstructors.length > 0) {
        instructors.push(...(res as any).classInstructors.map((ci: any) => ci.instructor));
    }
    // Deduplicate instructors
    instructors = instructors.filter((v, i, a) => a.findIndex((t: any) => (t.id === v.id)) === i);

    return c.json({
        ...res,
        startTime: res.startTime.toISOString(), // Ensure string
        bookingCount: bc?.c || 0,
        waitlistCount: wc?.c || 0,
        instructors
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
}), async (c: any) => {
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

    // Use instructorId if instructorsIds is empty
    let newInstructorIds = body.instructorIds && body.instructorIds.length > 0 ? body.instructorIds : (instructorId ? [instructorId] : []);
    const primaryInstructorId = newInstructorIds[0] || null;


    const cs = new ConflictService(db);
    const start = new Date(startTime);
    const dur = durationMinutes;

    for (const iid of newInstructorIds) {
        if ((await cs.checkInstructorConflict(iid, start, dur)).length) {
            return c.json({ error: "Instructor conflict" }, 409);
        }
    }
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
            instructorId: primaryInstructorId,
            locationId: locationId || null,
            title,
            description: body.description,
            durationMinutes: dur,
            price: body.price || 0,
            recurrenceRule,
            validFrom: start,
            validUntil: recurrenceEnd ? new Date(recurrenceEnd) : null,
            thumbnailUrl: body.thumbnailUrl || null,
            gradientPreset: body.gradientPreset,
            gradientColor1: body.gradientColor1,
            gradientColor2: body.gradientColor2,
            gradientDirection: body.gradientDirection,
            createdAt: new Date()
        }).run();

        // Also insert classSeriesInstructors
        for (const iid of newInstructorIds) {
            await db.insert(classSeriesInstructors).values({
                seriesId,
                instructorId: iid
            }).run();
        }

        let occurrences: Date[];
        try {
            const options = RRule.parseString(recurrenceRule);
            options.dtstart = start;
            if (recurrenceEnd) options.until = new Date(recurrenceEnd);
            const rule = new RRule(options);
            occurrences = rule.all();
        } catch (rruleErr: any) {
            console.error('[CLASSES] RRule parsing failed:', rruleErr);
            return c.json({ error: `Failed to parse recurrence rule: ${rruleErr.message || 'Unknown error'}` }, 400);
        }

        // Adjust for DST — preserve local time across timezone changes
        const tz = tenant.timezone || 'America/New_York';
        occurrences = adjustForDST(occurrences, start, tz);

        if (occurrences.length === 0) {
            return c.json({ error: 'Recurrence rule produced no dates. Check your start time and end date.' }, 400);
        }

        if (occurrences.length > MAX_RECURRENCE_OCCURRENCES) {
            return c.json({ error: `Too many occurrences (${occurrences.length}). Limit to ${MAX_RECURRENCE_OCCURRENCES} or set a closer end date.` }, 400);
        }

        const classData = [];
        for (const occ of occurrences) {
            const meeting = await createMeeting(title, occ);
            classData.push({
                id: crypto.randomUUID(),
                tenantId: tenant.id,
                instructorId: primaryInstructorId,
                locationId: locationId || null,
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
                status: 'active' as const,
                payrollModel: body.payrollModel || null,
                payrollValue: body.payrollValue || null,
                isCourse: !!body.isCourse,
                recordingPrice: body.recordingPrice || null,
                contentCollectionId: body.contentCollectionId || null,
                courseId: body.courseId || null,
                thumbnailUrl: body.thumbnailUrl || null,
                gradientPreset: body.gradientPreset,
                gradientColor1: body.gradientColor1,
                gradientColor2: body.gradientColor2,
                gradientDirection: body.gradientDirection,
                createdAt: new Date()
            });
        }

        // Insert one row at a time (D1 has a 100 bind parameter limit per statement)
        for (const cls of classData) {
            await db.insert(classes).values(cls).run();
            // Insert classInstructors
            for (const iid of newInstructorIds) {
                await db.insert(classInstructors).values({
                    classId: cls.id,
                    instructorId: iid
                }).run();
            }
        }
        return c.json({ seriesId, classes: classData.length }, 201);
    } else {
        const id = crypto.randomUUID();
        const meeting = await createMeeting(title, start);

        const [nc] = await db.insert(classes).values({
            id,
            tenantId: tenant.id,
            instructorId: primaryInstructorId,
            locationId: locationId || null,
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
            isCourse: !!body.isCourse,
            recordingPrice: body.recordingPrice || null,
            contentCollectionId: body.contentCollectionId || null,
            courseId: body.courseId || null,
            thumbnailUrl: body.thumbnailUrl || null,
            gradientPreset: body.gradientPreset,
            gradientColor1: body.gradientColor1,
            gradientColor2: body.gradientColor2,
            gradientDirection: body.gradientDirection,
            createdAt: new Date()
        }).returning();

        for (const iid of newInstructorIds) {
            await db.insert(classInstructors).values({
                classId: id,
                instructorId: iid
            }).run();
        }

        scheduleInstructorEmail(c, sendInstructorAssignmentEmail(db, c.env, tenant, primaryInstructorId, title, start, dur));

        return c.json({ ...nc, startTime: nc.startTime.toISOString() }, 201);
    }
});

// PATCH /:id
app.openapi(createRoute({
    method: 'patch',
    path: '/{id}',
    tags: ['Classes'],
    summary: 'Update class (supports scope for series editing)',
    request: {
        params: z.object({ id: z.string() }),
        query: z.object({ scope: z.enum(['single', 'future', 'all']).default('single').optional() }),
        body: { content: { 'application/json': { schema: UpdateClassSchema } } }
    },
    responses: {
        200: { description: 'Class updated' },
        404: { description: 'Not found' },
        409: { description: 'Conflict' }
    }
}), async (c: any) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const tid = tenant.id;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const scope = c.req.query('scope') || 'single';

    const ex = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tid)) });
    if (!ex) return c.json({ error: "Not found" }, 404);

    const up: any = {};
    const keys = ['title', 'description', 'startTime', 'durationMinutes', 'capacity', 'price', 'memberPrice', 'allowCredits', 'includedPlanIds', 'zoomEnabled', 'status', 'instructorId', 'locationId', 'payrollModel', 'payrollValue', 'isCourse', 'recordingPrice', 'contentCollectionId', 'courseId', 'gradientPreset', 'gradientColor1', 'gradientColor2', 'gradientDirection', 'thumbnailUrl', 'autoCancelEnabled', 'autoCancelThreshold', 'minStudents', 'type'];
    Object.keys(body).forEach(k => {
        if (keys.includes(k)) {
            // @ts-ignore
            up[k] = (k === 'startTime' && body[k]) ? new Date(body[k]) : body[k];
        }
    });

    let updateInstructors = false;
    let newInstructorIds: string[] = [];
    if ('instructorIds' in body && Array.isArray(body.instructorIds)) {
        updateInstructors = true;
        newInstructorIds = body.instructorIds;
    } else if ('instructorId' in body && body.instructorId) {
        updateInstructors = true;
        newInstructorIds = [body.instructorId];
    } else if ('instructorId' in body && body.instructorId === null) {
        updateInstructors = true;
        newInstructorIds = [];
    }


    // For single scope or non-series classes, check conflicts and update just this one
    if (scope === 'single' || !ex.seriesId) {
        const originalInstructorId = ex.instructorId;

        if (up.startTime || up.durationMinutes || up.instructorId || up.locationId) {
            const cs = new ConflictService(db);
            if ((up.instructorId || ex.instructorId) && (await cs.checkInstructorConflict(up.instructorId || ex.instructorId!, up.startTime || ex.startTime, up.durationMinutes || ex.durationMinutes, id)).length) return c.json({ error: "Conflict" }, 409);
            if ((up.locationId || ex.locationId) && (await cs.checkRoomConflict(up.locationId || ex.locationId!, up.startTime || ex.startTime, up.durationMinutes || ex.durationMinutes, id)).length) return c.json({ error: "Location Conflict" }, 409);
        }
        await db.update(classes).set(up).where(eq(classes.id, id)).run();

        if (updateInstructors) {
            await db.delete(classInstructors).where(eq(classInstructors.classId, id)).run();
            for (const iid of newInstructorIds) {
                await db.insert(classInstructors).values({ classId: id, instructorId: iid }).run();
            }
        }

        const newPrimaryInstructorId = ('instructorId' in up ? up.instructorId : ex.instructorId) || null;
        const instructorChanged = newPrimaryInstructorId && newPrimaryInstructorId !== originalInstructorId;
        if (instructorChanged) {
            const startsAt = (up.startTime as Date | undefined) || ex.startTime;
            const duration = (up.durationMinutes as number | undefined) || ex.durationMinutes;
            scheduleInstructorEmail(c, sendInstructorAssignmentEmail(db, c.env, tenant, newPrimaryInstructorId, ex.title, startsAt instanceof Date ? startsAt : new Date(startsAt), duration));
        }

        return c.json({ success: true, updated: 1 });
    }

    // Calculate time difference if startTime is being updated
    const timeShiftMs = (up.startTime && ex.startTime) ? up.startTime.getTime() - ex.startTime.getTime() : 0;
    const timeShiftSeconds = Math.round(timeShiftMs / 1000);

    // Series-aware edits: don't apply absolute startTime changes to bulk (each class has its own time)
    const seriesUp = { ...up };
    delete seriesUp.startTime; // We will use SQL math to shift times instead

    if (scope === 'future') {
        const updatePayload: any = { ...seriesUp };
        if (timeShiftSeconds !== 0) {
            updatePayload.startTime = sql`${classes.startTime} + ${timeShiftSeconds}`;
        }

        // Update this class + all future active classes in the same series
        const result = await db.update(classes)
            .set(updatePayload)
            .where(and(
                eq(classes.seriesId, ex.seriesId!),
                eq(classes.tenantId, tid),
                gte(classes.startTime, ex.startTime),
                eq(classes.status, 'active')
            ))
            .run();
        // Also update the parent series record
        const seriesKeys = ['title', 'description', 'durationMinutes', 'price', 'instructorId', 'locationId', 'thumbnailUrl', 'gradientPreset', 'gradientColor1', 'gradientColor2', 'gradientDirection'];
        const seriesUpdate: any = {};
        seriesKeys.forEach(k => { if (seriesUp[k] !== undefined) seriesUpdate[k] = seriesUp[k]; });
        if (timeShiftSeconds !== 0) {
            seriesUpdate.validFrom = sql`${classSeries.validFrom} + ${timeShiftSeconds}`;
        }
        if (Object.keys(seriesUpdate).length > 0) {
            await db.update(classSeries).set(seriesUpdate).where(eq(classSeries.id, ex.seriesId!)).run();
        }

        if (updateInstructors) {
            if (ex.seriesId) {
                await db.delete(classSeriesInstructors).where(eq(classSeriesInstructors.seriesId, ex.seriesId)).run();
                for (const iid of newInstructorIds) {
                    await db.insert(classSeriesInstructors).values({ seriesId: ex.seriesId, instructorId: iid }).run();
                }
            }
            
            const futureClasses = await db.select({ id: classes.id })
                .from(classes)
                .where(and(
                    eq(classes.seriesId, ex.seriesId!),
                    eq(classes.tenantId, tid),
                    gte(classes.startTime, ex.startTime),
                    eq(classes.status, 'active')
                ))
                .all();

            for (const cls of futureClasses) {
                await db.delete(classInstructors).where(eq(classInstructors.classId, cls.id)).run();
                for (const iid of newInstructorIds) {
                    await db.insert(classInstructors).values({ classId: cls.id, instructorId: iid }).run();
                }
            }
        }

        return c.json({ success: true, updated: result.meta?.changes || 0 });
    }

    if (scope === 'all') {
        const updatePayload: any = { ...seriesUp };
        if (timeShiftSeconds !== 0) {
            updatePayload.startTime = sql`${classes.startTime} + ${timeShiftSeconds}`;
        }

        // Update ALL active classes in the series
        const result = await db.update(classes)
            .set(updatePayload)
            .where(and(
                eq(classes.seriesId, ex.seriesId!),
                eq(classes.tenantId, tid),
                eq(classes.status, 'active')
            ))
            .run();
        // Also update parent series
        const seriesKeys = ['title', 'description', 'durationMinutes', 'price', 'instructorId', 'locationId', 'thumbnailUrl', 'gradientPreset', 'gradientColor1', 'gradientColor2', 'gradientDirection'];
        const seriesUpdate: any = {};
        seriesKeys.forEach(k => { if (seriesUp[k] !== undefined) seriesUpdate[k] = seriesUp[k]; });
        if (timeShiftSeconds !== 0) {
            seriesUpdate.validFrom = sql`${classSeries.validFrom} + ${timeShiftSeconds}`;
        }
        if (Object.keys(seriesUpdate).length > 0) {
            await db.update(classSeries).set(seriesUpdate).where(eq(classSeries.id, ex.seriesId!)).run();
        }

        if (updateInstructors) {
            if (ex.seriesId) {
                await db.delete(classSeriesInstructors).where(eq(classSeriesInstructors.seriesId, ex.seriesId)).run();
                for (const iid of newInstructorIds) {
                    await db.insert(classSeriesInstructors).values({ seriesId: ex.seriesId, instructorId: iid }).run();
                }
            }
            
            const allClasses = await db.select({ id: classes.id })
                .from(classes)
                .where(and(
                    eq(classes.seriesId, ex.seriesId!),
                    eq(classes.tenantId, tid),
                    eq(classes.status, 'active')
                ))
                .all();

            for (const cls of allClasses) {
                await db.delete(classInstructors).where(eq(classInstructors.classId, cls.id)).run();
                for (const iid of newInstructorIds) {
                    await db.insert(classInstructors).values({ classId: cls.id, instructorId: iid }).run();
                }
            }
        }

        return c.json({ success: true, updated: result.meta?.changes || 0 });
    }

    return c.json({ error: 'Invalid scope' }, 400);
});

// POST /:id/make-recurring — Convert a single class into a recurring series
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/make-recurring',
    tags: ['Classes'],
    summary: 'Convert a single class into a recurring series',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        recurrenceRule: z.string(), // e.g. "FREQ=WEEKLY;BYDAY=MO,WE"
                        recurrenceEnd: z.string(), // ISO date for end of recurrence
                    })
                }
            }
        }
    },
    responses: {
        200: { description: 'Series created' },
        400: { description: 'Bad request' },
        404: { description: 'Not found' }
    }
}), async (c: any) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.get('tenant').id;
    const { id } = c.req.valid('param');
    const { recurrenceRule, recurrenceEnd } = c.req.valid('json');

    try {
        const ex = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tid)) });
        if (!ex) return c.json({ error: 'Not found' }, 404);
        if (ex.seriesId) return c.json({ error: 'Class is already part of a series' }, 400);

        // Ensure startTime is a proper Date
        const startDate = ex.startTime instanceof Date ? ex.startTime : new Date(ex.startTime);
        console.log('[MAKE-RECURRING] startDate:', startDate, 'recurrenceRule:', recurrenceRule, 'recurrenceEnd:', recurrenceEnd);

        // Parse RRule to generate occurrences
        let occurrences: Date[];
        try {
            const options = RRule.parseString(recurrenceRule);
            options.dtstart = startDate;
            if (recurrenceEnd) options.until = new Date(recurrenceEnd);
            const rule = new RRule(options);
            occurrences = rule.all();
            console.log('[MAKE-RECURRING] Generated occurrences:', occurrences.length);
        } catch (rruleErr: any) {
            console.error('[MAKE-RECURRING] RRule parsing failed:', rruleErr);
            return c.json({ error: `Failed to parse recurrence rule: ${rruleErr.message}` }, 400);
        }

        // Adjust for DST — preserve local time across timezone changes
        const tenantData = c.get('tenant');
        const tz = tenantData.timezone || 'America/New_York';
        occurrences = adjustForDST(occurrences, startDate, tz);

        // Remove the first occurrence if it matches the existing class time (within 1 min)
        occurrences = occurrences.filter(occ =>
            Math.abs(occ.getTime() - startDate.getTime()) > 60000
        );

        if (occurrences.length === 0) {
            return c.json({ error: 'Recurrence rule produced no additional dates.' }, 400);
        }
        if (occurrences.length > MAX_RECURRENCE_OCCURRENCES) {
            return c.json({ error: `Too many occurrences (${occurrences.length + 1}). Limit to ${MAX_RECURRENCE_OCCURRENCES} or set a closer end date.` }, 400);
        }

        // Create the series record
        const seriesId = crypto.randomUUID();
        await db.insert(classSeries).values({
            id: seriesId,
            tenantId: tid,
            instructorId: ex.instructorId || null,
            locationId: ex.locationId || null,
            title: ex.title,
            description: ex.description || null,
            durationMinutes: ex.durationMinutes,
            price: ex.price || 0,
            recurrenceRule,
            validFrom: startDate,
            validUntil: recurrenceEnd ? new Date(recurrenceEnd) : null,
            thumbnailUrl: ex.thumbnailUrl || null,
            gradientPreset: ex.gradientPreset || null,
            gradientColor1: ex.gradientColor1 || null,
            gradientColor2: ex.gradientColor2 || null,
            gradientDirection: ex.gradientDirection ?? null,
            createdAt: new Date()
        }).run();

        // Link the original class
        await db.update(classes).set({ seriesId }).where(eq(classes.id, id)).run();

        // Generate future instances
        const classData = occurrences.map(occ => ({
            id: crypto.randomUUID(),
            tenantId: tid,
            instructorId: ex.instructorId || null,
            locationId: ex.locationId || null,
            seriesId,
            title: ex.title,
            description: ex.description || null,
            startTime: occ,
            durationMinutes: ex.durationMinutes,
            capacity: ex.capacity ?? null,
            price: ex.price || 0,
            memberPrice: ex.memberPrice ?? null,
            type: (ex.type || 'class') as any,
            minStudents: ex.minStudents || 1,
            autoCancelThreshold: ex.autoCancelThreshold ?? null,
            autoCancelEnabled: !!ex.autoCancelEnabled,
            allowCredits: ex.allowCredits !== false,
            includedPlanIds: ex.includedPlanIds || [],
            zoomEnabled: !!ex.zoomEnabled,
            status: 'active' as const,
            payrollModel: ex.payrollModel || null,
            payrollValue: ex.payrollValue ?? null,
            isCourse: !!ex.isCourse,
            recordingPrice: ex.recordingPrice ?? null,
            contentCollectionId: ex.contentCollectionId || null,
            courseId: ex.courseId || null,
            thumbnailUrl: ex.thumbnailUrl || null,
            gradientPreset: ex.gradientPreset || null,
            gradientColor1: ex.gradientColor1 || null,
            gradientColor2: ex.gradientColor2 || null,
            gradientDirection: ex.gradientDirection ?? null,
            createdAt: new Date()
        }));

        // Batch insert (D1 limit ~50 rows per statement)
        // Insert one row at a time (D1 has a 100 bind parameter limit per statement)
        for (const cls of classData) {
            await db.insert(classes).values(cls).run();
            // Instructors mapping
            if (ex.instructorId) {
                await db.insert(classInstructors).values({ classId: cls.id, instructorId: ex.instructorId }).run();
            } else {
                const existInstr = await db.select().from(classInstructors).where(eq(classInstructors.classId, id)).all();
                for (const ei of existInstr) {
                    await db.insert(classInstructors).values({ classId: cls.id, instructorId: ei.instructorId }).run();
                }
            }
        }

        // Add classSeriesInstructors too
        if (ex.instructorId) {
            await db.insert(classSeriesInstructors).values({ seriesId, instructorId: ex.instructorId }).run();
        } else {
            const existInstr = await db.select().from(classInstructors).where(eq(classInstructors.classId, id)).all();
            for (const ei of existInstr) {
                await db.insert(classSeriesInstructors).values({ seriesId, instructorId: ei.instructorId }).run();
            }
        }

        console.log('[MAKE-RECURRING] Created series', seriesId, 'with', classData.length, 'classes');
        return c.json({ success: true, seriesId, created: classData.length });
    } catch (err: any) {
        console.error('[MAKE-RECURRING] Unhandled error:', err);
        return c.json({ error: err.message || 'Internal server error creating recurring series' }, 500);
    }
});

// POST /:id/remove-recurrence — Detach a class from its series
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/remove-recurrence',
    tags: ['Classes'],
    summary: 'Remove a class from its recurring series',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        cancelFuture: z.boolean().default(false).optional() // Also cancel all future events in the series
                    })
                }
            }
        }
    },
    responses: {
        200: { description: 'Recurrence removed' },
        400: { description: 'Bad request' },
        404: { description: 'Not found' }
    }
}), async (c: any) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.get('tenant').id;
    const { id } = c.req.valid('param');
    const { cancelFuture } = c.req.valid('json');

    const ex = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tid)) });
    if (!ex) return c.json({ error: 'Not found' }, 404);
    if (!ex.seriesId) return c.json({ error: 'Class is not part of a series' }, 400);

    const seriesId = ex.seriesId;

    // Detach THIS class from the series and ensure it stays active
    await db.update(classes).set({ seriesId: null, status: 'active' }).where(eq(classes.id, id)).run();

    let cancelledCount = 0;
    if (cancelFuture) {
        // Cancel all FUTURE active classes in the series (not past ones, not this one)
        const result = await db.update(classes)
            .set({ status: 'cancelled' })
            .where(and(
                eq(classes.seriesId, seriesId),
                eq(classes.tenantId, tid),
                gte(classes.startTime, new Date()),
                eq(classes.status, 'active')
            ))
            .run();
        cancelledCount = result.meta?.changes || 0;

        // Cancel bookings for those future classes
        const futureClasses = await db.select({ id: classes.id })
            .from(classes)
            .where(and(
                eq(classes.seriesId, seriesId),
                eq(classes.tenantId, tid),
                eq(classes.status, 'cancelled'),
                gte(classes.startTime, new Date())
            ))
            .all();

        for (const cls of futureClasses) {
            await db.update(bookings)
                .set({ status: 'cancelled' })
                .where(and(eq(bookings.classId, cls.id), eq(bookings.status, 'confirmed')))
                .run();
        }
    }

    return c.json({ success: true, cancelledFuture: cancelledCount });
});

// GET /:id/series — Get series info for a class
app.openapi(createRoute({
    method: 'get',
    path: '/{id}/series',
    tags: ['Classes'],
    summary: 'Get series info for a class',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { description: 'Series info' },
        404: { description: 'Not found or not part of a series' }
    }
}), async (c: any) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.get('tenant').id;
    const { id } = c.req.valid('param');

    const cls = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tid)) });
    if (!cls || !cls.seriesId) return c.json({ error: 'Not part of a series' }, 404);

    const series = await db.query.classSeries.findFirst({ where: eq(classSeries.id, cls.seriesId) });
    if (!series) return c.json({ error: 'Series not found' }, 404);

    // Count active + future classes in this series
    const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(classes)
        .where(and(eq(classes.seriesId, cls.seriesId), eq(classes.tenantId, tid), eq(classes.status, 'active')))
        .get();

    const futureCount = await db.select({ count: sql<number>`count(*)` })
        .from(classes)
        .where(and(eq(classes.seriesId, cls.seriesId), eq(classes.tenantId, tid), eq(classes.status, 'active'), gte(classes.startTime, new Date())))
        .get();

    return c.json({
        seriesId: series.id,
        recurrenceRule: series.recurrenceRule,
        validFrom: series.validFrom instanceof Date ? series.validFrom.toISOString() : series.validFrom,
        validUntil: series.validUntil ? (series.validUntil instanceof Date ? series.validUntil.toISOString() : series.validUntil) : null,
        totalActive: countResult?.count || 0,
        futureActive: futureCount?.count || 0,
    });
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
}), async (c: any) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { id } = c.req.valid('param');
    const res = await db.update(classes).set({ status: 'cancelled' }).where(and(eq(classes.id, id), eq(classes.tenantId, c.get('tenant').id))).run();
    if (!res.meta.changes) return c.json({ error: "Not found" }, 404);
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.classId, id)).run();
    return c.json({ success: true });
});


// POST /:id/restore — Un-cancel a class
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/restore',
    tags: ['Classes'],
    summary: 'Restore a cancelled class',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { description: 'Class restored' },
        404: { description: 'Not found' },
        400: { description: 'Class is not cancelled' }
    }
}), async (c: any) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.get('tenant').id;
    const { id } = c.req.valid('param');

    const cls = await db.query.classes.findFirst({ where: and(eq(classes.id, id), eq(classes.tenantId, tid)) });
    if (!cls) return c.json({ error: 'Not found' }, 404);
    if (cls.status !== 'cancelled') return c.json({ error: 'Class is not cancelled' }, 400);

    // Restore class to active
    await db.update(classes).set({ status: 'active' }).where(eq(classes.id, id)).run();

    // Re-activate cancelled bookings for this class
    await db.update(bookings).set({ status: 'confirmed' }).where(
        and(eq(bookings.classId, id), eq(bookings.status, 'cancelled'))
    ).run();

    return c.json({ success: true });
});

export default app;
