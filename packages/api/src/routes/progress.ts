import { Hono } from 'hono';
import { eq, and, desc, sql, sum, max } from 'drizzle-orm';
import { createDb } from '../db';
import { progressMetricDefinitions, memberProgressEntries, tenants, tenantFeatures } from '@studio/db/src/schema';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// --- Metric Definitions CRUD ---

// GET /metrics - List metric definitions (filtered for students)
app.get('/metrics', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const roles = c.get('roles') || [];
    const isStaff = roles.includes('owner') || roles.includes('admin') || roles.includes('instructor');

    let query = db.select().from(progressMetricDefinitions)
        .where(and(
            eq(progressMetricDefinitions.tenantId, tenant.id),
            eq(progressMetricDefinitions.active, true)
        ))
        .orderBy(progressMetricDefinitions.displayOrder);

    const metrics = await query;

    // Filter for student visibility if not staff
    if (!isStaff) {
        return c.json(metrics.filter(m => m.visibleToStudents));
    }

    return c.json(metrics);
});

// POST /metrics - Create new metric (admin only)
app.post('/metrics', async (c) => {
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const body = await c.req.json();

    const metric = await db.insert(progressMetricDefinitions).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        name: body.name,
        category: body.category,
        unit: body.unit,
        icon: body.icon,
        aggregation: body.aggregation || 'sum',
        visibleToStudents: body.visibleToStudents ?? true,
        displayOrder: body.displayOrder || 0,
    }).returning().get();

    return c.json(metric, 201);
});

// PUT /metrics/:id - Update metric
app.put('/metrics/:id', async (c) => {
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const id = c.req.param('id');
    const body = await c.req.json();

    await db.update(progressMetricDefinitions)
        .set({
            name: body.name,
            category: body.category,
            unit: body.unit,
            icon: body.icon,
            aggregation: body.aggregation,
            visibleToStudents: body.visibleToStudents,
            displayOrder: body.displayOrder,
        })
        .where(and(
            eq(progressMetricDefinitions.id, id),
            eq(progressMetricDefinitions.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true });
});

// DELETE /metrics/:id - Soft delete metric
app.delete('/metrics/:id', async (c) => {
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const id = c.req.param('id');

    await db.update(progressMetricDefinitions)
        .set({ active: false })
        .where(and(
            eq(progressMetricDefinitions.id, id),
            eq(progressMetricDefinitions.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true });
});

// --- Member Stats ---

// GET /my-stats - Get current user's aggregated stats
app.get('/my-stats', async (c) => {
    const member = c.get('member');
    if (!member) return c.json({ error: 'Unauthorized' }, 401);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    // Get visible metrics
    const metrics = await db.select().from(progressMetricDefinitions)
        .where(and(
            eq(progressMetricDefinitions.tenantId, tenant.id),
            eq(progressMetricDefinitions.active, true),
            eq(progressMetricDefinitions.visibleToStudents, true)
        ));

    // Get aggregated values for each metric
    const stats = await Promise.all(metrics.map(async (metric) => {
        let value = 0;

        if (metric.aggregation === 'sum') {
            const result = await db.select({ total: sql<number>`COALESCE(SUM(${memberProgressEntries.value}), 0)` })
                .from(memberProgressEntries)
                .where(and(
                    eq(memberProgressEntries.memberId, member.id),
                    eq(memberProgressEntries.metricDefinitionId, metric.id)
                ))
                .get();
            value = result?.total || 0;
        } else if (metric.aggregation === 'max') {
            const result = await db.select({ max: sql<number>`COALESCE(MAX(${memberProgressEntries.value}), 0)` })
                .from(memberProgressEntries)
                .where(and(
                    eq(memberProgressEntries.memberId, member.id),
                    eq(memberProgressEntries.metricDefinitionId, metric.id)
                ))
                .get();
            value = result?.max || 0;
        } else if (metric.aggregation === 'latest') {
            const result = await db.select()
                .from(memberProgressEntries)
                .where(and(
                    eq(memberProgressEntries.memberId, member.id),
                    eq(memberProgressEntries.metricDefinitionId, metric.id)
                ))
                .orderBy(desc(memberProgressEntries.recordedAt))
                .limit(1)
                .get();
            value = result?.value || 0;
        }

        return {
            metricId: metric.id,
            name: metric.name,
            category: metric.category,
            unit: metric.unit,
            icon: metric.icon,
            value,
        };
    }));

    return c.json(stats);
});

// GET /members/:memberId/stats - Get specific member's stats (staff only)
app.get('/members/:memberId/stats', async (c) => {
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin') && !roles.includes('instructor')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const memberId = c.req.param('memberId');
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    const metrics = await db.select().from(progressMetricDefinitions)
        .where(and(
            eq(progressMetricDefinitions.tenantId, tenant.id),
            eq(progressMetricDefinitions.active, true)
        ));

    const stats = await Promise.all(metrics.map(async (metric) => {
        const result = await db.select({ total: sql<number>`COALESCE(SUM(${memberProgressEntries.value}), 0)` })
            .from(memberProgressEntries)
            .where(and(
                eq(memberProgressEntries.memberId, memberId),
                eq(memberProgressEntries.metricDefinitionId, metric.id)
            ))
            .get();

        return {
            metricId: metric.id,
            name: metric.name,
            category: metric.category,
            unit: metric.unit,
            value: result?.total || 0,
        };
    }));

    return c.json(stats);
});

// --- Entry Logging ---

// POST /entries - Log a new progress entry
app.post('/entries', async (c) => {
    const member = c.get('member');
    const roles = c.get('roles') || [];

    // Staff can log for any member, members can log for themselves
    const body = await c.req.json();
    const isStaff = roles.includes('owner') || roles.includes('admin') || roles.includes('instructor');

    let targetMemberId = member?.id;
    if (body.memberId && isStaff) {
        targetMemberId = body.memberId;
    }

    if (!targetMemberId) {
        return c.json({ error: 'Member not found' }, 400);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    // Verify metric exists and belongs to tenant
    const metric = await db.select().from(progressMetricDefinitions)
        .where(and(
            eq(progressMetricDefinitions.id, body.metricDefinitionId),
            eq(progressMetricDefinitions.tenantId, tenant.id)
        ))
        .get();

    if (!metric) {
        return c.json({ error: 'Metric not found' }, 404);
    }

    const entry = await db.insert(memberProgressEntries).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        memberId: targetMemberId,
        metricDefinitionId: body.metricDefinitionId,
        value: body.value,
        source: body.source || 'manual',
        metadata: body.metadata,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
    }).returning().get();

    return c.json(entry, 201);
});

// --- Settings & Configuration ---

// GET /settings - Get progress tracking configuration
app.get('/settings', async (c) => {
    const tenant = c.get('tenant')!;
    const settings = (tenant.settings as any) || {};
    const progressConfig = settings.progressTracking || {
        studioType: 'yoga',
        enabledCategories: ['mindfulness'],
        showLeaderboards: false,
        allowStudentInput: true,
    };
    return c.json(progressConfig);
});

// PUT /settings - Update progress tracking configuration (admin only)
app.put('/settings', async (c) => {
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const body = await c.req.json();

    const currentSettings = (tenant.settings as any) || {};
    const updatedSettings = {
        ...currentSettings,
        progressTracking: {
            studioType: body.studioType || 'yoga',
            enabledCategories: body.enabledCategories || ['mindfulness'],
            showLeaderboards: body.showLeaderboards ?? false,
            allowStudentInput: body.allowStudentInput ?? true,
        }
    };

    await db.update(tenants)
        .set({ settings: updatedSettings })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ success: true });
});

