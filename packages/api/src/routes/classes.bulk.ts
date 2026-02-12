import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { classes } from '@studio/db/src/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ConflictService } from '../services/conflicts';
import { ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const BulkCancelSchema = z.object({
    classIds: z.array(z.string()).min(1)
});

const BulkUpdateSchema = z.object({
    classIds: z.array(z.string()).min(1),
    data: z.object({
        instructorId: z.string().optional(),
        locationId: z.string().optional()
    })
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
    const { classIds } = c.req.valid('json');

    const result = await db.update(classes)
        .set({ status: 'cancelled' })
        .where(and(
            inArray(classes.id, classIds),
            eq(classes.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true, affected: (result.meta as any).changes }, 200);
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

    // Check conflicts for each class
    for (const cls of targetClasses) {
        if (data.instructorId && data.instructorId !== cls.instructorId) {
            const conflicts = await conflictService.checkInstructorConflict(
                data.instructorId,
                cls.startTime,
                cls.durationMinutes,
                cls.id
            );
            if (conflicts.length > 0) {
                return c.json({ error: `Conflict for instructor in class starting at ${cls.startTime.toISOString()}` }, 400);
            }
        }
        if (data.locationId && data.locationId !== cls.locationId) {
            const conflicts = await conflictService.checkRoomConflict(
                data.locationId,
                cls.startTime,
                cls.durationMinutes,
                cls.id
            );
            if (conflicts.length > 0) {
                return c.json({ error: `Conflict for location in class starting at ${cls.startTime.toISOString()}` }, 400);
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

export default app;
