import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { classes, bookings, tenantMembers, users } from '@studio/db/src/schema';
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

export default app;
