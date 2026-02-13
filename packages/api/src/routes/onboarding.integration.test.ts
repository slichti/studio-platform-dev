import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import onboardingApp from './onboarding';
import classesApp from './classes.schedules';
import { createDb } from '../db';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { OpenAPIHono } from '@hono/zod-openapi';
import { HonoContext } from '../types';

let mockDb: any;
vi.mock('../db', () => ({
    createDb: () => mockDb
}));

describe('Onboarding Flow Debugging', () => {
    let sqlite: Database.Database;
    let env: any;
    const testUserId = 'user_test_onboarding';

    beforeEach(async () => {
        sqlite = new Database(':memory:');
        mockDb = drizzle(sqlite, { schema });

        // Minimal schema setup
        sqlite.exec(`CREATE TABLE tenants (
            id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, custom_domain TEXT UNIQUE, branding TEXT,
            mobile_app_config TEXT, settings TEXT, custom_field_definitions TEXT, stripe_account_id TEXT, stripe_customer_id TEXT,
            stripe_subscription_id TEXT, current_period_end INTEGER, marketing_provider TEXT DEFAULT 'system' NOT NULL,
            resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT, currency TEXT DEFAULT 'usd' NOT NULL,
            zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT, google_credentials TEXT,
            slack_credentials TEXT, google_calendar_credentials TEXT, resend_audience_id TEXT, status TEXT DEFAULT 'active' NOT NULL,
            tier TEXT DEFAULT 'launch' NOT NULL, subscription_status TEXT DEFAULT 'active' NOT NULL, is_public INTEGER DEFAULT 0 NOT NULL,
            sms_usage INTEGER DEFAULT 0 NOT NULL, email_usage INTEGER DEFAULT 0 NOT NULL, streaming_usage INTEGER DEFAULT 0 NOT NULL,
            sms_limit INTEGER, email_limit INTEGER, streaming_limit INTEGER, billing_exempt INTEGER DEFAULT 0 NOT NULL,
            storage_usage INTEGER DEFAULT 0 NOT NULL, member_count INTEGER DEFAULT 0 NOT NULL, instructor_count INTEGER DEFAULT 0 NOT NULL,
            last_billed_at INTEGER, archived_at INTEGER, grace_period_ends_at INTEGER, student_access_disabled INTEGER DEFAULT 0 NOT NULL,
            aggregator_config TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE users (
            id TEXT PRIMARY KEY, email TEXT NOT NULL, profile TEXT, is_platform_admin INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user' NOT NULL, phone TEXT, dob INTEGER, address TEXT, is_minor INTEGER DEFAULT 0,
            stripe_customer_id TEXT, stripe_account_id TEXT, mfa_enabled INTEGER DEFAULT 0, push_token TEXT,
            last_active_at INTEGER, last_location TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE tenant_members (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, profile TEXT, settings TEXT,
            custom_fields TEXT, status TEXT DEFAULT 'active' NOT NULL, joined_at INTEGER DEFAULT (strftime('%s', 'now')),
            churn_score INTEGER DEFAULT 100, churn_status TEXT DEFAULT 'safe',
            last_churn_check INTEGER, engagement_score INTEGER DEFAULT 50, last_engagement_calc INTEGER,
            sms_consent INTEGER DEFAULT 0, sms_consent_at INTEGER, sms_opt_out_at INTEGER
        )`);
        sqlite.exec(`CREATE TABLE tenant_roles (
            id TEXT PRIMARY KEY, member_id TEXT NOT NULL,
            role TEXT NOT NULL, custom_role_id TEXT,
            permissions TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE platform_plans (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT,
            stripe_price_id_monthly TEXT, stripe_price_id_annual TEXT, monthly_price_cents INTEGER,
            annual_price_cents INTEGER, trial_days INTEGER DEFAULT 14 NOT NULL, features TEXT NOT NULL,
            highlight INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER
        )`);
        sqlite.exec(`CREATE TABLE class_series (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT NOT NULL, location_id TEXT,
            title TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL,
            price INTEGER DEFAULT 0, currency TEXT DEFAULT 'usd', recurrence_rule TEXT NOT NULL, 
            valid_from INTEGER NOT NULL, valid_until INTEGER, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE classes (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT, location_id TEXT, series_id TEXT,
            title TEXT NOT NULL, description TEXT, start_time INTEGER NOT NULL, duration_minutes INTEGER NOT NULL,
            capacity INTEGER, waitlist_capacity INTEGER DEFAULT 10, price INTEGER DEFAULT 0, member_price INTEGER,
            currency TEXT DEFAULT 'usd' NOT NULL, payroll_model TEXT, payroll_value INTEGER, type TEXT DEFAULT 'class' NOT NULL,
            allow_credits INTEGER DEFAULT 1, included_plan_ids TEXT, zoom_meeting_url TEXT, zoom_meeting_id TEXT,
            zoom_password TEXT, zoom_enabled INTEGER DEFAULT 0, thumbnail_url TEXT, cloudflare_stream_id TEXT,
            recording_status TEXT, video_provider TEXT DEFAULT 'offline', livekit_room_name TEXT, livekit_room_sid TEXT,
            status TEXT DEFAULT 'active' NOT NULL, min_students INTEGER DEFAULT 1, auto_cancel_threshold INTEGER,
            auto_cancel_enabled INTEGER DEFAULT 0, google_event_id TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);

        // Seed necessary data
        await mockDb.insert(schema.users).values({
            id: testUserId,
            email: 'test@example.com',
            profile: { firstName: 'Test', lastName: 'User' },
            createdAt: new Date()
        }).run();

        await mockDb.insert(schema.platformPlans).values({
            id: 'launch_plan',
            name: 'Launch',
            slug: 'launch',
            features: JSON.stringify([]),
            trialDays: 14,
            active: true,
            createdAt: new Date()
        }).run();

        env = {
            DB: { prepare: () => ({ bind: () => ({ all: () => [], get: () => null, run: () => ({ meta: { changes: 0 } }) }) }) } as any,
            ENCRYPTION_SECRET: 'test_encryption_secret_must_be_32_chars_long_!!',
            ENVIRONMENT: 'test'
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Scenario 1: Full Onboarding Flow (302/403 Check)', async () => {
        const app = new OpenAPIHono<HonoContext>();
        // Mock Auth
        app.use(async (c, next) => {
            c.set('auth', { userId: testUserId, claims: { email_verified: true } });
            await next();
        });
        app.route('/onboarding', onboardingApp);

        // 1. Create Studio
        const createRes = await app.request('/onboarding/studio', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Test Studio',
                slug: 'test-studio',
                tier: 'launch'
            }),
            headers: { 'Content-Type': 'application/json' }
        }, env);

        expect(createRes.status).toBe(201);
        const { tenant } = await createRes.json() as any;
        const tenantId = tenant.id;

        // 2. Immediately call list_members (to simulate middleware behavior)
        const member = await mockDb.query.tenantMembers.findFirst({
            where: and(eq(schema.tenantMembers.userId, testUserId), eq(schema.tenantMembers.tenantId, tenantId))
        });
        expect(member).toBeDefined();

        // 3. Quick Start
        const quickStartRes = await app.request('/onboarding/quick-start', {
            method: 'POST',
            body: JSON.stringify({
                tenantId,
                name: 'Updated Studio Name',
                timezone: 'America/New_York',
                branding: { primaryColor: '#000000' }
            }),
            headers: { 'Content-Type': 'application/json' }
        }, env);

        expect(quickStartRes.status).toBe(200);
    });

    it('Scenario 2: Classes API 400 Check - Investigating validation failure', async () => {
        const tenantId = crypto.randomUUID();
        await mockDb.insert(schema.tenants).values({
            id: tenantId,
            name: 'Test Studio',
            slug: 'test-classes-bug',
            tier: 'launch',
            status: 'active'
        }).run();

        const memberId = 'member_123';
        await mockDb.insert(schema.tenantMembers).values({
            id: memberId,
            tenantId,
            userId: testUserId,
            status: 'active'
        }).run();

        await mockDb.insert(schema.tenantRoles).values({
            id: crypto.randomUUID(),
            memberId,
            role: 'owner'
        }).run();

        const testApp = new OpenAPIHono<HonoContext>();
        testApp.use(async (c: any, next: any) => {
            c.set('tenant', { id: tenantId, slug: 'test-classes-bug', tier: 'launch' } as any);
            c.set('can', (p: string) => true);
            c.set('auth', { userId: testUserId });
            await next();
        });
        testApp.route('/', classesApp);

        // Attempt creation with exact parameters from user's manual comment
        const res = await testApp.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: "Morning Flow",
                startTime: "2026-02-13T09:00",
                durationMinutes: 60,
                capacity: 10,
                price: 2000
            })
        }, env);

        if (res.status !== 201) {
            const body = await res.json();
            console.log('REPRODUCED ERROR:', res.status, JSON.stringify(body, null, 2));
        }

        expect(res.status).toBe(201);
    });
});
