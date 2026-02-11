
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';

// Helper to minimize boilerplate
const createRequest = (method: string, path: string, headers: Record<string, string> = {}, body?: any) => {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined
    });
};

describe('Security Regression Tests', () => {
    let db: ReturnType<typeof drizzle<typeof schema>>;

    const TENANT_ID = 'tenant_123';
    const SLUG = 'security-studio';
    const OWNER_ID = 'user_owner';
    const STUDENT_A_ID = 'user_student_a'; // Attacker
    const STUDENT_B_ID = 'user_student_b'; // Victim
    const BOOKING_ID = 'booking_b';

    beforeAll(async () => {
        db = drizzle(env.DB, { schema });

        // Standardized Schema Init for Integration Tests
        await env.DB.batch([
            env.DB.prepare(`DROP TABLE IF EXISTS audit_logs`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_members`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_roles`),
            env.DB.prepare(`DROP TABLE IF EXISTS bookings`),
            env.DB.prepare(`DROP TABLE IF EXISTS uploads`),
            env.DB.prepare(`DROP TABLE IF EXISTS classes`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenants`),
            env.DB.prepare(`DROP TABLE IF EXISTS users`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_features`),
            env.DB.prepare(`DROP TABLE IF EXISTS custom_roles`),
            env.DB.prepare(`DROP TABLE IF EXISTS member_custom_roles`),

            env.DB.prepare(`CREATE TABLE custom_roles (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
                description TEXT, permissions TEXT NOT NULL, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE member_custom_roles (
                member_id TEXT NOT NULL, custom_role_id TEXT NOT NULL,
                assigned_at INTEGER, assigned_by TEXT,
                PRIMARY KEY (member_id, custom_role_id)
            )`),

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
            env.DB.prepare(`CREATE TABLE bookings (
                id TEXT PRIMARY KEY, class_id TEXT NOT NULL, member_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed', attendance_type TEXT DEFAULT 'in_person',
                waitlist_position INTEGER, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE uploads (
                id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, file_key TEXT NOT NULL,
                file_url TEXT NOT NULL, size_bytes INTEGER NOT NULL, mime_type TEXT NOT NULL,
                original_name TEXT, uploaded_by TEXT, title TEXT, description TEXT,
                tags TEXT, created_at INTEGER
            )`)
        ]);

        // Seeding
        const tableInfo = await env.DB.prepare('PRAGMA table_info(tenants)').all();
        console.log('TENANTS TABLE INFO:', tableInfo.results);

        await env.DB.batch([
            env.DB.prepare(`INSERT INTO tenants (id, slug, name, settings, status) VALUES (?, ?, ?, ?, ?)`).bind(TENANT_ID, SLUG, 'Security Studio', JSON.stringify({ enableStudentRegistration: true }), 'active'),
            env.DB.prepare(`INSERT INTO users (id, email, role) VALUES (?, ?, ?)`).bind(STUDENT_A_ID, 'student.a@test.com', 'user'),
            env.DB.prepare(`INSERT INTO users (id, email, role) VALUES (?, ?, ?)`).bind(STUDENT_B_ID, 'student.b@test.com', 'user'),
            env.DB.prepare(`INSERT INTO users (id, email, role) VALUES (?, ?, ?)`).bind(OWNER_ID, 'owner@test.com', 'owner'),

            env.DB.prepare('INSERT INTO tenant_members (id, tenant_id, user_id, status) VALUES (?, ?, ?, ?)').bind('member_a', TENANT_ID, STUDENT_A_ID, 'active'),
            env.DB.prepare('INSERT INTO tenant_members (id, tenant_id, user_id, status) VALUES (?, ?, ?, ?)').bind('member_b', TENANT_ID, STUDENT_B_ID, 'active'),
            env.DB.prepare('INSERT INTO tenant_members (id, tenant_id, user_id, status) VALUES (?, ?, ?, ?)').bind('member_owner', TENANT_ID, OWNER_ID, 'active'),

            env.DB.prepare(`INSERT INTO tenant_roles (id, member_id, role) VALUES (?, ?, ?)`).bind('tr_owner', 'member_owner', 'owner'),
            env.DB.prepare(`INSERT INTO tenant_roles (id, member_id, role) VALUES (?, ?, ?)`).bind('tr_a', 'member_a', 'student'),
            env.DB.prepare(`INSERT INTO tenant_roles (id, member_id, role) VALUES (?, ?, ?)`).bind('tr_b', 'member_b', 'student'),

            env.DB.prepare(`INSERT INTO classes (id, tenant_id, title, start_time, duration_minutes) VALUES (?, ?, ?, ?, ?)`).bind('class_1', TENANT_ID, 'Security Class', Date.now(), 60),
            env.DB.prepare(`INSERT INTO bookings (id, class_id, member_id, status, attendance_type) VALUES (?, ?, ?, ?, ?)`).bind('booking_a', 'class_1', 'member_a', 'confirmed', 'in_person'),
            env.DB.prepare(`INSERT INTO bookings (id, class_id, member_id, status, attendance_type) VALUES (?, ?, ?, ?, ?)`).bind('booking_b', 'class_1', 'member_b', 'confirmed', 'in_person'),
            env.DB.prepare(`INSERT INTO uploads (id, tenant_id, file_key, file_url, size_bytes, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('upload_1', TENANT_ID, `tenants/${SLUG}/waivers/sensitive.pdf`, `https://cdn.test/sensitive.pdf`, 1024, 'application/pdf', STUDENT_B_ID)
        ]);

        await env.R2.put(`tenants/${SLUG}/waivers/sensitive.pdf`, 'SECRET CONTENT');
    });

    it('Scenario 1: IDOR - Student A cannot delete Student B booking', async () => {
        const req = createRequest('DELETE', `/bookings/booking_b`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Id': TENANT_ID
        });

        const res = await SELF.fetch(req);
        if (res.status === 500) console.log('Scenario 1 Error:', await res.json());
        expect(res.status).toBe(403);
    });

    it('Scenario 2: IDOR - Student A cannot update Student B booking', async () => {
        const req = createRequest('PATCH', `/bookings/booking_b`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Id': TENANT_ID
        }, { attendanceType: 'virtual' });

        const res = await SELF.fetch(req);
        if (res.status === 500) console.log('Scenario 2 Error:', await res.json());
        expect(res.status).toBe(403);
    });

    it('Scenario 3: RBAC - Student cannot delete Studio Integrations', async () => {
        const req = createRequest('DELETE', `/studios/${TENANT_ID}/integrations/google`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Id': TENANT_ID
        });

        const res = await SELF.fetch(req);
        if (res.status === 500) console.log('Scenario 3 Error:', await res.json());
        expect(res.status).toBe(403);
    });

    it('Scenario 4: Valid Access - Student A CAN delete their own booking', async () => {
        const req = createRequest('DELETE', `/bookings/booking_a`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Id': TENANT_ID
        });

        const res = await SELF.fetch(req);
        if (res.status === 500) console.log('Scenario 4 Error:', await res.json());
        expect(res.status).toBe(200);
    });

    it('Scenario 5: Upload Security - Access Control for Waivers', async () => {
        const KEY = `tenants/${SLUG}/waivers/sensitive.pdf`;

        // Case A: Student A (NOT owner) CANNOT access
        const reqA = createRequest('GET', `/uploads/${KEY}`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Id': TENANT_ID
        });
        const resA = await SELF.fetch(reqA);
        await resA.text();
        expect(resA.status).toBe(403);

        // Case B: Student B (Owner of file) CAN access
        const reqB = createRequest('GET', `/uploads/${KEY}`, {
            'TEST-AUTH': STUDENT_B_ID,
            'X-Tenant-Id': TENANT_ID
        });
        const resB = await SELF.fetch(reqB);
        if (resB.status === 500) console.log('Scenario 5B Error:', await resB.json());
        expect(resB.status).toBe(200);
        expect(await resB.text()).toBe('SECRET CONTENT');

        // Case C: Owner (Admin) CAN access
        const reqOwner = createRequest('GET', `/uploads/${KEY}`, { 'TEST-AUTH': OWNER_ID, 'X-Tenant-Id': TENANT_ID });
        const resOwner = await SELF.fetch(reqOwner);
        await resOwner.text();
        expect(resOwner.status).toBe(200);
    });
});
