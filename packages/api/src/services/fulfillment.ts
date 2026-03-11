
import { classes, users, classPackDefinitions, purchasedPacks, giftCards, giftCardTransactions, tenantMembers, tenants, couponRedemptions, referralRewards, referralCodes, subscriptions, membershipPlans, videoPurchases } from '@studio/db/src/schema'; // Ensure these are exported from schema
import { eq, and, sql } from 'drizzle-orm';
import { EmailService } from './email';
import { AutomationsService } from './automations';
import { SmsService } from './sms';
import { PushService } from './push';
import { UsageService } from './pricing';
import { getFirstName } from '../utils/profile';

export class FulfillmentService {
    private env?: any;

    constructor(private db: any, private resendApiKey?: string, env?: any) {
        this.env = env;
    }

    async fulfillPackPurchase(metadata: any, paymentId: string, amount: number) {
        if (!metadata.packId || !metadata.tenantId) return;

        const packDef = await this.db.select().from(classPackDefinitions)
            .where(and(eq(classPackDefinitions.id, metadata.packId), eq(classPackDefinitions.tenantId, metadata.tenantId)))
            .get();

        if (packDef) {
            // Ensure the buyer is an active tenant member (packs/credits should always unlock access).
            let memberId: string | null = metadata.memberId || null;
            if (memberId) {
                const mid = memberId;
                await this.db.update(tenantMembers)
                    .set({ status: 'active' })
                    .where(and(eq(tenantMembers.id, mid), eq(tenantMembers.tenantId, metadata.tenantId)))
                    .run();
            } else if (metadata.userId && metadata.userId !== 'guest') {
                const existing = await this.db.select({ id: tenantMembers.id, status: tenantMembers.status })
                    .from(tenantMembers)
                    .where(and(eq(tenantMembers.userId, metadata.userId), eq(tenantMembers.tenantId, metadata.tenantId)))
                    .get();

                if (existing) {
                    memberId = existing.id;
                    if (existing.status !== 'active') {
                        await this.db.update(tenantMembers)
                            .set({ status: 'active' })
                            .where(eq(tenantMembers.id, existing.id))
                            .run();
                    }
                } else {
                    memberId = crypto.randomUUID();
                    await this.db.insert(tenantMembers).values({
                        id: memberId,
                        tenantId: metadata.tenantId,
                        userId: metadata.userId,
                        status: 'active',
                        joinedAt: new Date()
                    }).run();
                }
            }

            let expiresAt: Date | null = null;
            if (packDef.expirationDays) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + packDef.expirationDays);
            }
            const packPurchaseId = crypto.randomUUID();

