
import { createDb } from '../db';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { EmailService } from './email'; // Lazy import in methods or top level?
import { AutomationsService } from './automations';
import { SmsService } from './sms';
import { UsageService } from './pricing';
import { DunningService } from './dunning';
import { FulfillmentService } from './fulfillment';
import { PushService } from './push';
import { WebhookService } from './webhooks';
import { Bindings } from '../types';

// Local Bindings removed in favor of shared types

export class StripeWebhookHandler {
    protected db: ReturnType<typeof createDb>;

    constructor(private env: Bindings) {
        this.db = createDb(env.DB);
    }

    async process(event: Stripe.Event) {
        try {
            switch (event.type) {
                case 'invoice.payment_failed':
                    await this.handleInvoicePaymentFailed(event);
                    break;
                case 'invoice.payment_succeeded':
                case 'invoice.paid':
                    await this.handleInvoicePaymentSucceeded(event);
                    break;
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event);
                    break;
                case 'account.updated':
                    await this.handleAccountUpdated(event);
                    break;
                case 'capability.updated':
                    await this.handleCapabilityUpdated(event);
                    break;
                case 'charge.refunded':
                    await this.handleChargeRefunded(event);
                    break;
                default:
                    // console.log(`Unhandled Stripe event: ${event.type}`);
                    break;
            }
        } catch (error) {
            console.error(`Error processing Stripe event ${event.type}:`, error);
            throw error; // Re-throw to ensure idempotency tracking knows it failed?
            // Actually, if we throw, we might retry loop if Stripe retries.
            // If we want to mark as failed/ignore, we should catch.
            // For now, log error is good.
        }
    }

    private async handleInvoicePaymentFailed(event: Stripe.Event) {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        const customerId = (invoice as any).customer as string;

        // 1. Check if PLATFORM TENANT (SaaS Billing)
        const tenantSub = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeSubscriptionId, subscriptionId)).get();
        if (tenantSub) {
            console.log(`[Billing] Tenant ${tenantSub.slug} payment failed. Attempt ${invoice.attempt_count}`);
            const gracePeriodDays = 7;
            const graceDate = new Date();
            graceDate.setDate(graceDate.getDate() + gracePeriodDays);

            await this.db.update(schema.tenants).set({
                subscriptionStatus: 'past_due',
                gracePeriodEndsAt: graceDate
            }).where(eq(schema.tenants.id, tenantSub.id)).run();

            await this.db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: 'billing.payment_failed',
                actorId: 'system',
                targetId: tenantSub.id,
                details: {
                    invoiceId: invoice.id,
                    amount: invoice.amount_due,
                    attempt: invoice.attempt_count
                },
                createdAt: new Date()
            }).run();
            return;
        }

        // 2. Check if STUDENT (Studio Billing)
        const sub = await this.db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId)
        });

        if (sub) {
            const tenant = await this.db.query.tenants.findFirst({
                where: eq(schema.tenants.id, sub.tenantId)
            });

            if (tenant) {
                const emailService = this.env.RESEND_API_KEY
                    ? new EmailService(
                        this.env.RESEND_API_KEY,
                        { branding: tenant.branding as any, settings: tenant.settings as any },
                        undefined,
                        undefined,
                        false,
                        this.db,
                        sub.tenantId
                    )
                    : undefined;

                const dunningService = new DunningService(this.db, sub.tenantId, emailService);

                const member = await this.db.query.tenantMembers.findFirst({
                    where: eq(schema.tenantMembers.id, sub.memberId as string),
                    with: { user: true }
                });

                if (member && member.user && member.user.email) {
                    const profile = member.user.profile as any || {};
                    const firstName = profile.first_name || profile.firstName || 'Member';

                    await dunningService.handleFailedPayment({
                        invoiceId: invoice.id || '',
                        customerId: customerId,
                        subscriptionId: subscriptionId,
                        amountDue: invoice.amount_due,
                        currency: invoice.currency,
                        attemptCount: invoice.attempt_count
                    }, member.user.email, firstName);
                }
            }
        }
    }

    private async handleInvoicePaymentSucceeded(event: Stripe.Event) {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (!subscriptionId) return;

        // 1. Check if TENANT (SaaS Recovery)
        const tenantSub = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeSubscriptionId, subscriptionId)).get();
        if (tenantSub) {
            console.log(`[Billing] Tenant ${tenantSub.slug} payment succeeded. Recovering.`);
            await this.db.update(schema.tenants).set({
                subscriptionStatus: 'active',
                gracePeriodEndsAt: null,
                studentAccessDisabled: false
            }).where(eq(schema.tenants.id, tenantSub.id)).run();

            await this.db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: 'billing.payment_succeeded',
                actorId: 'system',
                targetId: tenantSub.id,
                details: { invoiceId: invoice.id, amount: invoice.amount_paid },
                createdAt: new Date()
            }).run();
            return;
        }

        // 2. Check if STUDENT (Member Recovery)
        const sub = await this.db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId)
        });

        if (sub) {
            const dunningService = new DunningService(this.db, sub.tenantId);
            await dunningService.handlePaymentRecovered(subscriptionId);

            // Dispatch Webhook
            const hook = new WebhookService(this.db);
            await hook.dispatch(sub.tenantId, 'payment.succeeded', {
                subscriptionId,
                customerId: invoice.customer,
                amount: invoice.amount_paid,
                currency: invoice.currency
            });
        }
    }

    private async handleCheckoutSessionCompleted(event: Stripe.Event) {
        const session = event.data.object as Stripe.Checkout.Session;
        const { metadata, amount_total } = session;

        const logMetadata = metadata ? { ...metadata } : {};
        if (logMetadata.message) logMetadata.message = '[REDACTED]';
        console.log(`[Stripe] Checkout Completed: ${session.id} (Metadata: ${JSON.stringify(logMetadata)})`);

        if (metadata && metadata.tenantId) {
            const fulfillment = new FulfillmentService(this.db, this.env.RESEND_API_KEY, this.env);

            // 1. Pack Purchase
            if (metadata.packId) {
                console.log(`[Stripe] Processing Pack Purchase: ${metadata.packId}`);
                await fulfillment.fulfillPackPurchase(metadata, session.payment_intent as string, amount_total || 0);
            }

            // 2. Gift Card Purchase
            if (metadata.type === 'gift_card_purchase') {
                const amount = parseInt(metadata.amount || '0');
                if (amount > 0) {
                    console.log(`[Stripe] Processing Gift Card Purchase: $${amount}`);
                    await fulfillment.fulfillGiftCardPurchase(metadata, session.payment_intent as string, amount);
                }
            }

            // 3. Gift Card Redemption
            if (metadata.usedGiftCardId && metadata.creditApplied) {
                const creditUsed = parseInt(metadata.creditApplied);
                if (creditUsed > 0) {
                    console.log(`[Stripe] Redeeming Gift Card Credit: $${creditUsed}`);
                    await fulfillment.redeemGiftCard(metadata.usedGiftCardId, creditUsed, session.payment_intent as string);
                }
            }

            // [NEW] Audit Log inbound Checkout success
            await this.db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: 'stripe.checkout_completed',
                actorId: 'system',
                tenantId: metadata.tenantId,
                targetId: session.id,
                details: {
                    type: metadata.type || (metadata.packId ? 'pack_purchase' : 'unknown'),
                    amount: amount_total,
                    packId: metadata.packId,
                    metadata: metadata
                },
                createdAt: new Date()
            }).run();

            // 4. Product Purchase (Automation)
            try {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, metadata.tenantId) });
                if (tenant) {
                    const { autoService } = await this.getTenantServices(tenant);

                    let userId = null;
                    const stripeCustomerId = session.customer as string;
                    const email = session.customer_details?.email;

                    if (stripeCustomerId) {
                        const u = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, stripeCustomerId) });
                        if (!u && email) {
                            userId = (await this.db.query.users.findFirst({ where: eq(schema.users.email, email) }))?.id;
                        } else {
                            userId = u?.id;
                        }
                    } else if (email) {
                        userId = (await this.db.query.users.findFirst({ where: eq(schema.users.email, email) }))?.id;
                    }

                    if (userId) {
                        console.log(`[Stripe] Triggering product_purchase automation for User ${userId}`);
                        await autoService.dispatchTrigger('product_purchase', {
                            userId,
                            email: email || '',
                            firstName: session.customer_details?.name?.split(' ')[0] || 'Friend',
                            data: { amount: amount_total, metadata: metadata }
                        });
                    } else {
                        console.warn(`[Stripe] No user found for automation trigger (Email: ${email})`);
                    }
                }
            } catch (e) { console.error('Failed to trigger product_purchase', e); }
        } else {
            console.warn(`[Stripe] Checkout Session missing tenantId metadata. Ignored.`);
        }
    }

    private async handleSubscriptionUpdated(event: Stripe.Event) {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        // 1. Sync Student Subscription Status (if exists in DB)
        // We look up by stripeSubscriptionId first
        const studentSub = await this.db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.stripeSubscriptionId, subscription.id)
        });

        if (studentSub) {
            console.log(`[Stripe] Syncing status for student subscription ${subscription.id} -> ${subscription.status}`);
            await this.db.update(schema.subscriptions).set({
                status: subscription.status as any, // active, past_due, canceled, trialing
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
            }).where(eq(schema.subscriptions.id, studentSub.id)).run();

            // Notify if canceled/past_due? handled by other hooks or dunning
        }

        // 2. Handle Tenant Tier Changes & Cancellation Scheduling
        if (subscription.cancel_at_period_end && tenantId) {
            // Cancellation Scheduled
            try {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
                if (tenant) {
                    const { autoService } = await this.getTenantServices(tenant);
                    const stripeCustomerId = subscription.customer as string;
                    const user = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, stripeCustomerId) });

                    if (user) {
                        await autoService.dispatchTrigger('subscription_canceled', {
                            userId: user.id,
                            email: user.email,
                            firstName: (user.profile as any)?.firstName,
                            data: { planId: subscription.metadata?.planId, subscriptionId: subscription.id }
                        });
                    }
                }
            } catch (e) { console.error('Failed to trigger subscription_canceled', e) }

        } else if (tenantId) {
            const priceId = subscription.items?.data?.[0]?.price?.id;
            const { getTierFromPriceId } = await import('../constants/stripe');

            const newTier = getTierFromPriceId(priceId, this.env);

            if (newTier) {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });

                // Only update if it's a Platform Tenant SaaS subscription (matches tenant's sub ID)
                // Warning: tenantId in metadata might exist for Student subs too!
                // We must verify this is the TENANT'S subscription, not a student's.
                // Tenant SaaS sub ID is on the tenant record.
                if (tenant && tenant.stripeSubscriptionId === subscription.id && tenant.tier !== newTier) {
                    await this.db.update(schema.tenants).set({ tier: newTier }).where(eq(schema.tenants.id, tenantId)).run();
                    console.log(`Updated Tenant ${tenant.slug} tier to ${newTier}`);

                    // Notifications
                    if (this.env.RESEND_API_KEY) {
                        try {
                            const emailService = new EmailService(
                                this.env.RESEND_API_KEY,
                                { branding: tenant.branding as any, settings: tenant.settings as any },
                                undefined,
                                undefined,
                                false,
                                this.db,
                                tenantId
                            );

                            const adminEmail = this.env.PLATFORM_ADMIN_EMAIL || 'slichti@gmail.com';
                            const stripeCustomerId = subscription.customer as string;
                            const owner = await this.db.query.users.findMany({
                                where: eq(schema.users.stripeCustomerId, stripeCustomerId),
                                limit: 1
                            });

                            const ownerUser = owner[0];

                            if (ownerUser) {
                                const profile = ownerUser.profile as any || {};
                                const ownerName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Valued Customer';
                                await emailService.sendSubscriptionUpdateOwner(ownerUser.email, ownerName, newTier);
                                await emailService.sendTenantUpgradeAlert(adminEmail, {
                                    name: tenant.name,
                                    slug: tenant.slug,
                                    oldTier: tenant.tier,
                                    newTier: newTier
                                });
                            }
                        } catch (e) {
                            console.error("Failed to send tier upgrade notifications", e);
                        }
                    }
                }
            }
        }
    }

    private async handleSubscriptionDeleted(event: Stripe.Event) {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        // 1. Check if TENANT SaaS Cancel
        const tenantSub = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeSubscriptionId, subscription.id)).get();
        if (tenantSub) {
            console.log(`[Billing] Tenant ${tenantSub.slug} subscription canceled via Stripe.`);
            await this.db.update(schema.tenants).set({ subscriptionStatus: 'canceled' }).where(eq(schema.tenants.id, tenantSub.id)).run();
            await this.db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: 'billing.subscription_canceled',
                actorId: 'system',
                targetId: tenantSub.id,
                details: { subscriptionId: subscription.id },
                createdAt: new Date()
            }).run();
            return;
        }

        // 2. Check if STUDENT Membership Cancel
        const studentSub = await this.db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.stripeSubscriptionId, subscription.id)
        });

        if (studentSub) {
            console.log(`[Billing] Student subscription ${subscription.id} canceled via Stripe.`);
            await this.db.update(schema.subscriptions).set({
                status: 'canceled',
                currentPeriodEnd: new Date() // End immediately
            }).where(eq(schema.subscriptions.id, studentSub.id)).run();
        }

        // 3. Trigger Automation (if tenantId available)
        if (tenantId) {
            try {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
                if (tenant) {
                    const { autoService } = await this.getTenantServices(tenant);
                    const stripeCustomerId = subscription.customer as string;

                    // User lookup: might be a parent or the user themselves
                    let user = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, stripeCustomerId) });

                    if (user) {
                        await autoService.dispatchTrigger('subscription_terminated', {
                            userId: user.id,
                            email: user.email,
                            firstName: (user.profile as any)?.firstName,
                            data: { planId: subscription.metadata?.planId }
                        });
                    }
                }
            } catch (e) { console.error('Failed to trigger subscription_terminated', e); }
        }
    }

    private async handleChargeRefunded(event: Stripe.Event) {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        if (!paymentIntentId) return;

        // 1. Check if it was a Pack Purchase
        const pack = await this.db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.stripePaymentId, paymentIntentId)).get();
        if (pack) {
            console.log(`[Stripe] Refund detected for Pack ${pack.id}. Reversing credits.`);
            await this.db.update(schema.purchasedPacks)
                .set({ status: 'refunded', remainingCredits: 0 })
                .where(eq(schema.purchasedPacks.id, pack.id))
                .run();

            await this.db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: 'pack.refunded',
                actorId: 'system',
                targetType: 'member_pack',
                tenantId: pack.tenantId,
                targetId: pack.id,
                details: { paymentIntentId, amount: charge.amount_refunded },
                createdAt: new Date()
            }).run();
        }

        // 2. Check if it was a Gift Card Purchase
        const giftCard = await this.db.select().from(schema.giftCards).where(eq(schema.giftCards.stripePaymentId, paymentIntentId)).get();
        if (giftCard) {
            console.log(`[Stripe] Refund detected for Gift Card ${giftCard.id}. Disabling.`);
            await this.db.update(schema.giftCards)
                .set({ status: 'disabled', currentBalance: 0 })
                .where(eq(schema.giftCards.id, giftCard.id))
                .run();

            await this.db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: 'gift_card.refunded',
                actorId: 'system',
                targetType: 'gift_card',
                tenantId: giftCard.tenantId,
                targetId: giftCard.id,
                details: { paymentIntentId, amount: charge.amount_refunded },
                createdAt: new Date()
            }).run();
        }
    }

    private async handleAccountUpdated(event: Stripe.Event) {
        const account = event.data.object as Stripe.Account;
        // Verify if details_submitted changed to true
        if (account.details_submitted) {
            // Find tenant by Stripe Account ID
            const tenant = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeAccountId, account.id)).get();
            if (tenant) {
                // Nothing specific to update on tenant unless we track "onboarding complete" status separately
                console.log(`Connect Account ${account.id} (Tenant ${tenant.slug}) updated. Details submitted: ${account.details_submitted}`);
                // We could potentially activate features here.
            }
        }
    }

    private async handleCapabilityUpdated(event: Stripe.Event) {
        const capability = event.data.object as Stripe.Capability;
        if (capability.account) {
            const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.stripeAccountId, capability.account as string) });
            if (tenant) {
                console.log(`Capability updated for tenant ${tenant.slug}: ${capability.id} status is ${capability.status}`);
                await this.db.insert(schema.auditLogs).values({
                    id: crypto.randomUUID(),
                    action: 'stripe.capability_updated',
                    actorId: 'system',
                    targetId: tenant.id,
                    details: { capability: capability.id, status: capability.status },
                    createdAt: new Date()
                }).run();
            }
        }
    }

    // Helper to init services
    private async getTenantServices(tenant: typeof schema.tenants.$inferSelect) {
        const usageService = new UsageService(this.db, tenant.id);
        const resendKey = (tenant.resendCredentials as any)?.apiKey || this.env.RESEND_API_KEY;
        const isByok = !!(tenant.resendCredentials as any)?.apiKey;
        const emailService = new EmailService(
            resendKey,
            { branding: tenant.branding as any, settings: tenant.settings as any },
            { slug: tenant.slug },
            usageService,
            isByok,
            this.db,
            tenant.id
        );
        const smsService = new SmsService(tenant.twilioCredentials as any, { ...this.env, DB: this.env.DB } as any, usageService, this.db, tenant.id);
        const pushService = new PushService(this.db, tenant.id);
        const autoService = new AutomationsService(this.db, tenant.id, emailService, smsService, pushService);
        return { usageService, emailService, smsService, pushService, autoService };
    }
}
