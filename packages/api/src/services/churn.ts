
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { bookings, classes, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, sql, lt, gt, desc } from 'drizzle-orm';
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
    constructor(
        private db: DrizzleD1Database<typeof schema>,
        private tenantId: string,
        private automationsService?: any
    ) { }

    /**
     * Calculates churn risk for a single member based on attendance history, cancellations, and membership status.
     * Enhanced Model (Phase 2)
     */
    async analyzeMemberRisk(memberId: string): Promise<ChurnAnalysisResult> {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // 1. Fetch Member, User, and Active Subscriptions
        const member = await this.db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, this.tenantId)),
            with: {
                user: true,
                memberships: {
                    where: eq(schema.subscriptions.status, 'active')
                }
            }
        });

        if (!member) throw new Error("Member not found");

        // 2. Fetch Bookings (Last 60 days)
        const recentBookings = await this.db.select()
            .from(bookings)
            .innerJoin(classes, eq(bookings.classId, classes.id))
            .where(and(
                eq(bookings.memberId, memberId),
                eq(classes.tenantId, this.tenantId),
                gt(classes.startTime, sixtyDaysAgo)
            ))
            .orderBy(desc(classes.startTime))
            .all();

        // 3. Analyze Attendance
        const confirmedBookings = recentBookings.filter(b => b.bookings.status === 'confirmed');
        const lastBooking = confirmedBookings[0]; // Most recent confirmed

        const lastDate = lastBooking ? new Date(lastBooking.classes.startTime) : null;
        const joinedDate = member.joinedAt || new Date();
        const referenceDate = lastDate || joinedDate;
        const daysSince = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

        // 4. Analyze Frequency Slope (Last 30 vs Preceding 30)
        const period1Count = confirmedBookings.filter(b => new Date(b.classes.startTime) > thirtyDaysAgo).length;
        const period2Count = confirmedBookings.filter(b => {
            const date = new Date(b.classes.startTime);
            return date <= thirtyDaysAgo && date > sixtyDaysAgo;
        }).length;

        // 5. Analyze Cancellations
        const cancelledBookings = recentBookings.filter(b => b.bookings.status === 'cancelled');
        const cancellationRate = recentBookings.length > 0 ? (cancelledBookings.length / recentBookings.length) : 0;

        // 6. Scoring Logic
        let risk: ChurnRiskLevel = 'low';
        let score = 100;

        // Factor A: Recency
        if (daysSince > 45) {
            score -= 60;
        } else if (daysSince > 21) {
            score -= 30;
        } else if (daysSince > 14) {
            score -= 10;
        }

        // Factor B: Cancellations (High cancellation rate is a sign of disengagement)
        if (cancellationRate > 0.5 && recentBookings.length > 2) {
            score -= 20;
        }

        // Factor C: New Member Ghosting
        if (!lastDate && daysSince > 10) {
            score -= 40;
        }

        // Factor D: Frequency Slope (Significant drop-off)
        if (period2Count >= 4 && period1Count <= 1) {
            // Used to come once a week, now almost never
            score -= 25;
        } else if (period2Count > period1Count * 2 && period2Count > 2) {
            // General decline
            score -= 15;
        }

        // Factor E: Membership Expiry & Payment Issues
        const activeSub = member.memberships?.[0];
        if (activeSub) {
            // Payment Failure (Dunning)
            if (activeSub.dunningState && ['warning2', 'warning3', 'failed'].includes(activeSub.dunningState)) {
                score -= 40;
            } else if (activeSub.dunningState === 'warning1') {
                score -= 15;
            }

            // Upcoming Expiry (Risk if not auto-renewing or specific conditions met)
            if (activeSub.currentPeriodEnd) {
                const daysUntilExpiry = Math.floor((activeSub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry >= 0 && daysUntilExpiry < 7) {
                    score -= 10; // Slight nudge risk
                }
            }
        }

        // Normalize
        if (score <= 40) risk = 'high';
        else if (score <= 70) risk = 'medium';

        return {
            memberId,
            riskLevel: risk,
            churnScore: Math.max(0, score),
            daysSinceLastAttendance: daysSince,
            lastAttendanceDate: lastDate
        };
    }

    /**
     * Updates the churn score in the database for a member.
     * Triggers automations if risk escalates to HIGH.
     */
    async updateMemberScore(memberId: string, result: ChurnAnalysisResult) {
        // Fetch current status to check for state change
        const current = await this.db.select({ churnStatus: tenantMembers.churnStatus }).from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();

        let churnStatus: 'safe' | 'at_risk' | 'churned' = 'safe';
        if (result.riskLevel === 'high') churnStatus = 'churned';
        if (result.riskLevel === 'medium') churnStatus = 'at_risk';

        await this.db.update(tenantMembers)
            .set({
                churnScore: result.churnScore,
                churnStatus: churnStatus,
                lastChurnCheck: new Date()
            })
            .where(eq(tenantMembers.id, memberId))
            .run();

        // Trigger Automation if Escaping Safety
        if (current && current.churnStatus !== 'churned' && churnStatus === 'churned') {
            if (this.automationsService) {
                // Fetch User ID
                const m = await this.db.query.tenantMembers.findFirst({
                    where: eq(tenantMembers.id, memberId),
                    with: { user: true }
                });
                if (m && m.user) {
                    await this.automationsService.dispatchTrigger('churn_risk_high', {
                        userId: m.userId,
                        email: m.user.email,
                        firstName: (m.user.profile as any)?.firstName,
                        data: {
                            churnScore: result.churnScore,
                            daysAbsent: result.daysSinceLastAttendance
                        }
                    });
                }
            }
        }
    }

    /**
     * Batch analyzes all active members in the tenant.
     */
    async analyzeAllMembers(): Promise<ChurnAnalysisResult[]> {
        const allMembers = await this.db.query.tenantMembers.findMany({
            where: and(eq(tenantMembers.tenantId, this.tenantId), eq(tenantMembers.status, 'active'))
        });

        if (!allMembers.length) return [];

        const results: ChurnAnalysisResult[] = [];
        for (const m of allMembers) {
            results.push(await this.analyzeMemberRisk(m.id));
        }

        return results;
    }

    /**
     * Updates churn scores for all members in the database.
     * Used by Cron Jobs.
     */
    async updateAllScores() {
        // Optimization: In real prod, this should be chunked.
        const results = await this.analyzeAllMembers();
        for (const r of results) {
            await this.updateMemberScore(r.memberId, r);
        }
    }

    /**
     * Returns members with a churn score below the threshold.
     */
    async getAtRiskMembers(threshold: number) {
        const results = await this.analyzeAllMembers();
        return results.filter(r => r.churnScore < threshold);
    }
}
