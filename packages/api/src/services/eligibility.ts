import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { membershipPlans, subscriptions, bookings, tenantMembers } from '@studio/db/src/schema';

export class EligibilityService {
    private db: DrizzleD1Database<typeof schema>;
    private tenantId: string;

    constructor(db: DrizzleD1Database<typeof schema>, tenantId: string) {
        this.db = db;
        this.tenantId = tenantId;
    }

    /**
     * Checks if a member is eligible for a specific membership plan.
     */
    async isEligible(memberId: string, planId: string): Promise<{ eligible: boolean; reason?: string }> {
        // 1. Fetch Plan Details
        const plan = await this.db.select().from(membershipPlans)
            .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, this.tenantId)))
            .get();

        if (!plan) return { eligible: false, reason: 'Plan not found' };

        // If not an intro offer, anyone can buy it
        if (!plan.isIntroOffer) return { eligible: true };

        // 2. Count existing purchases for this plan by this member
        const purchaseCountResult = await this.db.select({ value: count() })
            .from(subscriptions)
            .where(and(
                eq(subscriptions.memberId, memberId),
                eq(subscriptions.planId, planId),
                eq(subscriptions.tenantId, this.tenantId)
            ))
            .get();

        const purchaseCount = purchaseCountResult?.value || 0;
        const limit = plan.introOfferLimit || 1;

        if (purchaseCount < limit) {
            return { eligible: true };
        }

        // 3. Check for Win-back eligibility if enabled
        if (plan.winBackPeriodDays) {
            // Check last membership activity
            const lastSub = await this.db.select({ end: subscriptions.currentPeriodEnd })
                .from(subscriptions)
                .where(and(
                    eq(subscriptions.memberId, memberId),
                    eq(subscriptions.tenantId, this.tenantId)
                ))
                .orderBy(desc(subscriptions.currentPeriodEnd))
                .limit(1)
                .get();

            // Check last class attendance
            const lastBooking = await this.db.select({ time: bookings.checkedInAt })
                .from(bookings)
                .where(and(
                    eq(bookings.memberId, memberId),
                    sql`${bookings.checkedInAt} IS NOT NULL`
                ))
                .orderBy(desc(bookings.checkedInAt))
                .limit(1)
                .get();

            const now = new Date();
            const winBackThreshold = new Date(now.getTime() - (plan.winBackPeriodDays * 24 * 60 * 60 * 1000));

            let lastActivity: Date | null = null;
            if (lastSub?.end && lastBooking?.time) {
                lastActivity = lastSub.end > lastBooking.time ? lastSub.end : lastBooking.time;
            } else {
                lastActivity = lastSub?.end || lastBooking?.time || null;
            }

            if (!lastActivity || lastActivity < winBackThreshold) {
                // Check if they CURRENTLY have an active membership. 
                // Usually win-back are for those without any active sub.
                const activeSub = await this.db.select({ id: subscriptions.id })
                    .from(subscriptions)
                    .where(and(
                        eq(subscriptions.memberId, memberId),
                        eq(subscriptions.tenantId, this.tenantId),
                        sql`${subscriptions.status} IN ('active', 'trialing', 'past_due')`
                    ))
                    .limit(1)
                    .get();

                if (!activeSub) {
                    return { eligible: true };
                } else {
                    return { eligible: false, reason: 'Member currently has an active subscription' };
                }
            }
        }

        return { eligible: false, reason: 'Intro offer limit reached' };
    }
}
