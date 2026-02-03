import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { tenants, tenantMembers, bookings, classes, users } from '@studio/db/src/schema';
import { eq, and, sql, desc, lt, isNull } from 'drizzle-orm';

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

    // 1. Get all active members
    const members = await db.query.tenantMembers.findMany({
        where: and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.status, 'active')),
        with: { user: true }
    });

    if (!members.length) {
        return c.json({ totalMembers: 0, atRiskCount: 0, churnedCount: 0, atRiskMembers: [] });
    }

    // 2. Get last booking for each member
    // Complex join: Select memberId, MAX(classes.startTime)
    const lastBookings = await db.select({
        memberId: bookings.memberId,
        lastDate: sql<string>`MAX(${classes.startTime})`
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(bookings.status, 'confirmed'),
            eq(classes.tenantId, tenantId),
            lt(classes.startTime, new Date()) // Only past classes
        ))
        .groupBy(bookings.memberId)
        .all();

    const lastMap = new Map<string, Date>();
    lastBookings.forEach(lb => {
        if (lb.lastDate) lastMap.set(lb.memberId, new Date(lb.lastDate));
    });

    // 3. Analyze Risk
    const now = new Date();
    const risks: z.infer<typeof ChurnRiskSchema>[] = [];
    let atRisk = 0;
    let churned = 0;

    for (const m of members) {
        const last = lastMap.get(m.id);
        const joined = m.joinedAt || new Date(); // If no joinedAt, assume new? Or use created_at

        let daysSince = 0;
        if (last) {
            daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        } else {
            // Never attended? Use joined date
            daysSince = Math.floor((now.getTime() - (joined.getTime())) / (1000 * 60 * 60 * 24));
        }

        let risk: 'low' | 'medium' | 'high' = 'low';
        let score = 100;

        if (daysSince > 60) {
            risk = 'high';
            score = 10;
            churned++;
        } else if (daysSince > 30) {
            risk = 'medium';
            score = 40;
            atRisk++;
        } else if (daysSince > 14) {
            score = 70; // Slightly lower score but still low risk
        }

        if (risk !== 'low') {
            risks.push({
                memberId: m.id,
                firstName: (m.user.profile as any)?.firstName,
                lastName: (m.user.profile as any)?.lastName,
                lastAttendance: last ? last.toISOString() : null,
                daysSinceLastAttendance: daysSince,
                riskLevel: risk,
                churnScore: score
            });
        }
    }

    // Sort by highest risk (days inactive)
    risks.sort((a, b) => b.daysSinceLastAttendance - a.daysSinceLastAttendance);

    return c.json({
        totalMembers: members.length,
        atRiskCount: atRisk,
        churnedCount: churned,
        atRiskMembers: risks
    });
});

export default app;