// POST /seed-defaults - Seed default metrics based on studio type (admin only)
app.post('/seed-defaults', async (c) => {
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { studioType } = await c.req.json();

    const defaults: Array<{ name: string; category: 'mindfulness' | 'strength' | 'cardio' | 'custom'; unit: string; icon: string; visibleToStudents: boolean }> = [];

    // Yoga-specific defaults
    if (studioType === 'yoga' || studioType === 'hybrid') {
        defaults.push(
            { name: 'Classes Attended', category: 'mindfulness', unit: 'classes', icon: 'Calendar', visibleToStudents: true },
            { name: 'Minutes Practiced', category: 'mindfulness', unit: 'minutes', icon: 'Clock', visibleToStudents: true },
            { name: 'Current Streak', category: 'mindfulness', unit: 'days', icon: 'Flame', visibleToStudents: true },
            { name: 'Longest Streak', category: 'mindfulness', unit: 'days', icon: 'Trophy', visibleToStudents: true },
        );
    }

    // Gym-specific defaults
    if (studioType === 'gym' || studioType === 'hybrid') {
        defaults.push(
            { name: 'Workouts Completed', category: 'cardio', unit: 'workouts', icon: 'Dumbbell', visibleToStudents: true },
            { name: 'Total Weight Lifted', category: 'strength', unit: 'lbs', icon: 'TrendingUp', visibleToStudents: studioType === 'gym' },
            { name: 'Personal Records', category: 'strength', unit: 'PRs', icon: 'Award', visibleToStudents: studioType === 'gym' },
            { name: 'Cardio Minutes', category: 'cardio', unit: 'minutes', icon: 'Heart', visibleToStudents: true },
        );
    }

    // Check existing metrics to avoid duplicates
    const existing = await db.select().from(progressMetricDefinitions)
        .where(eq(progressMetricDefinitions.tenantId, tenant.id));
    const existingNames = new Set(existing.map(m => m.name));

    const toInsert = defaults.filter(d => !existingNames.has(d.name));

    for (let i = 0; i < toInsert.length; i++) {
        const def = toInsert[i];
        await db.insert(progressMetricDefinitions).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            name: def.name,
            category: def.category,
            unit: def.unit,
            icon: def.icon,
            visibleToStudents: def.visibleToStudents,
            displayOrder: i,
        }).run();
    }

    return c.json({ seeded: toInsert.length, skipped: defaults.length - toInsert.length });
});

export default app;
