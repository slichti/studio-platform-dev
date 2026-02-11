
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import worker from '../../src/index';

// Helper to minimize boilerplate
const createRequest = (method: string, path: string, headers: Record<string, string> = {}, body?: any) => {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined
    });
};

const fetchWithWaitUntil = async (req: Request, env: any) => {
    const waitUntils: Promise<any>[] = [];
    const res = await worker.fetch(req, env, {
        waitUntil: (p: Promise<any>) => waitUntils.push(p),
        passThroughOnException: () => { }
    } as any);
    await Promise.all(waitUntils);
    return res;
};

describe('Security Regression Tests', () => {

    const TENANT_ID = 'tenant_123';
    const SLUG = 'security-studio';
    const OWNER_ID = 'user_owner';
    const STUDENT_A_ID = 'user_student_a'; // Attacker
    const STUDENT_B_ID = 'user_student_b'; // Victim
    const BOOKING_ID = 'booking_b';

    beforeAll(async () => {
        // [SETUP] Minimal Schema & Seed Data
        await env.DB.batch([
            // 1. Schema Init
            env.DB.prepare(`DROP TABLE IF EXISTS tenants`),
            env.DB.prepare(`DROP TABLE IF EXISTS users`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_members`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_roles`),
            env.DB.prepare(`DROP TABLE IF EXISTS bookings`),
            env.DB.prepare(`DROP TABLE IF EXISTS audit_logs`),
            env.DB.prepare(`DROP TABLE IF EXISTS classes`),
            env.DB.prepare(`DROP TABLE IF EXISTS uploads`),
            env.DB.prepare(`DROP TABLE IF EXISTS tenant_features`),

            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY, slug TEXT, name TEXT, settings TEXT, status TEXT, 
                branding TEXT, mobile_app_config TEXT, payment_provider TEXT, marketing_provider TEXT, currency TEXT,
                stripe_credentials TEXT, resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT,
                zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT, google_credentials TEXT,
                slack_credentials TEXT, google_calendar_credentials TEXT
            )`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, is_platform_admin INTEGER, last_active_at INTEGER, last_location TEXT, profile TEXT, role TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_members (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT, profile TEXT, settings TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_roles (member_id TEXT, role TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, member_id TEXT, class_id TEXT, status TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, action TEXT, actor_id TEXT, details TEXT, country TEXT, city TEXT, region TEXT, created_at INTEGER)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS conversions (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT)`), // Not used?
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, included_plan_ids TEXT, zoom_enabled INTEGER, auto_cancel_enabled INTEGER)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, tenant_id TEXT, file_key TEXT, uploaded_by TEXT, mime_type TEXT, tags TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_features (id TEXT PRIMARY KEY, tenant_id TEXT, feature_key TEXT, enabled INTEGER, source TEXT, updated_at INTEGER)`),

        ]);

        // 2. Data Seeding
        // Tenant
        await env.DB.prepare(`INSERT INTO tenants (
            id, slug, name, settings, status, branding, mobile_app_config, payment_provider, marketing_provider, currency,
            stripe_credentials, resend_credentials, twilio_credentials, flodesk_credentials,
            zoom_credentials, mailchimp_credentials, zapier_credentials, google_credentials,
            slack_credentials, google_calendar_credentials
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            TENANT_ID, SLUG, 'Security Studio',
            JSON.stringify({ enableStudentRegistration: true }), 'active',
            '{}', '{}', 'connect', 'system', 'usd',
            '{}', '{}', '{}', '{}',
            '{}', '{}', '{}', '{}',
            '{}', '{}'
        ).run();

        // Users & Members
        await env.DB.batch([
            env.DB.prepare(`INSERT INTO users (id, email, is_platform_admin, role, profile) VALUES (?, ?, ?, ?, ?)`).bind(STUDENT_A_ID, 'student.a@test.com', 0, 'user', '{}'),
            env.DB.prepare(`INSERT INTO users (id, email, is_platform_admin, role, profile) VALUES (?, ?, ?, ?, ?)`).bind(STUDENT_B_ID, 'student.b@test.com', 0, 'user', '{}'),
            env.DB.prepare(`INSERT INTO users (id, email, is_platform_admin, role, profile) VALUES (?, ?, ?, ?, ?)`).bind(OWNER_ID, 'owner@test.com', 0, 'owner', '{}'),

            env.DB.prepare('INSERT INTO tenant_members (id, tenant_id, user_id, status, profile, settings) VALUES (?, ?, ?, ?, ?, ?)').bind('member_a', TENANT_ID, STUDENT_A_ID, 'active', '{}', '{}'),
            env.DB.prepare('INSERT INTO tenant_members (id, tenant_id, user_id, status, profile, settings) VALUES (?, ?, ?, ?, ?, ?)').bind('member_b', TENANT_ID, STUDENT_B_ID, 'active', '{}', '{}'),
            env.DB.prepare('INSERT INTO tenant_members (id, tenant_id, user_id, status, profile, settings) VALUES (?, ?, ?, ?, ?, ?)').bind('member_owner', TENANT_ID, OWNER_ID, 'active', '{}', '{}'),

            // Roles
            env.DB.prepare(`INSERT INTO tenant_roles (member_id, role) VALUES (?, ?)`).bind('member_owner', 'owner'),
            env.DB.prepare(`INSERT INTO tenant_roles (member_id, role) VALUES (?, ?)`).bind('member_a', 'student'),
            env.DB.prepare(`INSERT INTO tenant_roles (member_id, role) VALUES (?, ?)`).bind('member_b', 'student'),

            // Class
            env.DB.prepare(`INSERT INTO classes (id, tenant_id, title, included_plan_ids, zoom_enabled, auto_cancel_enabled) VALUES (?, ?, ?, ?, ?, ?)`).bind('class_1', TENANT_ID, 'Security Class', '[]', 0, 0),

            // Booking (Owned by Student B)
            env.DB.prepare(`INSERT INTO bookings (id, member_id, class_id, status) VALUES (?, ?, ?, ?)`).bind(BOOKING_ID, 'mem_student_b', 'class_1', 'confirmed'),

            // Upload (Owned by Student B) - Waiver
            env.DB.prepare(`INSERT INTO uploads (id, tenant_id, file_key, uploaded_by, mime_type) VALUES (?, ?, ?, ?, ?)`).bind('upload_1', TENANT_ID, `tenants/${SLUG}/waivers/sensitive.pdf`, STUDENT_B_ID, 'application/pdf')
        ]);

        // Put file in R2
        await env.R2.put(`tenants/${SLUG}/waivers/sensitive.pdf`, 'SECRET CONTENT');
    });

    it('Scenario 1: IDOR - Student A cannot cancel Student B booking', async () => {
        const req = createRequest('DELETE', `/bookings/${BOOKING_ID}`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Slug': SLUG
        });

        const res = await fetchWithWaitUntil(req, env);
        expect(res.status).toBe(403); // Access Denied
    });

    it('Scenario 2: IDOR - Student B CAN cancel their own booking', async () => {
        const req = createRequest('DELETE', `/bookings/${BOOKING_ID}`, {
            'TEST-AUTH': STUDENT_B_ID,
            'X-Tenant-Slug': SLUG
        });

        const res = await fetchWithWaitUntil(req, env);
        expect(res.status).toBe(200);
    });

    it('Scenario 3: RBAC - Student cannot delete Studio Integrations', async () => {
        const req = createRequest('DELETE', `/studios/${TENANT_ID}/integrations/google`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Slug': SLUG
        });

        const res = await fetchWithWaitUntil(req, env);
        expect(res.status).toBe(403); // Owner Only
    });

    it('Scenario 5: Upload Security - Access Control for Waivers', async () => {
        const KEY = `tenants/${SLUG}/waivers/sensitive.pdf`;

        // Case A: Student A (Attacker) cannot access Student B's waiver
        const resA = await fetchWithWaitUntil(
            createRequest('GET', `/uploads/${KEY}`, { 'TEST-AUTH': STUDENT_A_ID, 'X-Tenant-Slug': SLUG }),
            env
        );
        expect(resA.status).toBe(403);

        // Case B: Student B (Owner of file) CAN access
        const resB = await fetchWithWaitUntil(
            createRequest('GET', `/uploads/${KEY}`, { 'TEST-AUTH': STUDENT_B_ID, 'X-Tenant-Slug': SLUG }),
            env
        );
        expect(resB.status).toBe(200);

        // Case C: Owner (Admin) CAN access
        const resOwner = await fetchWithWaitUntil(
            createRequest('GET', `/uploads/${KEY}`, { 'TEST-AUTH': OWNER_ID, 'X-Tenant-Slug': SLUG }),
            env
        );
        expect(resOwner.status).toBe(200);
    });

    it.skip('Scenario 4: Rate Limiting - Block excess requests', async () => {
        // Skipped because RateLimiter DO is bypassed in test environment due to vitest storage issues
        const diagReq = createRequest('GET', '/diagnostics', {
            'TEST-AUTH': STUDENT_A_ID // Not Platform Admin
        });
        const diagRes = await fetchWithWaitUntil(diagReq, env);
        expect(diagRes.status).toBe(403);
    });
});
