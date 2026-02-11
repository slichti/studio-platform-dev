import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { eq, and, sql } from 'drizzle-orm';
import { StripeWebhookHandler } from '../../src/services/stripe-webhook';

// Mock EmailService to avoid resend/selderee dependencies
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


// Minimal Schema for Testing
const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    slug: text('slug'),
    name: text('name'),
    stripeAccountId: text('stripe_account_id'),
    currency: text('currency').default('usd'),
    resendCredentials: text('resend_credentials', { mode: 'json' }),
    twilioCredentials: text('twilio_credentials', { mode: 'json' }),
    branding: text('branding', { mode: 'json' }),
    settings: text('settings', { mode: 'json' })
});

const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email'),
    stripeCustomerId: text('stripe_customer_id')
});

const classPackDefinitions = sqliteTable('class_pack_definitions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    name: text('name'),
    price: integer('price'),
    credits: integer('credits'),
    expirationDays: integer('expiration_days'),
    active: integer('active', { mode: 'boolean' })
});

const purchasedPacks = sqliteTable('purchased_packs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    memberId: text('member_id'),
    packDefinitionId: text('pack_definition_id'),
    initialCredits: integer('initial_credits'),
    remainingCredits: integer('remaining_credits'),
    price: integer('purchased_price_cents'),
    status: text('status'),
    paymentStatus: text('payment_status'),
    stripePaymentId: text('stripe_payment_id')
});

const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    action: text('action'),
    actorId: text('actor_id'),
    tenantId: text('tenant_id'),
    targetId: text('target_id'),
    targetType: text('target_type'),
    details: text('details', { mode: 'json' }),
    ipAddress: text('ip_address'),
    country: text('country'),
    city: text('city'),
    region: text('region'),
    createdAt: integer('created_at', { mode: 'timestamp' })
});

const giftCards = sqliteTable('gift_cards', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    code: text('code'),
    initialValue: integer('initial_value'),
    currentBalance: integer('current_balance'),
    status: text('status'),
    buyerMemberId: text('buyer_member_id'),
    stripePaymentId: text('stripe_payment_id'),
    recipientEmail: text('recipient_email'),
    createdAt: integer('created_at', { mode: 'timestamp' })
});

const giftCardTransactions = sqliteTable('gift_card_transactions', {
    id: text('id').primaryKey(),
    giftCardId: text('gift_card_id'),
    amount: integer('amount'),
    type: text('type'),
    createdAt: integer('created_at', { mode: 'timestamp' })
});

const tenantMembers = sqliteTable('tenant_members', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    userId: text('user_id')
});

const subscriptions = sqliteTable('subscriptions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    userId: text('user_id'),
    memberId: text('member_id'),
    planId: text('plan_id'),
    status: text('status'),
    tier: text('tier').default('basic'),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
    stripeSubscriptionId: text('stripe_subscription_id'),
    canceledAt: integer('canceled_at', { mode: 'timestamp' }),
    dunningState: text('dunning_state'),
    lastDunningAt: integer('last_dunning_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
});



const membershipPlans = sqliteTable('membership_plans', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    name: text('name'),
    price: integer('price'),
    currency: text('currency'),
    interval: text('interval'),
    active: integer('active', { mode: 'boolean' })
});

