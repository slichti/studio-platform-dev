import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { classes, bookings, tenantMembers, users, classInstructors } from '@studio/db/src/schema';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { ConflictService } from '../services/conflicts';
import { ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const BulkCancelSchema = z.object({
    classIds: z.array(z.string()).optional(),
    // Date-range cancel (alternative to explicit IDs)
    from: z.string().optional(), // ISO 8601 date string
    to: z.string().optional(),
    instructorId: z.string().optional(),
    locationId: z.string().optional(),
    notifyStudents: z.boolean().optional().default(false),
    cancellationReason: z.string().optional(),
}).refine(d => (d.classIds && d.classIds.length > 0) || (d.from && d.to), {
    message: 'Provide either classIds or a from/to date range'
});

const BulkUpdateSchema = z.object({
    classIds: z.array(z.string()).min(1),
    data: z.object({
        instructorId: z.string().optional(),
        locationId: z.string().optional()
    })
});

const BulkMoveSchema = z.object({
    classIds: z.array(z.string()).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    instructorId: z.string().optional(),
    locationId: z.string().optional(),
    shiftMinutes: z.number().int(), // positive = later, negative = earlier
}).refine(d => (d.classIds && d.classIds.length > 0) || (d.from && d.to), {
    message: 'Provide either classIds or a from/to date range'
});

export const BulkCreateSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    /** Primary instructor (legacy) */
    instructorId: z.string().optional(),
    /** Optional list of instructors (first is primary) */
    instructorIds: z.array(z.string()).optional(),
    locationId: z.string().optional(),
    capacity: z.coerce.number().optional(),
    price: z.coerce.number().optional(),
    durationMinutes: z.coerce.number(),

    // Date range targeting
    startDate: z.string(), // YYYY-MM-DD
    endDate: z.string(),   // YYYY-MM-DD
    daysOfWeek: z.array(z.number().int().min(0).max(6)), // 0=Sun, 1=Mon, ..., 6=Sat
    startTime: z.string(), // HH:mm

    // extra configuration
    zoomEnabled: z.boolean().default(false),
    createZoomMeeting: z.boolean().optional(),
    minStudents: z.coerce.number().default(1),
    autoCancelThreshold: z.coerce.number().optional(),
    autoCancelEnabled: z.boolean().optional(),
    type: z.enum(['class', 'workshop', 'event', 'appointment', 'course']).default('class'),
    memberPrice: z.coerce.number().optional().nullable(),
    allowCredits: z.boolean().default(true),
    includedPlanIds: z.array(z.string()).optional(),
    payrollModel: z.enum(['flat', 'percentage', 'hourly']).optional().nullable(),
    payrollValue: z.coerce.number().optional().nullable(),
    isCourse: z.boolean().optional(),
    recordingPrice: z.coerce.number().optional().nullable(),
    contentCollectionId: z.string().optional().nullable(),
    courseId: z.string().optional().nullable(),
}).superRefine((val, ctx) => {
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
});

// --- Routes ---

