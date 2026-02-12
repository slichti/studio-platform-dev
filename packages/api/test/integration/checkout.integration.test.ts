import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { StripeWebhookHandler } from '../../src/services/stripe-webhook';
import { setupTestDb } from './test-utils';

// Mock EmailService
vi.mock('../../src/services/email', () => {
    return {
        EmailService: vi.fn().mockImplementation(() => ({
            sendGenericEmail: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendReceipt: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendPackPurchaseConfirmation: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendGiftCardPurchaseConfirmation: vi.fn().mockResolvedValue({ id: 'mock_email_id' })
        }))
    };
});

describe('Checkout Flow (Integration)', () => {
    const TENANT_ID = 'test_tenant_checkout';
    const USER_ID = 'test_user_checkout';
    const MEMBER_ID = 'test_member_checkout';
    const PACK_ID = 'test_pack_1';
    const STRIPE_ACCOUNT_ID = 'acct_test_123';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 1. Create Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            name: 'Checkout Test Studio',
            slug: 'checkout-studio',
            stripeAccountId: STRIPE_ACCOUNT_ID,
            currency: 'usd',
            settings: { timezone: 'UTC' }
        }).onConflictDoNothing().run();

        // 2. Create User
        await db.insert(schema.users).values({
            id: USER_ID,
            email: 'checkout@test.com',
            stripeCustomerId: 'cus_test_123'
        }).onConflictDoNothing().run();

        // 3. Create Pack
        await db.insert(schema.classPackDefinitions).values({
            id: PACK_ID,
            tenantId: TENANT_ID,
            name: '10 Class Pack',
            price: 10000,
            credits: 10,
            active: true
        }).onConflictDoNothing().run();

        // 4. Create Member for User
        await db.insert(schema.tenantMembers).values({
            id: MEMBER_ID,
            tenantId: TENANT_ID,
            userId: USER_ID
        }).onConflictDoNothing().run();

        // 5. Create Membership Plan
        await db.insert(schema.membershipPlans).values({
            id: 'plan_test_1',
            tenantId: TENANT_ID,
            name: 'Unlimited Monthly',
            price: 2900,
            currency: 'usd',
            interval: 'month',
            active: true
        }).onConflictDoNothing().run();
    });

    it('should process a Pack Purchase via Webhook', async () => {
        const handler = new StripeWebhookHandler(env);

        // Mock Checkout Session Completed Event
        const event: any = {
            id: 'evt_test_123',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_session_1',
                    payment_intent: 'pi_test_123',
                    amount_total: 10000,
                    customer: 'cus_test_123',
                    customer_details: { email: 'checkout@test.com', name: 'Test User' },
                    metadata: {
                        tenantId: TENANT_ID,
                        packId: PACK_ID,
                        type: 'pack_purchase',
                        userId: USER_ID,
                        memberId: MEMBER_ID
                    }
                }
            }
        };

        await handler.process(event);

        // Verify Pack Created
        const pack = await db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.stripePaymentId, 'pi_test_123')).get();
        expect(pack).toBeDefined();
        expect(pack?.memberId).toBe(MEMBER_ID);
        expect(pack?.remainingCredits).toBe(10);
        expect(pack?.status).toBe('active');

        // Verify Audit Log
        const log = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, 'cs_test_session_1')).get();
        expect(log).toBeDefined();
        expect(log?.action).toBe('stripe.checkout_completed');
        expect(log?.details).toMatchObject({
            type: 'pack_purchase',
            amount: 10000,
            packId: PACK_ID
        });
    });

    it('should process a Gift Card Purchase via Webhook', async () => {
        const handler = new StripeWebhookHandler(env);

        // Mock Checkout Session Completed Event
        const event: any = {
            id: 'evt_test_gc_1',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_session_gc_1',
                    payment_intent: 'pi_test_gc_1',
                    amount_total: 5000,
                    customer: 'cus_test_123',
                    customer_details: { email: 'checkout@test.com', name: 'Test User' },
                    metadata: {
                        tenantId: TENANT_ID,
                        type: 'gift_card_purchase',
                        userId: USER_ID,
                        amount: 5000,
                        recipientEmail: 'friend@example.com',
                        senderName: 'Test User',
                        message: 'Happy Birthday!'
                    }
                }
            }
        };

        await handler.process(event);

        // Verify Gift Card Created
        const card = await db.select().from(schema.giftCards).where(eq(schema.giftCards.stripePaymentId, 'pi_test_gc_1')).get();
        expect(card).toBeDefined();
        expect(card?.buyerMemberId).toBe(MEMBER_ID);
        expect(card?.initialValue).toBe(5000);
        expect(card?.currentBalance).toBe(5000);
        expect(card?.recipientEmail).toBe('friend@example.com');
        expect(card?.code).toMatch(/^GIFT-/);

        // Verify Transaction
        const tx = await db.select().from(schema.giftCardTransactions).where(eq(schema.giftCardTransactions.giftCardId, card!.id)).get();
        expect(tx).toBeDefined();
        expect(tx?.amount).toBe(5000);
        expect(tx?.type).toBe('purchase');

        // Verify Audit Log
        const log = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, 'cs_test_session_gc_1')).get();
        expect(log).toBeDefined();
        expect(log?.action).toBe('stripe.checkout_completed');
    });

    it('should process a Membership Purchase via Webhook', async () => {
        const handler = new StripeWebhookHandler(env);

        // Mock Checkout Session Completed Event for Subscription
        const event: any = {
            id: 'evt_test_sub_1',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_session_sub_1',
                    payment_intent: null,
                    subscription: 'sub_test_123',
                    amount_total: 2900,
                    customer: 'cus_test_123',
                    customer_details: { email: 'checkout@test.com', name: 'Test User' },
                    mode: 'subscription',
                    metadata: {
                        tenantId: TENANT_ID,
                        type: 'membership_purchase',
                        userId: USER_ID,
                        planId: 'plan_test_1',
                        amount: 2900
                    }
                }
            }
        };

        await handler.process(event);

        // Verify Subscription Created
        const sub = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.stripeSubscriptionId, 'sub_test_123')).get();
        expect(sub).toBeDefined();
        expect(sub?.userId).toBe(USER_ID);
        expect(sub?.planId).toBe('plan_test_1');
        expect(sub?.status).toBe('active');
        expect(sub?.currentPeriodEnd).toBeDefined();

        // Verify Audit Log
        const log = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, 'cs_test_session_sub_1')).get();
        expect(log).toBeDefined();
        expect(log?.action).toBe('stripe.checkout_completed');
    });

    it('should process a Subscription Update via Webhook', async () => {
        const handler = new StripeWebhookHandler(env);

        // Setup Existing Subscription
        await db.insert(schema.subscriptions).values({
            id: 'sub_db_update_1',
            tenantId: TENANT_ID,
            userId: USER_ID,
            planId: 'plan_test_1',
            status: 'active',
            currentPeriodEnd: new Date(),
            stripeSubscriptionId: 'sub_stripe_update_1',
            createdAt: new Date()
        }).run();

        // Mock Subscription Updated Event
        const event: any = {
            id: 'evt_test_sub_update_1',
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_stripe_update_1',
                    status: 'past_due',
                    current_period_end: Math.floor(Date.now() / 1000) + 86400,
                    metadata: { tenantId: TENANT_ID }
                }
            }
        };

        await handler.process(event);

        // Verify Subscription Updated
        const sub = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, 'sub_db_update_1')).get();
        expect(sub).toBeDefined();
        expect(sub?.status).toBe('past_due');
    });
});
