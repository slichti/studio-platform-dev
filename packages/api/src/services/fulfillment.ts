
import { classes, users, classPackDefinitions, purchasedPacks, giftCards, giftCardTransactions, tenantMembers, tenants, couponRedemptions } from '@studio/db/src/schema'; // Ensure these are exported from schema
import { eq, and, sql } from 'drizzle-orm';
import { EmailService } from './email';

export class FulfillmentService {
    private db: any;
    private resendApiKey?: string;

    constructor(db: any, resendApiKey?: string) {
        this.db = db;
        this.resendApiKey = resendApiKey;
    }

    async fulfillPackPurchase(metadata: any, paymentId: string, amount: number) {
        if (!metadata.packId || !metadata.tenantId) return;

        const packDef = await this.db.select().from(classPackDefinitions)
            .where(and(eq(classPackDefinitions.id, metadata.packId), eq(classPackDefinitions.tenantId, metadata.tenantId)))
            .get();

        if (packDef) {
            let expiresAt: Date | null = null;
            if (packDef.expirationDays) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + packDef.expirationDays);
            }
            await this.db.insert(purchasedPacks).values({
                id: crypto.randomUUID(),
                tenantId: metadata.tenantId,
                memberId: metadata.memberId || null, // Ensure memberId is handled if available, stripe metadata might not have it if guest? Usually it does if logged in.
                packDefinitionId: metadata.packId,
                initialCredits: packDef.credits,
                remainingCredits: packDef.credits,
                price: amount,
                expiresAt,
                createdAt: new Date(),
                stripePaymentId: paymentId
            }).run();

            if (metadata.couponId && metadata.userId && metadata.userId !== 'guest') {
                await this.db.insert(couponRedemptions).values({
                    id: crypto.randomUUID(),
                    tenantId: metadata.tenantId,
                    couponId: metadata.couponId,
                    userId: metadata.userId,
                    orderId: paymentId,
                    redeemedAt: new Date()
                }).run();
            }
        }
    }

    async fulfillGiftCardPurchase(metadata: any, paymentId: string, amount: number) {
        if (metadata.type !== 'gift_card_purchase') return;

        if (amount > 0) {
            const id = crypto.randomUUID();
            const code = `GIFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

            let buyerMemberId = null;
            if (metadata.userId && metadata.userId !== 'guest') {
                const buyer = await this.db.select().from(tenantMembers)
                    .where(and(eq(tenantMembers.userId, metadata.userId), eq(tenantMembers.tenantId, metadata.tenantId)))
                    .get();
                if (buyer) buyerMemberId = buyer.id;
            }

            let recipientMemberId = null;
            const recipientEmail = metadata.recipientEmail;
            if (recipientEmail) {
                const recipientUser = await this.db.select().from(users).where(eq(users.email, recipientEmail)).get();
                if (recipientUser) {
                    const recipientMember = await this.db.select().from(tenantMembers)
                        .where(and(eq(tenantMembers.userId, recipientUser.id), eq(tenantMembers.tenantId, metadata.tenantId)))
                        .get();
                    if (recipientMember) recipientMemberId = recipientMember.id;
                }
            }

            await this.db.insert(giftCards).values({
                id,
                tenantId: metadata.tenantId,
                code,
                initialValue: amount,
                currentBalance: amount,
                buyerMemberId,
                stripePaymentId: paymentId,
                recipientMemberId,
                recipientEmail,
                notes: metadata.message || null,
                status: 'active',
                createdAt: new Date()
            }).run();

            await this.db.insert(giftCardTransactions).values({
                id: crypto.randomUUID(),
                giftCardId: id,
                amount,
                type: 'purchase',
                createdAt: new Date()
            }).run();

            // Receipt Logic (Buyer)
            if (buyerMemberId && this.resendApiKey) {
                const buyerUser = await this.db.select().from(users).where(eq(users.id, metadata.userId)).get();
                // Check Minor
                let isMinor = buyerUser?.isMinor;
                if (buyerUser?.dob && !isMinor) {
                    const ageDifMs = Date.now() - new Date(buyerUser.dob).getTime();
                    const ageDate = new Date(ageDifMs);
                    if (Math.abs(ageDate.getUTCFullYear() - 1970) < 18) {
                        isMinor = true;
                    }
                }

                if (buyerUser && !isMinor && buyerUser.email) {
                    const tenant = await this.db.select().from(tenants).where(eq(tenants.id, metadata.tenantId)).get();
                    if (tenant) {
                        const emailService = new EmailService(this.resendApiKey, tenant as any);
                        await emailService.sendReceipt(buyerUser.email, {
                            amount,
                            currency: tenant.currency || 'usd',
                            description: `Gift Card Purchase ($${(amount / 100).toFixed(2)})`,
                            date: new Date(),
                            paymentMethod: 'Credit Card'
                        });
                    }
                }
            }

            if (recipientEmail && this.resendApiKey) {
                const tenant = await this.db.select().from(tenants).where(eq(tenants.id, metadata.tenantId)).get();
                if (tenant) {
                    const emailService = new EmailService(this.resendApiKey, tenant as any);
                    const senderName = metadata.senderName || 'A friend';
                    // Using waitUntil context if possible, but here we just await to be safe or ignore promise
                    // Webhook handler usually has executionCtx. 
                    // Let's just await it here for simplicity in service.
                    await emailService.sendGenericEmail(
                        recipientEmail,
                        `${senderName} sent you a Gift Card!`,
                        `
                            <h1>You've got credit!</h1>
                            <p><strong>${senderName}</strong> sent you a $${(amount / 100).toFixed(2)} gift card for <strong>${tenant.name}</strong>.</p>
                            ${metadata.message ? `<p><em>"${metadata.message}"</em></p>` : ''}
                            <p>Use this code at checkout:</p>
                            <h2 style="background: #f4f4f5; padding: 10px; border-radius: 8px; display: inline-block;">${code}</h2>
                            <p><a href="https://${tenant.slug}.studio.platform/shop">Visit Store</a></p>
                        `
                    );
                }
            }
        }
    }

    async redeemGiftCard(giftCardId: string, amount: number, referenceId: string) {
        if (amount <= 0) return;

        // Atomic Update: Decrement balance ONLY if it's sufficient
        // Using sql tagging for safe parameter interpolation
        const result = await this.db.run(sql`
            UPDATE gift_cards 
            SET current_balance = current_balance - ${amount}, 
                updated_at = ${new Date().toISOString()}
            WHERE id = ${giftCardId} 
              AND current_balance >= ${amount}
        `);

        if (!result.meta.changes) {
            // If no rows changed, it means balance was insufficient or ID not found
            // Check which one it was for better error
            const exists = await this.db.select().from(giftCards).where(eq(giftCards.id, giftCardId)).get();
            if (!exists) throw new Error("Gift card not found");
            throw new Error("Insufficient balance (Atomic check failed)");
        }

        // Check if balance hit 0 to update status (optional, can do in same query or separate)
        // Since sqlite doesn't return RETURNING easily in D1 without specific syntax or multiple queries,
        // we can assume if it succeeded, we might want to set status='exhausted' if it's 0.
        // But let's run a cleanup query or just leave it 'active' with 0 balance until explicitly closed.
        // Actually, let's try to update status if 0.
        await this.db.run(sql`UPDATE gift_cards SET status = 'exhausted' WHERE id = ${giftCardId} AND current_balance = 0`);

        await this.db.insert(giftCardTransactions).values({
            id: crypto.randomUUID(),
            giftCardId,
            amount: -amount,
            type: 'redemption',
            referenceId,
            createdAt: new Date()
        }).run();
    }
}
