
import { createDb } from '../db';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { EmailService } from './email';
import { AutomationsService } from './automations';
import { SmsService } from './sms';
import { UsageService } from './pricing';
import { DunningService } from './dunning';
import { FulfillmentService } from './fulfillment';
import { PushService } from './push';
import { WebhookService } from './webhooks';
import { MonitoringService } from './monitoring';
import { Bindings } from '../types';

export class StripeWebhookHandler {
    protected db: ReturnType<typeof createDb>;
    protected monitoring: MonitoringService;

    constructor(private env: Bindings) {
        this.db = createDb(env.DB);
        this.monitoring = new MonitoringService(env);
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
                    break;
            }
        } catch (error: any) {
            console.error(`Error processing Stripe event ${event.type}:`, error);
            await this.monitoring.captureException(error, `Stripe Webhook: ${event.type}`);
            throw error;
        }
    }

    private async handleInvoicePaymentFailed(event: Stripe.Event) {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        const customerId = (invoice as any).customer as string;

        const tenantSub = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeSubscriptionId, subscriptionId)).get();
        if (tenantSub) {
            console.log(`[Billing] Tenant ${tenantSub.slug} payment failed.`);
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
                details: { invoiceId: invoice.id, amount: invoice.amount_due, attempt: invoice.attempt_count },
                createdAt: new Date()
            }).run();

            await this.monitoring.alert(`Tenant Payment Failed: ${tenantSub.id}`, `Tenant ${tenantSub.slug} failed to pay invoice ${invoice.id}.`, { tenantId: tenantSub.id, invoiceId: invoice.id, amount: invoice.amount_due });
            return;
        }

        const sub = await this.db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId)
        });

        if (sub) {
            const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, sub.tenantId) });
            if (tenant) {
                const emailService = this.env.RESEND_API_KEY
                    ? new EmailService(this.env.RESEND_API_KEY, { branding: tenant.branding as any, settings: tenant.settings as any }, undefined, undefined, false, this.db, sub.tenantId)
                    : undefined;
                const dunningService = new DunningService(this.db, sub.tenantId, emailService);
                const member = await this.db.query.tenantMembers.findFirst({ where: eq(schema.tenantMembers.id, sub.memberId as string), with: { user: true } });

                if (member?.user?.email) {
                    const profile = member.user.profile as any || {};
                    const firstName = profile.first_name || profile.firstName || 'Member';
                    await dunningService.handleFailedPayment({ invoiceId: invoice.id || '', customerId, subscriptionId, amountDue: invoice.amount_due, currency: invoice.currency, attemptCount: invoice.attempt_count }, member.user.email, firstName);
                }
            }

            // Dispatch Webhook
            const hook = new WebhookService(this.db, this.env.SVIX_AUTH_TOKEN);
            await hook.dispatch(sub.tenantId, 'payment.failed', {
                subscriptionId,
                customerId: invoice.customer,
                amount: invoice.amount_due,
                currency: invoice.currency,
                attempt: invoice.attempt_count
            });
        }
    }

    private async handleInvoicePaymentSucceeded(event: Stripe.Event) {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (!subscriptionId) return;

        const tenantSub = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeSubscriptionId, subscriptionId)).get();
        if (tenantSub) {
            console.log(`[Billing] Tenant ${tenantSub.slug} payment succeeded.`);
            await this.db.update(schema.tenants).set({ subscriptionStatus: 'active', gracePeriodEndsAt: null, studentAccessDisabled: false }).where(eq(schema.tenants.id, tenantSub.id)).run();
            await this.db.insert(schema.auditLogs).values({ id: crypto.randomUUID(), action: 'billing.payment_succeeded', actorId: 'system', targetId: tenantSub.id, details: { invoiceId: invoice.id, amount: invoice.amount_paid }, createdAt: new Date() }).run();
            return;
        }

        const sub = await this.db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId) });
        if (sub) {
            const dunningService = new DunningService(this.db, sub.tenantId);
            await dunningService.handlePaymentRecovered(subscriptionId);
            const hook = new WebhookService(this.db);
            await hook.dispatch(sub.tenantId, 'payment.succeeded', { subscriptionId, customerId: invoice.customer, amount: invoice.amount_paid, currency: invoice.currency });
        }
    }

    private async handleCheckoutSessionCompleted(event: Stripe.Event) {
        const session = event.data.object as Stripe.Checkout.Session;
        const { metadata, amount_total } = session;

        if (metadata && metadata.tenantId) {
            const fulfillment = new FulfillmentService(this.db, this.env.RESEND_API_KEY, this.env);

            if (metadata.packId) {
                await fulfillment.fulfillPackPurchase(metadata, session.payment_intent as string, amount_total || 0);
                const hook = new WebhookService(this.db, this.env.SVIX_AUTH_TOKEN);
                await hook.dispatch(metadata.tenantId, 'pack.purchased', { packId: metadata.packId, userId: metadata.userId, amount: amount_total, currency: session.currency });
            }

            if (metadata.type === 'gift_card_purchase') {
                const amount = parseInt(metadata.amount || '0');
                if (amount > 0) await fulfillment.fulfillGiftCardPurchase(metadata, session.payment_intent as string, amount);
            }

            if (metadata.usedGiftCardId && metadata.creditApplied) {
                const creditUsed = parseInt(metadata.creditApplied);
                if (creditUsed > 0) await fulfillment.redeemGiftCard(metadata.usedGiftCardId, creditUsed, session.payment_intent as string);
            }

            await this.db.insert(schema.auditLogs).values({ id: crypto.randomUUID(), action: 'stripe.checkout_completed', actorId: 'system', tenantId: metadata.tenantId, targetId: session.id, details: { type: metadata.type || (metadata.packId ? 'pack_purchase' : 'unknown'), amount: amount_total, packId: metadata.packId, metadata }, createdAt: new Date() }).run();

            if (metadata.type === 'membership_purchase') {
                const subscriptionId = session.subscription as string;
                const customerId = session.customer as string;
                if (subscriptionId) {
                    await fulfillment.fulfillMembershipPurchase(metadata, subscriptionId, customerId);
                    const hook = new WebhookService(this.db, this.env.SVIX_AUTH_TOKEN);
                    await hook.dispatch(metadata.tenantId, 'subscription.created', { planId: metadata.planId, subscriptionId, customerId, userId: metadata.userId });
                }
            }

            if (metadata.type === 'recording_purchase') {
                await fulfillment.fulfillVideoPurchase({ classId: metadata.recordingId, tenantId: metadata.tenantId, userId: metadata.userId, couponId: metadata.couponId }, session.payment_intent as string, amount_total || 0, session.customer_details?.email || undefined);
            }

            try {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, metadata.tenantId) });
                if (tenant) {
                    const { autoService } = await this.getTenantServices(tenant);
                    let userId = null;
                    const stripeCustomerId = session.customer as string;
                    const email = session.customer_details?.email;

                    if (stripeCustomerId) {
                        const u = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, stripeCustomerId) });
                        userId = u?.id || (email ? (await this.db.query.users.findFirst({ where: eq(schema.users.email, email) }))?.id : null);
                    } else if (email) {
                        userId = (await this.db.query.users.findFirst({ where: eq(schema.users.email, email) }))?.id;
                    }

                    if (userId) {
                        await autoService.dispatchTrigger('product_purchase', { userId, email: email || '', firstName: session.customer_details?.name?.split(' ')[0] || 'Friend', data: { amount: amount_total, metadata } });
                    }
                }
            } catch (e) { console.error('Failed to trigger product_purchase', e); }
        }
    }

    private async handleSubscriptionUpdated(event: Stripe.Event) {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        const studentSub = await this.db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, subscription.id) });
        if (studentSub) {
            await this.db.update(schema.subscriptions).set({ status: subscription.status as any, currentPeriodEnd: new Date((subscription as any).current_period_end * 1000) }).where(eq(schema.subscriptions.id, studentSub.id)).run();
            const hook = new WebhookService(this.db, this.env.SVIX_AUTH_TOKEN);
            await hook.dispatch(studentSub.tenantId, 'subscription.updated', { subscriptionId: subscription.id, status: subscription.status, planId: (subscription as any).metadata?.planId });
        }

        if (subscription.cancel_at_period_end && tenantId) {
            try {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
                if (tenant) {
                    const { autoService } = await this.getTenantServices(tenant);
                    const user = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, subscription.customer as string) });
                    if (user) await autoService.dispatchTrigger('subscription_canceled', { userId: user.id, email: user.email, firstName: (user.profile as any)?.firstName, data: { planId: subscription.metadata?.planId, subscriptionId: subscription.id } });
                }
            } catch (e) { console.error('Failed to trigger subscription_canceled', e) }
        } else if (tenantId) {
            const { getTierFromPriceId } = await import('../constants/stripe');
            const newTier = getTierFromPriceId(subscription.items?.data?.[0]?.price?.id, this.env);
            if (newTier) {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
                if (tenant && tenant.stripeSubscriptionId === subscription.id && tenant.tier !== newTier) {
                    await this.db.update(schema.tenants).set({ tier: newTier }).where(eq(schema.tenants.id, tenantId)).run();
                    if (this.env.RESEND_API_KEY) {
                        try {
                            const { emailService } = await this.getTenantServices(tenant);
                            const owner = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, subscription.customer as string) });
                            if (owner) {
                                const profile = owner.profile as any || {};
                                await emailService.sendSubscriptionUpdateOwner(owner.email, `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Valued Customer', newTier);
                                await emailService.sendTenantUpgradeAlert(this.env.PLATFORM_ADMIN_EMAIL || 'slichti@gmail.com', { name: tenant.name, slug: tenant.slug, oldTier: tenant.tier, newTier });
                            }
                        } catch (e) { console.error("Failed to send tier upgrade notifications", e); }
                    }
                }
            }
        }
    }

    private async handleSubscriptionDeleted(event: Stripe.Event) {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        const tenantSub = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeSubscriptionId, subscription.id)).get();
        if (tenantSub) {
            await this.db.update(schema.tenants).set({ subscriptionStatus: 'canceled' }).where(eq(schema.tenants.id, tenantSub.id)).run();
            await this.db.insert(schema.auditLogs).values({ id: crypto.randomUUID(), action: 'billing.subscription_canceled', actorId: 'system', targetId: tenantSub.id, details: { subscriptionId: subscription.id }, createdAt: new Date() }).run();
            return;
        }

        const studentSub = await this.db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, subscription.id) });
        if (studentSub) {
            await this.db.update(schema.subscriptions).set({ status: 'canceled', currentPeriodEnd: new Date() }).where(eq(schema.subscriptions.id, studentSub.id)).run();
            const hook = new WebhookService(this.db, this.env.SVIX_AUTH_TOKEN);
            await hook.dispatch(studentSub.tenantId, 'subscription.deleted', { subscriptionId: subscription.id, planId: (subscription as any).metadata?.planId });
        }

        if (tenantId) {
            try {
                const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
                if (tenant) {
                    const { autoService } = await this.getTenantServices(tenant);
                    const user = await this.db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, subscription.customer as string) });
                    if (user) await autoService.dispatchTrigger('subscription_canceled', { userId: user.id, email: user.email, firstName: (user.profile as any)?.firstName, data: { planId: subscription.metadata?.planId } });
                }
            } catch (e) { console.error('Failed to trigger subscription_terminated', e); }
        }
    }

    private async handleChargeRefunded(event: Stripe.Event) {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        if (!paymentIntentId) return;

        const pack = await this.db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.stripePaymentId, paymentIntentId)).get();
        if (pack) {
            await this.db.update(schema.purchasedPacks).set({ status: 'refunded', remainingCredits: 0 }).where(eq(schema.purchasedPacks.id, pack.id)).run();
            await this.db.insert(schema.auditLogs).values({ id: crypto.randomUUID(), action: 'pack.refunded', actorId: 'system', targetType: 'member_pack', tenantId: pack.tenantId, targetId: pack.id, details: { paymentIntentId, amount: charge.amount_refunded }, createdAt: new Date() }).run();
        }

        const giftCard = await this.db.select().from(schema.giftCards).where(eq(schema.giftCards.stripePaymentId, paymentIntentId)).get();
        if (giftCard) {
            await this.db.update(schema.giftCards).set({ status: 'disabled', currentBalance: 0 }).where(eq(schema.giftCards.id, giftCard.id)).run();
            await this.db.insert(schema.auditLogs).values({ id: crypto.randomUUID(), action: 'gift_card.refunded', actorId: 'system', targetType: 'gift_card', tenantId: giftCard.tenantId, targetId: giftCard.id, details: { paymentIntentId, amount: charge.amount_refunded }, createdAt: new Date() }).run();
        }
    }

    private async handleAccountUpdated(event: Stripe.Event) {
        const account = event.data.object as Stripe.Account;
        if (account.details_submitted) {
            const tenant = await this.db.select().from(schema.tenants).where(eq(schema.tenants.stripeAccountId, account.id)).get();
            if (tenant) console.log(`Connect Account ${account.id} (Tenant ${tenant.slug}) updated.`);
        }
    }

    private async handleCapabilityUpdated(event: Stripe.Event) {
        const capability = event.data.object as Stripe.Capability;
        if (capability.account) {
            const tenant = await this.db.query.tenants.findFirst({ where: eq(schema.tenants.stripeAccountId, capability.account as string) });
            if (tenant) {
                await this.db.insert(schema.auditLogs).values({ id: crypto.randomUUID(), action: 'stripe.capability_updated', actorId: 'system', targetId: tenant.id, details: { capability: capability.id, status: capability.status }, createdAt: new Date() }).run();
                if (capability.status !== 'active') await this.monitoring.alert(`Stripe Capability Alert: ${tenant.slug}`, `Capability ${capability.id} is ${capability.status}.`, { tenantId: tenant.id, capability: capability.id, status: capability.status });
            }
        }
    }

    private async getTenantServices(tenant: typeof schema.tenants.$inferSelect) {
        const usageService = new UsageService(this.db, tenant.id);
        const resendKey = (tenant.resendCredentials as any)?.apiKey || this.env.RESEND_API_KEY;
        const emailService = new EmailService(resendKey, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, usageService, !!(tenant.resendCredentials as any)?.apiKey, this.db, tenant.id);
        const smsService = new SmsService(tenant.twilioCredentials as any, { ...this.env, DB: this.env.DB } as any, usageService, this.db, tenant.id);
        const pushService = new PushService(this.db, tenant.id);
        const autoService = new AutomationsService(this.db, tenant.id, emailService, smsService, pushService);
        return { usageService, emailService, smsService, pushService, autoService };
    }
}
