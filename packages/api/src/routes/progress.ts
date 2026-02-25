import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../db';
import { HonoContext } from '../types';
import { ProgressService } from '../services/progress';
import { progressMetricDefinitions, tenantMembers } from '@studio/db/src/schema'; // Type import if needed

const app = new Hono<HonoContext>();

// Helper to get service
const getService = (c: any) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    return new ProgressService(db, tenant.id);
};

// --- Metric Definitions CRUD ---

// GET /metrics - List metric definitions
app.get('/metrics', async (c) => {
    const isStaff = c.get('can')('view_progress');
    const service = getService(c);

    const metrics = await service.getMetrics(isStaff);
    return c.json(metrics);
});
// POST /metrics - Create new metric (admin only)
app.post('/metrics', async (c) => {
    if (!c.get('can')('manage_progress')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const service = getService(c);
    const body = await c.req.json();
    const metric = await service.createMetric(body);

    return c.json(metric, 201);
});

// PUT /metrics/:id - Update metric definition
app.put('/metrics/:id', async (c) => {
    if (!c.get('can')('manage_progress')) return c.json({ error: 'Unauthorized' }, 403);
    const service = getService(c);
    const body = await c.req.json();
    await service.updateMetric(c.req.param('id'), body);
    return c.json({ success: true });
});

// DELETE /metrics/:id - Delete metric definition
app.delete('/metrics/:id', async (c) => {
    if (!c.get('can')('manage_progress')) return c.json({ error: 'Unauthorized' }, 403);
    const service = getService(c);
    await service.deleteMetric(c.req.param('id'));
    return c.json({ success: true });
});



// GET /my-stats - Get current user's aggregated stats
app.get('/my-stats', async (c) => {
    const member = c.get('member');
    if (!member) return c.json({ error: 'Unauthorized' }, 401);

    const service = getService(c);
    const stats = await service.getMemberStats(member.id, true);
    return c.json(stats);
});

// GET /members/:memberId/stats - Get specific member's stats (staff only)
app.get('/members/:memberId/stats', async (c) => {
    if (!c.get('can')('view_progress')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const memberId = c.req.param('memberId');
    const service = getService(c);
    const stats = await service.getMemberStats(memberId, false);
    return c.json(stats);
});

// POST /entries - Log a new progress entry
app.post('/entries', async (c) => {
    const member = c.get('member');
    const body = await c.req.json();
    const isStaff = c.get('can')('manage_progress');

    let targetMemberId = member?.id;
    if (body.memberId && isStaff) {
        targetMemberId = body.memberId;
    }

    if (!targetMemberId) {
        return c.json({ error: 'Member not found' }, 400);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    // Ensure the target member exists within the current tenant (for both students and staff-specified memberId)
    const targetMember = await db.query.tenantMembers.findFirst({
        where: and(
            eq(tenantMembers.id, targetMemberId),
            eq(tenantMembers.tenantId, tenant.id)
        ),
        columns: { id: true }
    });
    if (!targetMember) {
        return c.json({ error: 'Member not found' }, 404);
    }

    const service = getService(c);
    try {
        const entry = await service.logEntry({
            memberId: targetMemberId,
            metricDefinitionId: body.metricDefinitionId,
            value: body.value,
            source: body.source,
            metadata: body.metadata,
            recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
        });
        return c.json(entry, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
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
    if (!c.get('can')('manage_settings')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const service = getService(c);
    const body = await c.req.json();
    await service.updateSettings(body);
    return c.json({ success: true });
});

// POST /seed-defaults - Seed default metrics
app.post('/seed-defaults', async (c) => {
    if (!c.get('can')('manage_settings')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const service = getService(c);
    const { studioType } = await c.req.json();
    const result = await service.seedDefaults(studioType);
    return c.json(result);
});

export default app;
