
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';

// Mock Services
vi.mock('../../src/services/email', () => ({
    EmailService: vi.fn().mockImplementation(() => ({
        sendGenericEmail: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
        sendInvitation: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
        syncContact: vi.fn().mockResolvedValue({})
    }))
}));

describe('Quota Integration Tests', () => {
    let db: ReturnType<typeof drizzle<typeof schema>>;

    beforeAll(async () => {
        db = drizzle(env.DB, { schema });
        // Clean up from previous runs
        await env.DB.batch([
            env.DB.prepare(`DROP TABLE IF EXISTS audit_logs`),
            env.DB.prepare(`DROP TABLE IF EXISTS marketing_automations`),
            env.DB.prepare(`DROP TABLE IF EXISTS automation_logs`),
            env.DB.prepare(`DROP TABLE IF EXISTS email_logs`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_members`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_roles`),
            env.DB.prepare(`DROP TABLE IF EXISTS locations`),
            env.DB.prepare(`DROP TABLE IF EXISTS classes`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenants`),
            env.DB.prepare(`DROP TABLE IF EXISTS users`),
            // Re-create using Drizzle schema would be better, but manual is faster if accurate.
            // Actually, let's use the full production table definitions from schema.ts
            env.DB.prepare(`CREATE TABLE tenants (
                id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, custom_domain TEXT,
                branding TEXT, mobile_app_config TEXT, settings TEXT, custom_field_definitions TEXT,
                stripe_account_id TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT,
                current_period_end INTEGER, marketing_provider TEXT DEFAULT 'system',
                resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT,
                currency TEXT DEFAULT 'usd', zoom_credentials TEXT, mailchimp_credentials TEXT,
                zapier_credentials TEXT, google_credentials TEXT, slack_credentials TEXT,
                google_calendar_credentials TEXT, resend_audience_id TEXT,
                status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'launch',
                subscription_status TEXT NOT NULL DEFAULT 'active', is_public INTEGER DEFAULT 0,
                sms_usage INTEGER DEFAULT 0, email_usage INTEGER DEFAULT 0, streaming_usage INTEGER DEFAULT 0,
                sms_limit INTEGER, email_limit INTEGER, streaming_limit INTEGER,
                billing_exempt INTEGER NOT NULL DEFAULT 0, storage_usage INTEGER DEFAULT 0,
                member_count INTEGER DEFAULT 0, instructor_count INTEGER DEFAULT 0,
                last_billed_at INTEGER, archived_at INTEGER, grace_period_ends_at INTEGER,
                student_access_disabled INTEGER DEFAULT 0, aggregator_config TEXT,
                created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE tenant_features (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, feature_key TEXT NOT NULL,
                enabled INTEGER DEFAULT 0, source TEXT DEFAULT 'manual', updated_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE platform_config (key TEXT PRIMARY KEY, value TEXT, enabled INTEGER DEFAULT 1)`),
            env.DB.prepare(`CREATE TABLE custom_roles (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
                description TEXT, permissions TEXT NOT NULL, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE member_custom_roles (
                member_id TEXT NOT NULL, custom_role_id TEXT NOT NULL,
                assigned_at INTEGER, assigned_by TEXT,
                PRIMARY KEY (member_id, custom_role_id)
            )`),
            env.DB.prepare(`CREATE TABLE users (
                id TEXT PRIMARY KEY, email TEXT NOT NULL, profile TEXT, 
                is_platform_admin INTEGER DEFAULT 0, role TEXT NOT NULL DEFAULT 'user',
                phone TEXT, dob INTEGER, address TEXT, is_minor INTEGER DEFAULT 0,
                stripe_customer_id TEXT, stripe_account_id TEXT, mfa_enabled INTEGER DEFAULT 0,
                push_token TEXT, last_active_at INTEGER, last_location TEXT, 
                created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE tenant_members (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
                profile TEXT, settings TEXT, custom_fields TEXT, 
                status TEXT NOT NULL DEFAULT 'active', joined_at INTEGER,
                churn_score INTEGER, churn_status TEXT, last_churn_check INTEGER,
                engagement_score INTEGER, last_engagement_calc INTEGER,
                sms_consent INTEGER DEFAULT 0, sms_consent_at INTEGER, sms_opt_out_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE tenant_roles (
                id TEXT PRIMARY KEY, member_id TEXT NOT NULL, role TEXT NOT NULL,
                custom_role_id TEXT, permissions TEXT, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE locations (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
                address TEXT, layout TEXT, timezone TEXT DEFAULT 'UTC',
                is_primary INTEGER DEFAULT 0, settings TEXT, is_active INTEGER DEFAULT 1,
                created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE classes (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT,
                location_id TEXT, series_id TEXT, title TEXT NOT NULL, description TEXT,
                start_time INTEGER NOT NULL, duration_minutes INTEGER NOT NULL,
                capacity INTEGER, waitlist_capacity INTEGER DEFAULT 10,
                price INTEGER DEFAULT 0, member_price INTEGER, currency TEXT DEFAULT 'usd',
                payroll_model TEXT, payroll_value INTEGER, type TEXT NOT NULL DEFAULT 'class',
                allow_credits INTEGER DEFAULT 1, included_plan_ids TEXT, 
                zoom_meeting_url TEXT, zoom_meeting_id TEXT, zoom_password TEXT, zoom_enabled INTEGER DEFAULT 0,
                thumbnail_url TEXT, cloudflare_stream_id TEXT, recording_status TEXT,
                video_provider TEXT NOT NULL DEFAULT 'offline', livekit_room_name TEXT, livekit_room_sid TEXT,
                status TEXT NOT NULL DEFAULT 'active', min_students INTEGER DEFAULT 1,
                auto_cancel_threshold INTEGER, auto_cancel_enabled INTEGER DEFAULT 0,
                google_event_id TEXT, outlook_event_id TEXT,
                created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE audit_logs (
                id TEXT PRIMARY KEY, actor_id TEXT, tenant_id TEXT,
                action TEXT NOT NULL, target_id TEXT, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE marketing_automations (
                id TEXT PRIMARY KEY, tenant_id TEXT, trigger_event TEXT NOT NULL,
                trigger_condition TEXT, template_id TEXT, audience_filter TEXT,
                subject TEXT NOT NULL, content TEXT, is_enabled INTEGER DEFAULT 0,
                metadata TEXT, timing_type TEXT DEFAULT 'immediate', timing_value INTEGER DEFAULT 0,
                delay_hours INTEGER DEFAULT 0, channels TEXT, recipients TEXT,
                coupon_config TEXT, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE automation_logs (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, automation_id TEXT NOT NULL,
                user_id TEXT NOT NULL, channel TEXT NOT NULL, triggered_at INTEGER,
                metadata TEXT
            )`),
            env.DB.prepare(`CREATE TABLE email_logs (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT,
                recipient_email TEXT NOT NULL, subject TEXT NOT NULL, status TEXT,
                created_at INTEGER
            )`)
        ]);
    });

    it('should block member creation when quota is exceeded', async () => {
        const tenantId = 't_quota_1';
        const ownerId = 'user_owner';

        // 1. Setup Tenant (Launch tier has limits)
        await db.insert(schema.tenants).values({
            id: tenantId,
            slug: 'quota-test',
            name: 'Quota Test',
            tier: 'launch'
        }).run();

        // 2. Setup Owner
        await db.insert(schema.users).values({
            id: ownerId,
            email: 'owner@test.com',
            role: 'owner'
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: 'm_owner',
            tenantId: tenantId,
            userId: ownerId,
            status: 'active'
        }).run();

        await db.insert(schema.tenantRoles).values({
            id: 'r_owner',
            memberId: 'm_owner',
            role: 'owner'
        }).run();

        // 3. Fill up quota (Launch limit is 1 for locations)
        await db.insert(schema.locations).values({
            id: 'loc_1',
            tenantId: tenantId,
            name: 'Existing Location'
        }).run();

        // 4. Try to add 2nd location
        const req = new Request('http://localhost/locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'TEST-AUTH': ownerId
            },
            body: JSON.stringify({ name: 'Second Location' })
        });

        const res = await SELF.fetch(req);
        expect(res.status).toBe(402);
        const data: any = await res.json();
        expect(data.code).toBe('QUOTA_EXCEEDED');
    });

    it('should allow joining a studio via Join API', async () => {
        const tenantId = 't_join_1';
        const userId = 'user_student_1';

        await db.insert(schema.tenants).values({
            id: tenantId,
            slug: 'join-test',
            name: 'Join Test',
            tier: 'launch'
        }).run();

        await db.insert(schema.users).values({
            id: userId,
            email: 'student@test.com'
        }).run();

        const req = new Request(`http://localhost/studios/join-test/join`, {
            method: 'POST',
            headers: {
                'TEST-AUTH': userId
            }
        });

        const res = await SELF.fetch(req);
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.success).toBe(true);
        expect(data.memberId).toBeDefined();

        // Verify membership in DB
        const member = await db.query.tenantMembers.findFirst({
            where: (m, { and, eq }) => and(eq(m.userId, userId), eq(m.tenantId, tenantId))
        });
        expect(member).toBeDefined();
    });

    it('should enforce classes per week quota', async () => {
        const tenantId = 't_class_quota';
        const ownerId = 'user_owner_2';

        await db.insert(schema.tenants).values({
            id: tenantId,
            slug: 'class-quota',
            name: 'Class Quota',
            tier: 'launch'
        }).run();

        await db.insert(schema.users).values({
            id: ownerId,
            email: 'owner2@test.com',
            role: 'owner',
            isPlatformAdmin: 1
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: 'm_owner_2',
            tenantId: tenantId,
            userId: ownerId,
            status: 'active'
        }).run();

        await db.insert(schema.tenantRoles).values({
            id: 'r_owner_2',
            memberId: 'm_owner_2',
            role: 'owner'
        }).run();

        // Launch limit is 5 classes per week.
        const now = new Date();
        const batch = [];
        for (let i = 0; i < 5; i++) {
            batch.push(db.insert(schema.classes).values({
                id: `c_${i}`,
                tenantId: tenantId,
                title: `Class ${i}`,
                startTime: now,
                durationMinutes: 60,
                status: 'active',
                type: 'class'
            }));
        }
        await Promise.all(batch);

        // Try to create 6th class
        const req = new Request('http://localhost/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'TEST-AUTH': ownerId
            },
            body: JSON.stringify({
                title: 'Too Many Classes',
                startTime: new Date().toISOString(),
                durationMinutes: 60
            })
        });

        const res = await SELF.fetch(req);
        expect(res.status).toBe(402);
    });
});