            await this.db.insert(purchasedPacks).values({
                id: packPurchaseId,
                tenantId: metadata.tenantId,
                memberId, // Ensure credits are attached to the member when possible
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

            // Notify the user about their new class pack (purchase or admin assignment).
            if ((this.env?.RESEND_API_KEY || this.resendApiKey) && metadata.userId && metadata.userId !== 'guest') {
                try {
                    const tenant = await this.db.select().from(tenants).where(eq(tenants.id, metadata.tenantId)).get();
                    const user = await this.db.query.users.findFirst({ where: eq(users.id, metadata.userId) });

                    if (tenant && user?.email) {
                        const usageService = new UsageService(this.db, metadata.tenantId);
                        const emailService = new EmailService(
                            (this.env?.RESEND_API_KEY || this.resendApiKey) as string,
                            { branding: tenant.branding, settings: tenant.settings },
                            { slug: tenant.slug },
                            usageService
                        );

                        const firstName = getFirstName(user.profile, 'Friend');
                        const isManual = metadata.source === 'admin_assignment';
                        const subject = isManual
                            ? `You've been granted a new class pack at ${tenant.name}`
                            : `Your class pack purchase at ${tenant.name} is complete`;

                        const creditsText = `${packDef.credits} class${packDef.credits === 1 ? '' : 'es'}`;
                        const expiresText = expiresAt
                            ? `This pack expires on <strong>${expiresAt.toLocaleDateString()}</strong>.`
                            : `This pack does not have a set expiration date.`;

                        const originLine = isManual
                            ? `This pack was added to your account by the studio team.`
                            : `This pack was just added to your account from your recent purchase.`;

                        const html = `
                            <h1 style="margin-bottom: 12px;">Hi ${firstName},</h1>
                            <p>${originLine}</p>
                            <p style="margin-top: 16px; margin-bottom: 8px;"><strong>What you received:</strong></p>
                            <ul>
                                <li><strong>Pack:</strong> ${packDef.name}</li>
                                <li><strong>Credits:</strong> ${creditsText}</li>
                                <li><strong>Current balance:</strong> ${packDef.credits} credits</li>
                            </ul>
                            <p style="margin-top: 8px;">${expiresText}</p>
                            <p style="margin-top: 16px;">You can view and use your new credits from your student portal when booking classes.</p>
                        `;

                        await emailService.sendGenericEmail(user.email, subject, html);

                        // Optional: fire automation trigger so studios can build richer flows.
                        const smsService = new SmsService(
                            tenant.twilioCredentials as any,
                            this.env,
                            usageService,
                            this.db,
                            metadata.tenantId
                        );
                        const pushService = new PushService(this.db, metadata.tenantId);
                        const autoService = new AutomationsService(this.db, metadata.tenantId, emailService, smsService, pushService);

                        await autoService.dispatchTrigger('pack_purchased', {
                            userId: user.id,
                            email: user.email,
                            firstName,
                            data: {
                                packId: metadata.packId,
                                packName: packDef.name,
                                credits: packDef.credits,
                                expiresAt,
                                amount,
                                source: metadata.source || (metadata.type === 'pack_purchase' ? 'checkout' : 'unknown'),
                                purchasedPackId: packPurchaseId
                            }
                        });
                    }
                } catch (e) {
                    console.error("[FulfillmentService] Pack purchase notification error", e);
                }
            }

            // [NEW] Referral Check: Does this user have a pending referral for this tenant?
            if (metadata.userId && metadata.userId !== 'guest') {
                try {
                    const pendingReferral = await this.db.query.referralRewards.findFirst({
                        where: and(
                            eq(referralRewards.referredUserId, metadata.userId),
                            eq(referralRewards.tenantId, metadata.tenantId),
                            eq(referralRewards.status, 'pending')
                        )
                    });

                    if (pendingReferral) {
                        // Update Referral to Success/Paid
                        await this.db.update(referralRewards)
                            .set({ status: 'paid', paidAt: new Date() })
                            .where(eq(referralRewards.id, pendingReferral.id))
                            .run();

                        // Accumulate earnings on the code
                        await this.db.update(referralCodes)
                            .set({ earnings: sql`${referralCodes.earnings} + ${pendingReferral.amount}` })
                            .where(and(eq(referralCodes.tenantId, metadata.tenantId), eq(referralCodes.userId, pendingReferral.referrerUserId)))
                            .run();

                        // [NEW] Issue Gift Card for the reward
                        const gcId = crypto.randomUUID();
                        const gcCode = `REF-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

                        // Find referrer memberId
                        const referrerMember = await this.db.select({ id: tenantMembers.id }).from(tenantMembers)
                            .where(and(eq(tenantMembers.userId, pendingReferral.referrerUserId), eq(tenantMembers.tenantId, metadata.tenantId)))
                            .get();

                        if (referrerMember) {
                            await this.db.insert(giftCards).values({
                                id: gcId,
                                tenantId: metadata.tenantId,
                                code: gcCode,
                                initialValue: pendingReferral.amount,
                                currentBalance: pendingReferral.amount,
                                recipientMemberId: referrerMember.id,
                                notes: `Referral Reward for ${metadata.recipientName || 'a friend'}`,
                                status: 'active',
                                createdAt: new Date()
                            }).run();

                            await this.db.insert(giftCardTransactions).values({
                                id: crypto.randomUUID(),
                                giftCardId: gcId,
                                amount: pendingReferral.amount,
                                type: 'purchase',
                                createdAt: new Date()
                            }).run();
                        }

                        // Trigger Automation: referral_conversion_success
                        if (this.env?.RESEND_API_KEY || this.resendApiKey) {
                            const tenant = await this.db.select().from(tenants).where(eq(tenants.id, metadata.tenantId)).get();
                            if (tenant) {
                                const { UsageService } = await import('./pricing');
                                const usageService = new UsageService(this.db, metadata.tenantId);

                                const { EmailService } = await import('./email');
                                const emailService = new EmailService(
                                    (this.env?.RESEND_API_KEY || this.resendApiKey) as string,
                                    { branding: tenant.branding, settings: tenant.settings },
                                    { slug: tenant.slug },
                                    usageService
                                );

                                const { SmsService } = await import('./sms');
                                const smsService = new SmsService(
                                    tenant.twilioCredentials as any,
                                    this.env,
                                    usageService,
                                    this.db,
                                    metadata.tenantId
                                );

                                const { PushService } = await import('./push');
                                const pushService = new PushService(this.db, metadata.tenantId);

                                const { AutomationsService } = await import('./automations');
                                const autoService = new AutomationsService(this.db, metadata.tenantId, emailService, smsService, pushService);

                                // Fetch Referrer Info
                                const referrer = await this.db.query.users.findFirst({
                                    where: eq(users.id, pendingReferral.referrerUserId)
                                });

                                if (referrer) {
                                    await autoService.dispatchTrigger('referral_conversion_success', {
                                        userId: referrer.id,
                                        email: referrer.email,
                                        firstName: (referrer.profile as any)?.firstName || 'Friend',
                                        data: {
                                            referredFirstName: metadata.recipientName || 'Your friend', // metadata might not have it if they just signed up
                                            rewardAmount: pendingReferral.amount
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("[FulfillmentService] Referral Check Error", e);
                }
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
                const buyer = await this.db.select({ id: tenantMembers.id }).from(tenantMembers)
                    .where(and(eq(tenantMembers.userId, metadata.userId), eq(tenantMembers.tenantId, metadata.tenantId)))
                    .get();
                if (buyer) buyerMemberId = buyer.id;
            }

            let recipientMemberId = null;
            const recipientEmail = metadata.recipientEmail;
            if (recipientEmail) {
                const recipientUser = await this.db.select().from(users).where(eq(users.email, recipientEmail)).get();
                if (recipientUser) {
                    const recipientMember = await this.db.select({ id: tenantMembers.id }).from(tenantMembers)
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

    async fulfillMembershipPurchase(metadata: any, subscriptionId: string, customerId: string) {
        if (metadata.type !== 'membership_purchase' || !metadata.planId) return;

        const plan = await this.db.select().from(membershipPlans)
            .where(and(eq(membershipPlans.id, metadata.planId), eq(membershipPlans.tenantId, metadata.tenantId)))
            .get();

        if (!plan) return;

        let memberId = null;
        if (metadata.userId && metadata.userId !== 'guest') {
            const member = await this.db.select({ id: tenantMembers.id, status: tenantMembers.status }).from(tenantMembers)
                .where(and(eq(tenantMembers.userId, metadata.userId), eq(tenantMembers.tenantId, metadata.tenantId)))
                .get();
            if (member) {
                memberId = member.id;
                if (member.status !== 'active') {
                    await this.db.update(tenantMembers)
                        .set({ status: 'active' })
                            .where(eq(tenantMembers.id, member.id))
                        .run();
                }
            } else {
                // If a user buys a membership without an existing member record, create one.
                memberId = crypto.randomUUID();
                await this.db.insert(tenantMembers).values({
                    id: memberId,
                    tenantId: metadata.tenantId,
                    userId: metadata.userId,
                    status: 'active',
                    joinedAt: new Date()
                }).run();
            }
        }

        // Calculate period end based on interval
        const periodEnd = new Date();
        if (plan.interval === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        else if (plan.interval === 'week') periodEnd.setDate(periodEnd.getDate() + 7);
        else periodEnd.setMonth(periodEnd.getMonth() + 1); // Default month

        // Idempotency Check: Don't create if already exists
        const existingSub = await this.db.select().from(subscriptions)
            .where(and(eq(subscriptions.stripeSubscriptionId, subscriptionId), eq(subscriptions.tenantId, metadata.tenantId)))
            .get();
        if (existingSub) {
            console.log(`[Fulfillment] Subscription ${subscriptionId} already exists. Skipping.`);
            return;
        }

        const id = crypto.randomUUID();
        // Explicit insert: only columns that exist in all DBs (0000 + 0073 + 0081)
        await this.db.insert(subscriptions).values({
            id,
            tenantId: metadata.tenantId,
            userId: metadata.userId,
            memberId,
            planId: plan.id,
            status: 'active',
            tier: 'basic',
            currentPeriodEnd: periodEnd,
            stripeSubscriptionId: subscriptionId,
            createdAt: new Date()
        }).run();

        // Send transactional membership email + trigger automations.
        if (this.env?.RESEND_API_KEY || this.resendApiKey) {
            try {
                const tenant = await this.db.select().from(tenants).where(eq(tenants.id, metadata.tenantId)).get();
                if (tenant) {
                    const usageService = new UsageService(this.db, metadata.tenantId);

                    const emailService = new EmailService(
                        (this.env?.RESEND_API_KEY || this.resendApiKey) as string,
                        { branding: tenant.branding, settings: tenant.settings },
                        { slug: tenant.slug },
                        usageService
                    );

                    const smsService = new SmsService(
                        tenant.twilioCredentials as any,
                        this.env,
                        usageService,
                        this.db,
                        metadata.tenantId
                    );

                    const pushService = new PushService(this.db, metadata.tenantId);

                    const autoService = new AutomationsService(this.db, metadata.tenantId, emailService, smsService, pushService);

                    // Fetch User for details
                    let user = null;
                    if (metadata.userId) {
                        user = await this.db.query.users.findFirst({ where: eq(users.id, metadata.userId) });
                    }

                    if (user) {
                        const firstName = getFirstName(user.profile, 'Friend');
                        const isManual = metadata.source === 'admin_assignment';
                        const subject = isManual
                            ? `You've been granted a membership at ${tenant.name}`
                            : `Your membership at ${tenant.name} is active`;

                        const intervalLabel =
                            plan.interval === 'year'
                                ? 'yearly'
                                : plan.interval === 'week'
                                    ? 'weekly'
                                    : plan.interval === 'one_time'
                                        ? 'one-time'
                                        : 'monthly';

                        const html = `
                            <h1 style="margin-bottom: 12px;">Hi ${firstName},</h1>
                            <p>${isManual
                                ? 'The studio team just added a membership to your account.'
                                : 'Thank you for your purchase—your membership is now active.'}</p>
                            <p style="margin-top: 16px; margin-bottom: 8px;"><strong>Membership details:</strong></p>
                            <ul>
                                <li><strong>Plan:</strong> ${plan.name}</li>
                                <li><strong>Billing:</strong> ${intervalLabel}</li>
                                <li><strong>Next renewal:</strong> ${periodEnd.toLocaleDateString()}</li>
                            </ul>
                            <p style="margin-top: 16px;">You can view your membership and manage your account from your student portal.</p>
                        `;

                        await emailService.sendGenericEmail(user.email, subject, html);

                        await autoService.dispatchTrigger('membership_started', {
                            userId: user.id,
                            email: user.email,
                            firstName,
                            data: {
                                planId: plan.id,
                                planName: plan.name,
                                subscriptionId: id,
                                source: metadata.source || (metadata.type === 'membership_purchase' ? 'checkout' : 'unknown')
                            }
                        });
                    }
                }
            } catch (e) {
                console.error("[FulfillmentService] Membership Start Automation Error", e);
            }
        }

        // Audit Log? Handled by WebhookHandler
    }

