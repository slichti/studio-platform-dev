import { DrizzleD1Database } from 'drizzle-orm/d1';
import { tenantMembers, bookings, subscriptions } from '@studio/db/src/schema'; // Updated path
import { eq, and, lte, desc, getTableColumns, sql } from 'drizzle-orm';

export class ChurnService {
    constructor(private db: DrizzleD1Database<any>, private tenantId: string) { }

    /**
     * Calculates churn risk score for a member (0-100).
     * Higher score = LOWER risk (Safe). Lower score = HIGH risk (Churning).
     * Factors:
     * - Days since last booking
     * - Subscription status
     * - Attendance rate
     */
    async calculateChurnScore(memberId: string): Promise<number> {
        let score = 100;

        // 1. Get Member & Subscription Status
        const member = await this.db.select()
            .from(tenantMembers)
            .where(and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, this.tenantId)))
            .get();

        if (!member) return 0; // Unknown member is risky? Or just ignore.

        // 2. Check Subscription
        const activeSub = await this.db.select()
            .from(subscriptions)
            .where(and(
                eq(subscriptions.memberId, memberId),
                eq(subscriptions.status, 'active')
            ))
            .get();

        if (!activeSub) {
            score -= 50; // No active sub = very high risk / already churned logic
        }

        // 3. Last Activity (Booking)
        const lastBooking = await this.db.select()
            .from(bookings)
            .where(and(
                eq(bookings.memberId, memberId),
                eq(bookings.status, 'confirmed')
            ))
            .orderBy(desc(bookings.createdAt)) // Approximation using created check
            // Better: use class startTime if available, but joins are expensive. 
            // Let's assume booking creation is a proxy for engagement activity.
            .limit(1)
            .get();

        if (lastBooking) {
            const daysSince = lastBooking.createdAt
                ? (Date.now() - new Date(lastBooking.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                : 999;

            if (daysSince > 30) score -= 40;
            else if (daysSince > 14) score -= 20;
        } else {
            score -= 30; // Never booked
        }

        return Math.max(0, score);
    }

    async getAtRiskMembers(threshold = 50) {
        // This is expensive to run on-demand for all.
        // Ideally, we run this via a Cron or just for a paginated list.
        // For MVP/Report, we'll fetch members and calculate.
        // Optimally: stored column 'churnScore' in tenantMembers updated nightly.

        // For now, let's query members with low `churnScore` (assuming we update it).
        // Since we aren't running the update job yet, this might return defaults.
        // Let's implement the LIVE calculation for the top X members or query by stored score?
        // The schema has `churnScore` default 100.

        return await this.db.select()
            .from(tenantMembers)
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                lte(tenantMembers.churnScore, threshold)
            ))
            .limit(50)
            .all();
    }

    /**
     * Nightly job to update scores
     */
    async updateAllScores() {
        const members = await this.db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, this.tenantId)).all();
        for (const m of members) {
            const score = await this.calculateChurnScore(m.id);
            let status: 'safe' | 'at_risk' | 'churned' = 'safe';
            if (score < 30) status = 'churned';
            else if (score < 60) status = 'at_risk';

            await this.db.update(tenantMembers)
                .set({
                    churnScore: score,
                    churnStatus: status,
                    lastChurnCheck: new Date()
                })
                .where(eq(tenantMembers.id, m.id))
                .execute();
        }
    }
}