// POST /bulk-cancel
const bulkCancelRoute = createRoute({
    method: 'post',
    path: '/bulk-cancel',
    tags: ['Classes'],
    summary: 'Bulk cancel classes',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: BulkCancelSchema
                }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ success: z.boolean(), affected: z.number() }) } },
            description: 'Classes cancelled'
        },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(bulkCancelRoute, async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { classIds, from, to, instructorId, locationId, notifyStudents, cancellationReason } = c.req.valid('json');

    // 1. Resolve target class IDs
    let targetIds: string[] = classIds ?? [];
    if (targetIds.length === 0 && from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const filters = [
            eq(classes.tenantId, tenant.id),
            gte(classes.startTime, fromDate),
            lte(classes.startTime, toDate),
        ];
        if (instructorId) filters.push(eq(classes.instructorId, instructorId));
        if (locationId) filters.push(eq(classes.locationId, locationId));

        const found = await db.select({ id: classes.id }).from(classes).where(and(...filters)).all();
        targetIds = found.map(f => f.id);
    }

    if (targetIds.length === 0) return c.json({ success: true, affected: 0, notified: 0 }, 200);

    // 2. Cancel all matching bookings and collect affected students for notification
    const affectedBookings = await db.select({
        bookingId: bookings.id,
        studentEmail: users.email,
        studentProfile: users.profile,
    })
        .from(bookings)
        .innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            inArray(bookings.classId, targetIds),
            inArray(bookings.status, ['confirmed', 'waitlisted'])
        ))
        .all();

    if (affectedBookings.length > 0) {
        await db.update(bookings)
            .set({ status: 'cancelled' })
            .where(and(
                inArray(bookings.classId, targetIds),
                inArray(bookings.status, ['confirmed', 'waitlisted'])
            ))
            .run();
    }

    // 3. Cancel the classes
    const result = await db.update(classes)
        .set({ status: 'cancelled' })
        .where(and(inArray(classes.id, targetIds), eq(classes.tenantId, tenant.id)))
        .run();

    // 4. Optionally notify affected students
    let notified = 0;
    if (notifyStudents && affectedBookings.length > 0 && c.env.RESEND_API_KEY) {
        const { EmailService } = await import('../services/email');
        const emailService = new EmailService(
            c.env.RESEND_API_KEY as string,
            { branding: tenant.branding as any, settings: tenant.settings as any },
            undefined, undefined, false, db, tenant.id
        );
        const uniqueEmails = [...new Set(affectedBookings.map(b => b.studentEmail).filter(Boolean))];
        for (const email of uniqueEmails) {
            try {
                await emailService.sendGenericEmail(
                    email,
                    `Class Cancellation Notice — ${tenant.name}`,
                    `<p>Your upcoming class has been cancelled by the studio.${cancellationReason ? ` <strong>Reason:</strong> ${cancellationReason}` : ''}</p><p>We apologise for the inconvenience. Please check the schedule for alternative sessions.</p>`
                );
                notified++;
            } catch { /* best-effort */ }
        }
    }

    return c.json({ success: true, affected: (result.meta as any).changes, notified }, 200);
});

// POST /bulk-update
const bulkUpdateRoute = createRoute({
    method: 'post',
    path: '/bulk-update',
    tags: ['Classes'],
    summary: 'Bulk update classes (Instructor/Location)',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: BulkUpdateSchema
                }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ success: z.boolean(), affected: z.number() }) } },
            description: 'Classes updated'
        },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Conflict detected or invalid data' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(bulkUpdateRoute, async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { classIds, data } = c.req.valid('json');

    if (!data.instructorId && !data.locationId) {
        return c.json({ error: 'At least one field (instructorId or locationId) must be provided' }, 400);
    }

    // Load classes to check for conflicts
    const targetClasses = await db.select()
        .from(classes)
        .where(and(
            inArray(classes.id, classIds),
            eq(classes.tenantId, tenant.id)
        ))
        .all();

    if (targetClasses.length === 0) return c.json({ success: true, affected: 0 }, 200);

    const conflictService = new ConflictService(db);

    // Check conflicts using batched approach
    if (data.instructorId) {
        const proposedClassesInfo = targetClasses.filter(c => c.instructorId !== data.instructorId).map(c => ({
            id: c.id,
            startTime: c.startTime,
            durationMinutes: c.durationMinutes
        }));
        if (proposedClassesInfo.length > 0) {
            const conflicts = await conflictService.checkInstructorConflictBatch(data.instructorId, proposedClassesInfo);
            if (conflicts.length > 0) {
                return c.json({ error: `Conflict for instructor in class starting at ${conflicts[0].proposedClass.startTime.toISOString()}` }, 400);
            }
        }
    }

    if (data.locationId) {
        const proposedClassesInfo = targetClasses.filter(c => c.locationId !== data.locationId).map(c => ({
            id: c.id,
            startTime: c.startTime,
            durationMinutes: c.durationMinutes
        }));
        if (proposedClassesInfo.length > 0) {
            const conflicts = await conflictService.checkRoomConflictBatch(data.locationId, proposedClassesInfo);
            if (conflicts.length > 0) {
                return c.json({ error: `Conflict for location in class starting at ${conflicts[0].proposedClass.startTime.toISOString()}` }, 400);
            }
        }
    }

    // Proceed with update
    const updateData: any = {};
    if (data.instructorId) updateData.instructorId = data.instructorId;
    if (data.locationId) updateData.locationId = data.locationId;

    const result = await db.update(classes)
        .set(updateData)
        .where(and(
            inArray(classes.id, classIds),
            eq(classes.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true, affected: (result.meta as any).changes }, 200);
});

