import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BookingService } from '../services/bookings';
import { StripeService } from '../services/stripe';
import { createDb } from '../db';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@studio/db/src/schema'; // Added schema import
import { eq, sql } from 'drizzle-orm'; // Added eq import

describe('Booking Lifecycle Integration', () => {
    let db: any; // typed as ReturnType<typeof drizzle> but avoiding complex type import for now
    let sqlite: Database.Database;
    let env: any;

    let tenantId = 'test_integration_tenant';
    let userId = 'user_integration_test';
    let classId = 'class_integration_test';
    let creditPackId = 'pack_integration_test';

    beforeEach(async () => {
        // Setup In-Memory SQLite DB
        sqlite = new Database(':memory:');
        db = drizzle(sqlite, { schema });

        // Create Tables manually (minimal schema for test)
        // 1. Tenants
        sqlite.exec(`CREATE TABLE tenants (
            id TEXT PRIMARY KEY, slug TEXT, name TEXT, owner_id TEXT, tier TEXT, status TEXT, created_at INTEGER,
            custom_domain TEXT, branding TEXT, mobile_app_config TEXT, settings TEXT, custom_field_definitions TEXT,
            stripe_account_id TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, current_period_end INTEGER,
            marketing_provider TEXT DEFAULT 'system', resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT,
            currency TEXT DEFAULT 'usd', zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT,
            google_credentials TEXT, slack_credentials TEXT, google_calendar_credentials TEXT, resend_audience_id TEXT,
            subscription_status TEXT DEFAULT 'active', is_public INTEGER DEFAULT 0,
            sms_usage INTEGER DEFAULT 0, email_usage INTEGER DEFAULT 0, streaming_usage INTEGER DEFAULT 0,
            sms_limit INTEGER, email_limit INTEGER, streaming_limit INTEGER, billing_exempt INTEGER DEFAULT 0,
            storage_usage INTEGER DEFAULT 0, member_count INTEGER DEFAULT 0, instructor_count INTEGER DEFAULT 0,
            last_billed_at INTEGER, archived_at INTEGER, grace_period_ends_at INTEGER, student_access_disabled INTEGER DEFAULT 0,
            aggregator_config TEXT
        )`);

        // 2. Users
        sqlite.exec(`CREATE TABLE users (
            id TEXT PRIMARY KEY, email TEXT, profile TEXT, is_platform_admin INTEGER DEFAULT 0, role TEXT DEFAULT 'user',
            phone TEXT, dob INTEGER, address TEXT, is_minor INTEGER DEFAULT 0,
            stripe_customer_id TEXT, stripe_account_id TEXT, mfa_enabled INTEGER DEFAULT 0, push_token TEXT,
            last_active_at INTEGER, last_location TEXT, created_at INTEGER
        )`);

        // 3. Tenant Members
        sqlite.exec(`CREATE TABLE tenant_members (
            id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, profile TEXT, settings TEXT, custom_fields TEXT,
            status TEXT DEFAULT 'active', joined_at INTEGER, churn_score INTEGER DEFAULT 100, churn_status TEXT DEFAULT 'safe',
            last_churn_check INTEGER, engagement_score INTEGER DEFAULT 50, last_engagement_calc INTEGER,
            sms_consent INTEGER DEFAULT 0, sms_consent_at INTEGER, sms_opt_out_at INTEGER
        )`);

        // 4. Classes
        sqlite.exec(`CREATE TABLE classes (
            id TEXT PRIMARY KEY, tenant_id TEXT, instructor_id TEXT, location_id TEXT, series_id TEXT,
            title TEXT, description TEXT, start_time INTEGER, duration_minutes INTEGER,
            capacity INTEGER, waitlist_capacity INTEGER DEFAULT 10, price INTEGER DEFAULT 0, member_price INTEGER,
            currency TEXT DEFAULT 'usd', payroll_model TEXT, payroll_value INTEGER, type TEXT DEFAULT 'class',
            allow_credits INTEGER DEFAULT 1, included_plan_ids TEXT, zoom_meeting_url TEXT, zoom_meeting_id TEXT,
            zoom_password TEXT, zoom_enabled INTEGER DEFAULT 0, thumbnail_url TEXT, cloudflare_stream_id TEXT,
            recording_status TEXT, video_provider TEXT DEFAULT 'offline', livekit_room_name TEXT, livekit_room_sid TEXT,
            status TEXT DEFAULT 'active', min_students INTEGER DEFAULT 1, auto_cancel_threshold INTEGER,
            auto_cancel_enabled INTEGER DEFAULT 0, google_event_id TEXT, created_at INTEGER
        )`);

        // 5. Bookings
        sqlite.exec(`CREATE TABLE bookings (
            id TEXT PRIMARY KEY, class_id TEXT, member_id TEXT, status TEXT DEFAULT 'confirmed',
            attendance_type TEXT DEFAULT 'in_person', checked_in_at INTEGER, is_guest INTEGER DEFAULT 0,
            guest_name TEXT, guest_email TEXT, spot_number TEXT, waitlist_position INTEGER,
            waitlist_notified_at INTEGER, payment_method TEXT, used_pack_id TEXT, external_source TEXT,
            external_id TEXT, created_at INTEGER
        )`);

        // 6. Class Pack Definitions
        sqlite.exec(`CREATE TABLE class_pack_definitions (
            id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, price INTEGER DEFAULT 0, credits INTEGER,
            expiration_days INTEGER, image_url TEXT, vod_enabled INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
            created_at INTEGER
        )`);

        // 7. Purchased Packs
        // Note: Drizzle schema column names: initialCredits -> initial_credits, remainingCredits -> remaining_credits, price -> purchased_price_cents, memberPrice -> member_price
        sqlite.exec(`CREATE TABLE purchased_packs (
            id TEXT PRIMARY KEY, tenant_id TEXT, member_id TEXT, pack_definition_id TEXT,
            initial_credits INTEGER, remaining_credits INTEGER, purchased_price_cents INTEGER DEFAULT 0, member_price INTEGER,
            status TEXT DEFAULT 'active', stripe_payment_id TEXT, expires_at INTEGER, created_at INTEGER
        )`);

        // 8. Audit Logs
        sqlite.exec(`CREATE TABLE audit_logs (
            id TEXT PRIMARY KEY, actor_id TEXT, tenant_id TEXT, action TEXT, target_id TEXT,
            target_type TEXT, details TEXT, ip_address TEXT, country TEXT, city TEXT, region TEXT, created_at INTEGER
        )`);

        // 9. Progress Metrics (Required for checkIn logic)
        sqlite.exec(`CREATE TABLE progress_metric_definitions (
            id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, created_at INTEGER
        )`);

        // 10. Referral Rewards
        sqlite.exec(`CREATE TABLE referral_rewards (
            id TEXT PRIMARY KEY, tenant_id TEXT, referrer_user_id TEXT, referred_user_id TEXT,
            status TEXT DEFAULT 'pending', amount INTEGER,
            currency TEXT DEFAULT 'usd', paid_at INTEGER, created_at INTEGER
        )`);

        // 11. Marketing Automations
        sqlite.exec(`CREATE TABLE marketing_automations (
            id TEXT PRIMARY KEY, tenant_id TEXT, trigger_event TEXT, trigger_condition TEXT,
            template_id TEXT, audience_filter TEXT, subject TEXT, content TEXT,
            is_enabled INTEGER DEFAULT 0, metadata TEXT, timing_type TEXT DEFAULT 'immediate',
            timing_value INTEGER DEFAULT 0, delay_hours INTEGER DEFAULT 0,
            channels TEXT, recipients TEXT, coupon_config TEXT,
            created_at INTEGER, updated_at INTEGER
        )`);

        // 12. Automation Logs
        sqlite.exec(`CREATE TABLE automation_logs (
            id TEXT PRIMARY KEY, tenant_id TEXT, automation_id TEXT, user_id TEXT, channel TEXT,
            triggered_at INTEGER, metadata TEXT
        )`);

        // Setup mock environment
        env = {
            RESEND_API_KEY: 'mock_resend_key'
        };

        // Mock external services to avoid real API calls during tests
        // Note: StripeService methods might be creating instances or static, checking implementation
        // For now, we mock the class methods we expect to use.
        // vi.spyOn(StripeService.prototype, 'createCheckoutSession').mockResolvedValue({ url: 'http://mock-checkout' } as any);

        vi.spyOn(StripeService.prototype, 'refundPayment').mockResolvedValue({
            id: 're_mock_123',
            status: 'succeeded'
        } as any);

        // Seed necessary data
        // 1. Create Tenant
        await db.insert(schema.tenants).values({
            id: tenantId,
            name: 'Integration Test Studio',
            slug: 'integration-test',
            // ownerId removed from schema? No, it's not in the shared schema view I got but schema.ts had it?
            // Re-checking schema.ts provided earlier...
            // Line 697 ended... wait, I need to check if ownerId is effectively in schema or if I used it in previous insert.
            // Previous insert used ownerId: 'owner_123'.
            // Let's assume it exists or I'll fix it if error.
            // Actually schema.ts line 4-64 did NOT show ownerId in tenants table! 
            // It showed 'stripeAccountId', 'stripeCustomerId' etc. 
            // Let's remove ownerId to be safe.
            tier: 'growth',
            status: 'active',
            createdAt: new Date()
        }).run();

        // 2. Create User
        await db.insert(schema.users).values({
            id: userId,
            email: 'test@integration.com',
            // firstName: 'Integration', // Removed based on schema
            // lastName: 'Tester', // Removed based on schema
            profile: { firstName: 'Integration', lastName: 'Tester' }, // Profile JSON
            createdAt: new Date()
        }).run();

        // 2b. Create Tenant Member (Required for Booking Service lookup)
        await db.insert(schema.tenantMembers).values({
            id: 'member_' + userId, // predictable ID
            tenantId,
            userId,
            status: 'active',
            joinedAt: new Date()
        }).run();

        // 3. Create Class
        await db.insert(schema.classes).values({
            id: classId,
            tenantId,
            title: 'Integration Yoga', // Changed name to title
            startTime: new Date(Date.now() + 86400000), // Tomorrow
            durationMinutes: 60, // Changed duration to durationMinutes
            capacity: 10,
            price: 1000, // Using price instead of creditsCost? Need to verify logic for credit cost.
            // If class allows credits, does it have a cost? 
            // Schema has 'allowCredits' boolean. 
            // Logic likely assumes 1 credit per class unless specified?
            // Or maybe 'price' maps to credits if using credits?
            // Let's check schema again.
            allowCredits: true,
            instructorId: 'instr_mock', // Dummy instructor
            locationId: 'loc_mock',
            createdAt: new Date()
        }).run();

        // 4. Create Credit Pack
        await db.insert(schema.classPackDefinitions).values({ // Changed string to schema ref
            id: creditPackId,
            tenantId,
            name: '10 Pack',
            credits: 10,
            price: 10000,
            active: true,
            expirationDays: 30,
            createdAt: new Date()
        }).run();

        // 5. Gift Credits to User (Create a purchased pack)
        await db.insert(schema.purchasedPacks).values({
            id: 'pack_init_' + userId,
            tenantId,
            memberId: 'member_' + userId,
            packDefinitionId: creditPackId,
            initialCredits: 10,
            remainingCredits: 10,
            price: 0,
            status: 'active',
            createdAt: new Date()
        }).run();
    });

    afterEach(() => {
        vi.clearAllMocks();
        if (sqlite && sqlite.open) sqlite.close();
    });

    it('Scenario 1: Successful Booking & Cancellation Flow (Credits)', async () => {
        // Step 1: Book a Class using Credits
        const bookingService = new BookingService(db, env);

        // We simulate a booking request. 
        // In a real integration test, we might call the API endpoint via app.request()
        // But here we test the Service logic directly to ensure it handles DB correctly.

        // We need to ensure the user has a valid user object in DB (done in setup)
        // And a valid class (done in setup)

        const booking = await bookingService.createBooking(classId, 'member_' + userId, 'in_person');

        expect(booking).toBeDefined();
        expect(booking.status).toBe('confirmed'); // Assuming 'confirmed' is correct status

        // Verify User Credits Deducted
        // Credits are likely deducted from the active pack. 
        // We need to find the pack we just created/assigned.
        const pack = await db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.memberId, 'member_' + userId)).get();
        if (!pack) throw new Error('Pack not found');

        // Verify User Credits Deducted
        // Logic implemented: 1 credit deducted.
        expect(pack.remainingCredits).toBe(9); // Started with 10 (from setup), cost 1

        // Step 2: Cancel Booking
        await bookingService.cancelBooking(booking.id);

        // Verify Booking Status
        const cancelledBooking = await db.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id)).get();
        expect(cancelledBooking.status).toBe('cancelled');

        // Verify Credits Refunded
        const refundedPack = await db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.id, pack.id)).get();
        expect(refundedPack.remainingCredits).toBe(10); // Should be back to 10
    });

    it('Scenario 2: Credit Pack Purchase Flow (Simulated Webhook)', async () => {
        // Step 1: Simulate Stripe Webhook for Checkout Session Completed (Pack Purchase)
        // structure matches stripe-webhook.ts handleCheckoutSessionCompleted
        const webhookEvent = {
            id: 'evt_test_123',
            object: 'event',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_123',
                    object: 'checkout.session',
                    payment_intent: 'pi_mock_pack_purchase',
                    amount_total: 10000,
                    metadata: {
                        tenantId,
                        type: 'pack_purchase',
                        packId: creditPackId,
                        userId: userId,
                        memberId: 'member_' + userId // Added memberId
                    },
                    customer_details: {
                        email: 'test@integration.com',
                        name: 'Integration Tester'
                    }
                }
            }
        } as any;

        // We need to import the Webhook Handler to invoke it
        const { StripeWebhookHandler } = await import('../services/stripe-webhook');

        // Create a Test Handler that exposes/overrides the DB property
        class TestStripeHandler extends StripeWebhookHandler {
            constructor(env: any, testDb: any) {
                super(env);
                this.db = testDb; // Override with our in-memory DB
            }
        }

        const handler = new TestStripeHandler(env, db);

        // In this scenario, we start with 10 credits (from beforeEach).
        // The webhook should add ANOTHER pack with 10 credits.
        // Total credits = 10 (initial) + 10 (new) = 20 across all packs?
        // Or strictly check the NEW pack creation.

        await handler.process(webhookEvent);

        // Step 2: Verify NEW Pack Created
        const packs = await db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.memberId, 'member_' + userId)).all();
        // Should have 2 packs now: 1 from beforeEach, 1 from webhook
        expect(packs.length).toBe(2);

        const totalCredits = packs.reduce((sum: number, p: { remainingCredits: number }) => sum + p.remainingCredits, 0);
        expect(totalCredits).toBe(20);

        // Step 3: Audit Log check (Optional but good)
        // We can check if an audit log was created for 'stripe.checkout_completed'
        const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'stripe.checkout_completed')).all();
        expect(logs.length).toBeGreaterThan(0);
        const details = logs[0].details as any; // Drizzle parses JSON automatically
        expect(details.packId).toBe(creditPackId);
    });
});