    async fulfillVideoPurchase(metadata: any, paymentId: string, amount: number, email?: string) {
        let userId = metadata.userId;

        // 1. Handle Guest/Shadow Account Creation
        if ((!userId || userId === 'guest') && email) {
            const existingUser = await this.db.query.users.findFirst({
                where: eq(users.email, email)
            });

            if (existingUser) {
                userId = existingUser.id;
            } else {
                userId = `guest_u_${crypto.randomUUID()}`;
                await this.db.insert(users).values({
                    id: userId,
                    email: email,
                    createdAt: new Date()
                }).run();
            }
        }

        if (!metadata.classId || !metadata.tenantId || !userId) return;

        // 2. Assign Ownership
        await this.db.insert(videoPurchases).values({
            id: crypto.randomUUID(),
            tenantId: metadata.tenantId,
            userId: userId,
            classId: metadata.classId,
            pricePaid: amount,
            stripePaymentId: paymentId,
            createdAt: new Date()
        }).run();

        // 3. CRM Integration: Ensure they are a tenantMember
        const existingMember = await this.db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, userId),
                eq(tenantMembers.tenantId, metadata.tenantId)
            )
        });

        if (!existingMember) {
            await this.db.insert(tenantMembers).values({
                id: `guest_m_${crypto.randomUUID()}`,
                tenantId: metadata.tenantId,
                userId: userId,
                status: 'active',
                joinedAt: new Date()
            }).run();
        }

        // 4. Handle Coupon Redemption (if applied)
        if (metadata.couponId && userId !== 'guest') {
            await this.db.insert(couponRedemptions).values({
                id: crypto.randomUUID(),
                tenantId: metadata.tenantId,
                couponId: metadata.couponId,
                userId: userId,
                orderId: paymentId,
                redeemedAt: new Date()
            }).run();
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