// POST /bulk-move — Reschedule classes by shifting start times
const bulkMoveRoute = createRoute({
    method: 'post',
    path: '/bulk-move',
    tags: ['Classes'],
    summary: 'Bulk reschedule classes (shift by minutes)',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: BulkMoveSchema
                }
            }
        }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ success: z.boolean(), affected: z.number() }) } },
            description: 'Classes rescheduled'
        },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Conflict or invalid' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(bulkMoveRoute, async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { classIds, from, to, instructorId, locationId, shiftMinutes } = c.req.valid('json');

    let targetIds: string[] = classIds ?? [];
    if (targetIds.length === 0 && from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const filters = [
            eq(classes.tenantId, tenant.id),
            eq(classes.status, 'active'),
            gte(classes.startTime, fromDate),
            lte(classes.startTime, toDate),
        ];
        if (instructorId) filters.push(eq(classes.instructorId, instructorId));
        if (locationId) filters.push(eq(classes.locationId, locationId));
        const found = await db.select({ id: classes.id }).from(classes).where(and(...filters)).all();
        targetIds = found.map(f => f.id);
    }

    if (targetIds.length === 0) return c.json({ success: true, affected: 0 }, 200);

    const targetClasses = await db.select().from(classes).where(and(
        inArray(classes.id, targetIds),
        eq(classes.tenantId, tenant.id),
        eq(classes.status, 'active')
    )).all();

    if (targetClasses.length === 0) return c.json({ success: true, affected: 0 }, 200);

    const shiftMs = shiftMinutes * 60 * 1000;
    const proposedClasses = targetClasses.map(c => ({
        id: c.id,
        startTime: new Date(c.startTime.getTime() + shiftMs),
        durationMinutes: c.durationMinutes,
        instructorId: c.instructorId,
        locationId: c.locationId,
        title: c.title,
    }));

    // Overlap within the moved set (same instructor or same room)
    for (let i = 0; i < proposedClasses.length; i++) {
        for (let j = i + 1; j < proposedClasses.length; j++) {
            const a = proposedClasses[i];
            const b = proposedClasses[j];
            const aEnd = a.startTime.getTime() + a.durationMinutes * 60 * 1000;
            const bEnd = b.startTime.getTime() + b.durationMinutes * 60 * 1000;
            const overlaps = a.startTime.getTime() < bEnd && b.startTime.getTime() < aEnd;
            if (overlaps && (a.instructorId === b.instructorId || a.locationId === b.locationId)) {
                return c.json({ error: `Reschedule would create overlap: ${a.title} and ${b.title}` }, 400);
            }
        }
    }

    const conflictService = new ConflictService(db);
    const byInstructor = new Map<string, typeof proposedClasses>();
    const byRoom = new Map<string, typeof proposedClasses>();
    for (const p of proposedClasses) {
        if (p.instructorId != null) {
            if (!byInstructor.has(p.instructorId)) byInstructor.set(p.instructorId, []);
            byInstructor.get(p.instructorId)!.push(p);
        }
        if (p.locationId != null) {
            if (!byRoom.has(p.locationId)) byRoom.set(p.locationId, []);
            byRoom.get(p.locationId)!.push(p);
        }
    }
    for (const [instructorId, arr] of byInstructor) {
        const conflicts = await conflictService.checkInstructorConflictBatch(instructorId, arr);
        if (conflicts.length > 0) {
            return c.json({ error: `Instructor conflict at new time ${conflicts[0].proposedClass.startTime.toISOString()}` }, 400);
        }
    }
    for (const [locationId, arr] of byRoom) {
        const conflicts = await conflictService.checkRoomConflictBatch(locationId, arr);
        if (conflicts.length > 0) {
            return c.json({ error: `Room conflict at new time ${conflicts[0].proposedClass.startTime.toISOString()}` }, 400);
        }
    }

    for (const cls of targetClasses) {
        const newStart = new Date(cls.startTime.getTime() + shiftMs);
        await db.update(classes).set({ startTime: newStart }).where(eq(classes.id, cls.id)).run();
    }

    return c.json({ success: true, affected: targetClasses.length }, 200);
});

// POST /bulk-create — Generate multiple classes over a date range on specific days
const bulkCreateRoute = createRoute({
    method: 'post',
    path: '/bulk-create',
    tags: ['Classes'],
    summary: 'Bulk create classes over a date range',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: BulkCreateSchema
                }
            }
        }
    },
    responses: {
        201: {
            content: { 'application/json': { schema: z.object({ success: z.boolean(), created: z.number() }) } },
            description: 'Classes created'
        },
        400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Conflict or invalid input' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Unauthorized' }
    }
});

