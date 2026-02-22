
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';
import { referralRewards, referralCodes, giftCards } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';

export class ReferralService {
    constructor(private db: DrizzleD1Database<typeof schema>, private tenantId: string) { }

    async reconcileRefund(referenceId: string, type: string) {
        // If a purchase that triggered a referral reward is refunded, reverse the reward
        // This usually applies to 'pack' or 'membership' purchases
        if (type !== 'pack' && type !== 'membership' && type !== 'pos') return;

        // Find referral rewards linked to this purchase/payment
        // Note: Currently referralRewards doesn't have a direct link to the purchase ID.
        // It's triggered in FulfillmentService when a purchase happens.
        // We'll look for rewards for the referred user around the same time.

        // Actually, we should probably add a paymentId column to referralRewards for precision.
        // For now, let's heuristic it based on the Referred User and Timing.

        // To be safe, I'll lookup the purchase first to get the user and date.
        let userId: string | null = null;
        let purchaseDate: Date | null = null;

        const db = this.db;
        if (type === 'pack') {
            const pack = await db.query.purchasedPacks.findFirst({ where: eq(schema.purchasedPacks.id, referenceId) });
            if (pack) {
                const member = await db.query.tenantMembers.findFirst({ where: eq(schema.tenantMembers.id, pack.memberId!) });
                userId = member?.userId || null;
                purchaseDate = pack.createdAt;
            }
        } else if (type === 'pos') {
            const order = await db.query.posOrders.findFirst({ where: eq(schema.posOrders.id, referenceId) });
            if (order) {
                const member = await db.query.tenantMembers.findFirst({ where: eq(schema.tenantMembers.id, order.memberId!) });
                userId = member?.userId || null;
                purchaseDate = order.createdAt;
            }
        } else if (type === 'membership') {
            const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.id, referenceId) });
            if (sub) {
                const member = await db.query.tenantMembers.findFirst({ where: eq(schema.tenantMembers.id, sub.memberId!) });
                userId = member?.userId || null;
                purchaseDate = sub.createdAt;
            }
        }

        if (userId && purchaseDate) {
            const margin = 10000; // 10 seconds
            const start = new Date(purchaseDate.getTime() - margin);
            const end = new Date(purchaseDate.getTime() + margin);

            const rewards = await db.select().from(referralRewards).where(and(
                eq(referralRewards.referredUserId, userId),
                eq(referralRewards.tenantId, this.tenantId),
                eq(referralRewards.status, 'paid'),
                sql`${referralRewards.paidAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}`
            )).all();

            for (const reward of rewards) {
                console.log(`[Referral Reconciliation] Reversing reward ${reward.id} due to refund.`);

                // Mark reward as reversed
                await db.update(referralRewards)
                    .set({ status: 'reversed' as any })
                    .where(eq(referralRewards.id, reward.id))
                    .run();

                // Deduct from referrer's total earnings stats
                await db.update(referralCodes)
                    .set({ earnings: sql`${referralCodes.earnings} - ${reward.amount}` })
                    .where(and(eq(referralCodes.tenantId, this.tenantId), eq(referralCodes.userId, reward.referrerUserId)))
                    .run();

                // If the reward was account credit (Gift Card), disable it if unused.
                // Heuristic: Gift card created at the same time as reward.
                const relatedCards = await db.select().from(giftCards).where(and(
                    eq(giftCards.tenantId, this.tenantId),
                    sql`${giftCards.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}`,
                    eq(giftCards.status, 'active'),
                    eq(giftCards.currentBalance, giftCards.initialValue)
                )).all();

                for (const card of relatedCards) {
                    await db.update(giftCards)
                        .set({ status: 'disabled', notes: `Reversed due to referral refund` })
                        .where(eq(giftCards.id, card.id))
                        .run();
                }
            }
        }
    }
}