describe('Checkout Flow (Integration)', () => {
    const TENANT_ID = 'test_tenant_checkout';
    const USER_ID = 'test_user_checkout';
    const MEMBER_ID = 'test_member_checkout';
    const PACK_ID = 'test_pack_1';
    const STRIPE_ACCOUNT_ID = 'acct_test_123';

    beforeAll(async () => {
        const db = drizzle(env.DB);

        // [Manual Migration] Create Tables
        try {
            await db.run(sql`DROP TABLE IF EXISTS tenants`);
            await db.run(sql`DROP TABLE IF EXISTS users`);
            await db.run(sql`DROP TABLE IF EXISTS class_pack_definitions`);
            await db.run(sql`DROP TABLE IF EXISTS purchased_packs`);
            await db.run(sql`DROP TABLE IF EXISTS audit_logs`);
            await db.run(sql`DROP TABLE IF EXISTS gift_cards`);
            await db.run(sql`DROP TABLE IF EXISTS gift_card_transactions`);
            await db.run(sql`DROP TABLE IF EXISTS tenant_members`);
            await db.run(sql`DROP TABLE IF EXISTS subscriptions`);
            await db.run(sql`DROP TABLE IF EXISTS membership_plans`);

            await db.run(sql`CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY, slug TEXT, name TEXT, stripe_account_id TEXT, currency TEXT, 
                resend_credentials TEXT, twilio_credentials TEXT, branding TEXT, settings TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, email TEXT, stripe_customer_id TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS class_pack_definitions (
                id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, price INTEGER, credits INTEGER, expiration_days INTEGER, active INTEGER
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS purchased_packs (
                id TEXT PRIMARY KEY, tenant_id TEXT, member_id TEXT, pack_definition_id TEXT, 
                initial_credits INTEGER, remaining_credits INTEGER, purchased_price_cents INTEGER, 
                status TEXT, payment_status TEXT, stripe_payment_id TEXT, expires_at INTEGER, created_at INTEGER
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY, action TEXT, actor_id TEXT, tenant_id TEXT, target_id TEXT, target_type TEXT, details TEXT, ip_address TEXT, country TEXT, city TEXT, region TEXT, created_at INTEGER
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS gift_cards (
                id TEXT PRIMARY KEY, tenant_id TEXT, code TEXT, initial_value INTEGER, current_balance INTEGER, 
                status TEXT, buyer_member_id TEXT, stripe_payment_id TEXT, recipient_email TEXT, created_at INTEGER, updated_at INTEGER, expiry_date INTEGER, notes TEXT, recipient_member_id TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS gift_card_transactions (
                id TEXT PRIMARY KEY, gift_card_id TEXT, amount INTEGER, type TEXT, reference_id TEXT, created_at INTEGER
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS tenant_members (
                id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, member_id TEXT, plan_id TEXT, 
                status TEXT, tier TEXT DEFAULT 'basic', current_period_end INTEGER, stripe_subscription_id TEXT, 
                canceled_at INTEGER, dunning_state TEXT, last_dunning_at INTEGER, created_at INTEGER
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS membership_plans (
                id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, price INTEGER, currency TEXT, interval TEXT, active INTEGER
            )`);
        } catch (e) {
            console.error("Migration Error:", e);
        }

        // 1. Create Tenant
        await db.insert(tenants).values({
            id: TENANT_ID,
            name: 'Checkout Test Studio',
            slug: 'checkout-studio',
            stripeAccountId: STRIPE_ACCOUNT_ID,
            currency: 'usd',
            settings: { timezone: 'UTC' }
        }).onConflictDoNothing().run();

        // 2. Create User
        await db.insert(users).values({
            id: USER_ID,
            email: 'checkout@test.com',
            stripeCustomerId: 'cus_test_123'
        }).onConflictDoNothing().run();

        // 3. Create Pack
        await db.insert(classPackDefinitions).values({
            id: PACK_ID,
            tenantId: TENANT_ID,
            name: '10 Class Pack',
            price: 10000,
            credits: 10,
            active: true
        }).onConflictDoNothing().run();

        // 4. Create Member for User
        await db.insert(tenantMembers).values({
            id: MEMBER_ID,
            tenantId: TENANT_ID,
            userId: USER_ID
        }).onConflictDoNothing().run();

        // 5. Create Membership Plan
        await db.insert(membershipPlans).values({
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

        const db = drizzle(env.DB, { schema: { purchasedPacks, auditLogs } });

        // Verify Pack Created
        const pack = await db.select().from(purchasedPacks).where(eq(purchasedPacks.stripePaymentId, 'pi_test_123')).get();
        expect(pack).toBeDefined();
        expect(pack?.memberId).toBe(MEMBER_ID);
        expect(pack?.remainingCredits).toBe(10);
        expect(pack?.status).toBe('active');

        // Verify Audit Log
        const log = await db.select().from(auditLogs).where(eq(auditLogs.targetId, 'cs_test_session_1')).get();
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

        const db = drizzle(env.DB, { schema: { giftCards, giftCardTransactions, auditLogs } });

        // Verify Gift Card Created
        const card = await db.select().from(giftCards).where(eq(giftCards.stripePaymentId, 'pi_test_gc_1')).get();
        expect(card).toBeDefined();
        expect(card?.buyerMemberId).toBe(MEMBER_ID); // Should be resolved from tenantMembers
        expect(card?.initialValue).toBe(5000);
        expect(card?.currentBalance).toBe(5000);
        expect(card?.recipientEmail).toBe('friend@example.com');
        expect(card?.code).toMatch(/^GIFT-/);

        // Verify Transaction
        const tx = await db.select().from(giftCardTransactions).where(eq(giftCardTransactions.giftCardId, card!.id)).get();
        expect(tx).toBeDefined();
        expect(tx?.amount).toBe(5000);
        expect(tx?.type).toBe('purchase');

        // Verify Audit Log
        const log = await db.select().from(auditLogs).where(eq(auditLogs.targetId, 'cs_test_session_gc_1')).get();
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
                    payment_intent: null, // Subscriptions might not have PI here directly or it's invoice
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

        const db = drizzle(env.DB, { schema: { subscriptions, membershipPlans, auditLogs } });

        // Verify Subscription Created
        const sub = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, 'sub_test_123')).get();
        expect(sub).toBeDefined();
        expect(sub?.userId).toBe(USER_ID);
        expect(sub?.planId).toBe('plan_test_1');
        expect(sub?.status).toBe('active');
        expect(sub?.currentPeriodEnd).toBeDefined();

        // Verify Audit Log
        const log = await db.select().from(auditLogs).where(eq(auditLogs.targetId, 'cs_test_session_sub_1')).get();
        expect(log).toBeDefined();
        expect(log?.action).toBe('stripe.checkout_completed');
    });

    it('should process a Subscription Update via Webhook', async () => {
        const handler = new StripeWebhookHandler(env);
        const db = drizzle(env.DB);

        // Setup Existing Subscription
        await db.insert(subscriptions).values({
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
                    current_period_end: Math.floor(Date.now() / 1000) + 86400, // +1 day
                    metadata: { tenantId: TENANT_ID }
                }
            }
        };

        await handler.process(event);

        // Verify Subscription Updated
        const sub = await db.select().from(subscriptions).where(eq(subscriptions.id, 'sub_db_update_1')).get();
        expect(sub).toBeDefined();
        expect(sub?.status).toBe('past_due');
    });
});