app.openapi(bulkCreateRoute, async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const body = c.req.valid('json');
    const instructorIds = (body.instructorIds && body.instructorIds.length > 0)
        ? body.instructorIds
        : (body.instructorId ? [body.instructorId] : []);
    const primaryInstructorId = instructorIds[0] || null;

    const start = new Date(body.startDate + "T00:00:00");
    const end = new Date(body.endDate + "T23:59:59");
    const [hours, minutes] = body.startTime.split(':').map(Number);

    if (end < start) return c.json({ error: 'End date must be after start date' }, 400);
    if (body.daysOfWeek.length === 0) return c.json({ error: 'Must select at least one day of the week' }, 400);

    // Generate occurrences
    const occurrences: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
        if (body.daysOfWeek.includes(current.getDay())) {
            const occ = new Date(current);
            occ.setHours(hours, minutes, 0, 0);
            occurrences.push(occ);
        }
        current.setDate(current.getDate() + 1);
    }

    if (occurrences.length === 0) {
        return c.json({ success: true, created: 0 }, 201);
    }

    // Propose classes for conflict checking
    const proposedClasses = occurrences.map((occ, idx) => ({
        id: `temp-${idx}`,
        startTime: occ,
        durationMinutes: body.durationMinutes,
        instructorId: primaryInstructorId,
        locationId: body.locationId || null,
        title: body.title
    }));

    const conflictService = new ConflictService(db);

    for (const iid of instructorIds) {
        const conflicts = await conflictService.checkInstructorConflictBatch(iid, proposedClasses as any);
        if (conflicts.length > 0) {
            return c.json({ error: `Instructor conflict at ${conflicts[0].proposedClass.startTime.toISOString()}` }, 400);
        }
    }

    if (body.locationId) {
        const conflicts = await conflictService.checkRoomConflictBatch(body.locationId, proposedClasses as any);
        if (conflicts.length > 0) {
            return c.json({ error: `Room conflict at ${conflicts[0].proposedClass.startTime.toISOString()}` }, 400);
        }
    }

    let shouldCreateZoom = body.createZoomMeeting || body.zoomEnabled;
    let zmUrl: string | null = null;
    let zmPwd: string | null = null;
    let zmId: string | null = null;

    if (shouldCreateZoom) {
        try {
            const { ZoomService } = await import('../services/zoom');
            const { EncryptionUtils } = await import('../utils/encryption');
            const zs = await ZoomService.getForTenant(tenant, c.env, new EncryptionUtils(c.env.ENCRYPTION_SECRET as string));
            if (zs) {
                // Bulk creation might just use a single recurring zoom link if preferred, 
                // but here we just create one for all, or skip it. Let's create one meeting if requested,
                // treating it as a "Personal Meeting ID" loose equivalent, or we should generate per occurrence.
                // Generating 50 zoom meetings might hit rate limits. 
                // Let's create one meeting without fixed time as a placeholder if possible, or skip.
                const m: any = await zs.createMeeting(body.title, occurrences[0], body.durationMinutes);
                zmId = m.id?.toString() || null;
                zmUrl = m.join_url || null;
                zmPwd = m.password || null;
            }
        } catch (e) { console.error("Zoom creation failed:", e); }
    }

    const classData = occurrences.map(occ => {
        return {
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            instructorId: primaryInstructorId,
            locationId: body.locationId || null,
            title: body.title,
            description: body.description || null,
            startTime: occ,
            durationMinutes: body.durationMinutes,
            capacity: body.capacity || null,
            price: body.price || 0,
            memberPrice: body.memberPrice || null,
            type: body.type as any,
            minStudents: body.minStudents || 1,
            autoCancelThreshold: body.autoCancelThreshold || null,
            autoCancelEnabled: !!body.autoCancelEnabled,
            allowCredits: body.allowCredits !== false,
            includedPlanIds: body.includedPlanIds || [],
            zoomEnabled: !!body.zoomEnabled,
            zoomMeetingId: zmId,
            zoomMeetingUrl: zmUrl,
            zoomPassword: zmPwd,
            status: 'active' as const,
            payrollModel: body.payrollModel || null,
            payrollValue: body.payrollValue || null,
            isCourse: !!body.isCourse,
            recordingPrice: body.recordingPrice || null,
            contentCollectionId: body.contentCollectionId || null,
            courseId: body.courseId || null,
            createdAt: new Date()
        };
    });

    // Insert one row at a time so we can also populate classInstructors consistently (and avoid D1 bind limits).
    for (const cls of classData) {
        await db.insert(classes).values(cls).run();
        for (const iid of instructorIds) {
            await db.insert(classInstructors).values({ classId: cls.id, instructorId: iid }).run();
        }
    }

    return c.json({ success: true, created: classData.length }, 201);
});

export default app;
