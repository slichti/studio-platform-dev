
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { bookings, classes, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, sql, lt, desc } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';

export type ChurnRiskLevel = 'low' | 'medium' | 'high';

export interface ChurnAnalysisResult {
    memberId: string;
    riskLevel: ChurnRiskLevel;
    churnScore: number; // 0-100 (lower is higher risk)
    daysSinceLastAttendance: number;
    lastAttendanceDate: Date | null;
}

export class ChurnService {
    constructor(private db: DrizzleD1Database<typeof schema>, private tenantId: string) { }

    /**
     * Calculates churn risk for a single member based on attendance history.
     */
    async analyzeMemberRisk(memberId: string): Promise<ChurnAnalysisResult> {
        // 1. Get Last Attendance
        const lastBooking = await this.db.select({
            date: classes.startTime
        })
            .from(bookings)
            .innerJoin(classes, eq(bookings.classId, classes.id))
            .where(and(
                eq(bookings.memberId, memberId),
                eq(bookings.status, 'confirmed'),
                eq(classes.tenantId, this.tenantId),
                lt(classes.startTime, new Date())
            ))
            .orderBy(desc(classes.startTime))
            .limit(1)
            .get();

        const member = await this.db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, this.tenantId))
        });

        if (!member) throw new Error("Member not found");

        const lastDate = lastBooking ? new Date(lastBooking.date) : null;
        const joinedDate = member.joinedAt || new Date(); // Fallback
        const referenceDate = lastDate || joinedDate;

        const now = new Date();
        const daysSince = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

        let risk: ChurnRiskLevel = 'low';
        let score = 100;

        // Simple Heuristic Algorithm (Phase 1)
        if (daysSince > 60) {
            risk = 'high';
            score = 10;
        } else if (daysSince > 30) {
            risk = 'medium';
            score = 40;
        } else if (daysSince > 14) {
            score = 70; // Warning zone
        }

        // Penalty for no attendance ever (if joined > 14 days ago)
        if (!lastDate && daysSince > 14) {
            score -= 10;
            if (daysSince > 30) risk = 'high';
        }

        return {
            memberId,
            riskLevel: risk,
            churnScore: score,
            daysSinceLastAttendance: daysSince,
            lastAttendanceDate: lastDate
        };
    }

    /**
     * Updates the churn score in the database for a member.
     */
    async updateMemberScore(memberId: string, result: ChurnAnalysisResult) {
        let churnStatus: 'safe' | 'at_risk' | 'churned' = 'safe';
        if (result.riskLevel === 'high') churnStatus = 'churned'; // or 'at_risk' depending on definition. Let's map high -> churned for now as "Likely Churned"
        if (result.riskLevel === 'medium') churnStatus = 'at_risk';

        await this.db.update(tenantMembers)
            .set({
                churnScore: result.churnScore,
                churnStatus: churnStatus,
                lastChurnCheck: new Date()
            })
            .where(eq(tenantMembers.id, memberId))
            .run();
    }

    /**
     * Batch analyzes all active members in the tenant.
     */
    async analyzeAllMembers(): Promise<ChurnAnalysisResult[]> {
        // Optimization: Fetch all needed data in bulk instead of N+1
        const allMembers = await this.db.query.tenantMembers.findMany({
            where: and(eq(tenantMembers.tenantId, this.tenantId), eq(tenantMembers.status, 'active'))
        });

        if (!allMembers.length) return [];

        const lastBookings = await this.db.select({
            memberId: bookings.memberId,
            lastDate: sql<string>`MAX(${classes.startTime})`
        })
            .from(bookings)
            .innerJoin(classes, eq(bookings.classId, classes.id))
            .where(and(
                eq(bookings.status, 'confirmed'),
                eq(classes.tenantId, this.tenantId),
                lt(classes.startTime, new Date())
            ))
            .groupBy(bookings.memberId)
            .all();

        const lastMap = new Map<string, Date>();
        lastBookings.forEach(lb => {
            if (lb.lastDate) lastMap.set(lb.memberId, new Date(lb.lastDate));
        });

        const now = new Date();
        const results: ChurnAnalysisResult[] = [];

        for (const m of allMembers) {
            const last = lastMap.get(m.id) || null;
            const referencetime = last ? last.getTime() : (m.joinedAt ? m.joinedAt.getTime() : now.getTime());

            const daysSince = Math.floor((now.getTime() - referencetime) / (1000 * 60 * 60 * 24));

            let risk: ChurnRiskLevel = 'low';
            let score = 100;

            if (daysSince > 60) {
                risk = 'high';
                score = 10;
            } else if (daysSince > 30) {
                risk = 'medium';
                score = 40;
            } else if (daysSince > 14) {
                score = 70;
            }

            if (!last && daysSince > 14) {
                score -= 10;
                if (daysSince > 30) risk = 'high';
            }

            results.push({
                memberId: m.id,
                riskLevel: risk,
                churnScore: Math.max(0, score),
                daysSinceLastAttendance: daysSince,
                lastAttendanceDate: last
            });
        }

        return results;
    }

    /**
     * Updates churn scores for all members in the database.
     * Used by Cron Jobs.
     */
    async updateAllScores() {
        const results = await this.analyzeAllMembers();
        await Promise.all(results.map(r => this.updateMemberScore(r.memberId, r)));
    }

    /**
     * Returns members with a churn score below the threshold.
     * Used by ReportService.
     */
    async getAtRiskMembers(threshold: number) {
        const results = await this.analyzeAllMembers();
        return results.filter(r => r.churnScore < threshold);
    }
}
