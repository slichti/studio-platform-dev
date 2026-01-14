/**
 * Dunning Service
 * 
 * Handles failed payment recovery workflow:
 * - Tracks failed payment attempts
 * - Sends escalating warning emails
 * - Manages subscription pause/cancel
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from 'db/src/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { EmailService } from './email';

export type DunningState = 'active' | 'warning1' | 'warning2' | 'warning3' | 'failed' | 'recovered';

export interface DunningEvent {
    invoiceId: string;
    customerId: string;
    subscriptionId?: string;
    amountDue: number;
    currency: string;
    attemptCount: number;
    nextPaymentAttempt?: Date;
}

export class DunningService {
    private db: DrizzleD1Database<typeof schema>;
    private tenantId: string;
    private emailService: EmailService | null;

    constructor(
        db: DrizzleD1Database<typeof schema>,
        tenantId: string,
        emailService?: EmailService
    ) {
        this.db = db;
        this.tenantId = tenantId;
        this.emailService = emailService || null;
    }

    /**
     * Handle a failed payment event from Stripe
     */
    async handleFailedPayment(event: DunningEvent, memberEmail: string, memberName: string): Promise<void> {
        const { subscriptionId, attemptCount, amountDue, currency } = event;

        if (!subscriptionId) {
            console.log('[Dunning] No subscription ID, skipping dunning flow');
            return;
        }

        // Get current subscription
        const subscription = await this.db.query.subscriptions.findFirst({
            where: and(
                eq(schema.subscriptions.stripeSubscriptionId, subscriptionId),
                eq(schema.subscriptions.tenantId, this.tenantId)
            ),
        });

        if (!subscription) {
            console.log(`[Dunning] Subscription ${subscriptionId} not found in tenant ${this.tenantId}`);
            return;
        }

        // Determine dunning state based on attempt count
        let newState: DunningState;
        if (attemptCount <= 1) {
            newState = 'warning1';
        } else if (attemptCount === 2) {
            newState = 'warning2';
        } else if (attemptCount === 3) {
            newState = 'warning3';
        } else {
            newState = 'failed';
        }

        // Update subscription dunning state
        await this.db.update(schema.subscriptions)
            .set({
                dunningState: newState,
                lastDunningAt: new Date()
            })
            .where(eq(schema.subscriptions.id, subscription.id));

        // Send appropriate email
        if (this.emailService) {
            await this.sendDunningEmail(newState, memberEmail, memberName, amountDue, currency);
        }

        console.log(`[Dunning] Subscription ${subscriptionId} moved to state: ${newState}`);
    }

    /**
     * Handle successful payment after dunning
     */
    async handlePaymentRecovered(subscriptionId: string): Promise<void> {
        const subscription = await this.db.query.subscriptions.findFirst({
            where: and(
                eq(schema.subscriptions.stripeSubscriptionId, subscriptionId),
                eq(schema.subscriptions.tenantId, this.tenantId)
            ),
        });

        if (!subscription) return;

        // Clear dunning state
        await this.db.update(schema.subscriptions)
            .set({
                dunningState: 'recovered',
                lastDunningAt: null
            })
            .where(eq(schema.subscriptions.id, subscription.id));

        console.log(`[Dunning] Subscription ${subscriptionId} recovered`);
    }

    /**
     * Send appropriate dunning email based on state
     */
    private async sendDunningEmail(
        state: DunningState,
        email: string,
        name: string,
        amountDue: number,
        currency: string
    ): Promise<void> {
        if (!this.emailService) return;

        const formattedAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).format(amountDue / 100);

        let subject: string;
        let body: string;

        switch (state) {
            case 'warning1':
                subject = 'Payment Failed - Action Required';
                body = `
                    <p>Hi ${name},</p>
                    <p>We were unable to process your payment of <strong>${formattedAmount}</strong>.</p>
                    <p>Please update your payment method to continue your membership without interruption.</p>
                    <p>We'll automatically retry the payment in a few days.</p>
                    <p>If you have any questions, please reply to this email.</p>
                `;
                break;

            case 'warning2':
                subject = '⚠️ Second Payment Attempt Failed';
                body = `
                    <p>Hi ${name},</p>
                    <p>Our second attempt to collect your payment of <strong>${formattedAmount}</strong> was unsuccessful.</p>
                    <p><strong>Please update your payment method immediately</strong> to avoid service interruption.</p>
                    <p>We will make one final attempt before suspending your membership.</p>
                `;
                break;

            case 'warning3':
                subject = '🚨 Final Notice - Payment Required';
                body = `
                    <p>Hi ${name},</p>
                    <p>This is our final notice regarding your overdue payment of <strong>${formattedAmount}</strong>.</p>
                    <p><strong>Your membership will be suspended unless payment is received.</strong></p>
                    <p>Please update your payment method today to continue enjoying your membership.</p>
                `;
                break;

            case 'failed':
                subject = '❌ Membership Suspended - Payment Failed';
                body = `
                    <p>Hi ${name},</p>
                    <p>Unfortunately, we were unable to collect your payment of <strong>${formattedAmount}</strong> after multiple attempts.</p>
                    <p><strong>Your membership has been suspended.</strong></p>
                    <p>To reactivate your membership, please contact us or update your payment method.</p>
                `;
                break;

            default:
                return;
        }

        try {
            await this.emailService.sendGenericEmail(email, subject, body, true);
            console.log(`[Dunning] Sent ${state} email to ${email}`);
        } catch (e) {
            console.error(`[Dunning] Failed to send email:`, e);
        }
    }

    /**
     * Get subscriptions in dunning state for admin view
     */
    async getFailedPayments(): Promise<any[]> {
        const subscriptions = await this.db.query.subscriptions.findMany({
            where: and(
                eq(schema.subscriptions.tenantId, this.tenantId),
                inArray(schema.subscriptions.dunningState, ['warning1', 'warning2', 'warning3', 'failed'])
            ),
            with: {
                member: {
                    with: {
                        user: true
                    }
                }
            }
        });

        return subscriptions;
    }
}
