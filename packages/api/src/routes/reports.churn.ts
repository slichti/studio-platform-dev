import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { ChurnService } from '../services/churn';
import { tenantMembers, subscriptions } from '@studio/db/src/schema';
import { eq, and, sql, gte } from 'drizzle-orm';

const app = createOpenAPIApp<StudioVariables>();

// Schema
const ChurnRiskSchema = z.object({
    memberId: z.string(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    lastAttendance: z.string().nullable(), // ISO Date
    daysSinceLastAttendance: z.number(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    churnScore: z.number()
}).openapi('ChurnRisk');

const ChurnReportSchema = z.object({
    totalMembers: z.number(),
    atRiskCount: z.number(),
    churnedCount: z.number(),
    atRiskMembers: z.array(ChurnRiskSchema)
});

// Routes
app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin Stats'],
    summary: 'Get Churn Risk Report',
    responses: {
        200: {
            description: 'Churn Report',
            content: { 'application/json': { schema: ChurnReportSchema } }
        },
        403: { description: 'Unauthorized' }
    }
}), async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenantId = c.get('tenant').id;
    const churnService = new ChurnService(db, tenantId);

    // Run live analysis (or fetch cached from DB if we trusted the job)
    // For now, we calculate live for the report to be fresh.
    const results = await churnService.analyzeAllMembers();

    // Enrich with Names
    const members = await db.query.tenantMembers.findMany({
        where: and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.status, 'active')),
        with: { user: true }
    });
    const memberMap = new Map(members.map(m => [m.id, m]));

    const enriched = results.map(r => {
        const m = memberMap.get(r.memberId);
        return {
            ...r,
            firstName: (m?.user.profile as any)?.firstName,
            lastName: (m?.user.profile as any)?.lastName,
            lastAttendance: r.lastAttendanceDate ? r.lastAttendanceDate.toISOString() : null
        };
    });

    const atRiskMembers = enriched.filter(r => r.riskLevel !== 'low');
    atRiskMembers.sort((a, b) => b.daysSinceLastAttendance - a.daysSinceLastAttendance);

    // Churn reasons from subscription cancellations (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const churnReasonsRows = await db.select({
        reason: subscriptions.churnReason,
        count: sql<number>`count(*)`
    })
        .from(subscriptions)
        .where(and(
            eq(subscriptions.tenantId, tenantId),
            eq(subscriptions.status, 'canceled'),
            gte(subscriptions.canceledAt, ninetyDaysAgo)
        ))
        .groupBy(subscriptions.churnReason)
        .all();

    const churnReasons = churnReasonsRows.map(r => ({
        reason: r.reason || '(no reason given)',
        count: r.count
    }));

    return c.json({
        totalMembers: members.length,
        atRiskCount: results.filter(r => r.riskLevel === 'medium').length,
        churnedCount: results.filter(r => r.riskLevel === 'high').length,
        atRiskMembers: atRiskMembers,
        churnReasons
    });
});

app.openapi(createRoute({
    method: 'post',
    path: '/analyze',
    tags: ['Admin Stats'],
    summary: 'Trigger Churn Analysis Batch',
    description: 'Calculates scores and updates the database for all members.',
    responses: {
        200: {
            description: 'Analysis Complete',
            content: { 'application/json': { schema: z.object({ processed: z.number() }) } }
        },
        403: { description: 'Unauthorized' }
    }
}), async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenantId = c.get('tenant').id;
    const churnService = new ChurnService(db, tenantId);

    const results = await churnService.analyzeAllMembers();

    // Update DB
    await Promise.all(results.map(r => churnService.updateMemberScore(r.memberId, r)));

    return c.json({ processed: results.length });
});

export default app;
