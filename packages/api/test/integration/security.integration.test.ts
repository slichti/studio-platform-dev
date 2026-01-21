
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
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, slug TEXT, name TEXT, settings TEXT, status TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, is_platform_admin INTEGER, last_active_at INTEGER, last_location TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_members (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_roles (member_id TEXT, role TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, member_id TEXT, class_id TEXT, status TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, action TEXT, actor_id TEXT, details TEXT, created_at INTEGER)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT)`),

            // 2. Data Seeding
            // Tenant
            env.DB.prepare(`INSERT INTO tenants (id, slug, name, status) VALUES (?, ?, ?, ?)`).bind(TENANT_ID, SLUG, 'Security Studio', 'active'),
            env.DB.prepare(`INSERT INTO classes (id, tenant_id, title) VALUES (?, ?, ?)`).bind('class_1', TENANT_ID, 'Security Class'),

            // Users
            env.DB.prepare(`INSERT INTO users (id, email, is_platform_admin) VALUES (?, ?, ?)`).bind(OWNER_ID, 'owner@test.com', 0),
            env.DB.prepare(`INSERT INTO users (id, email, is_platform_admin) VALUES (?, ?, ?)`).bind(STUDENT_A_ID, 'studentA@test.com', 0),
            env.DB.prepare(`INSERT INTO users (id, email, is_platform_admin) VALUES (?, ?, ?)`).bind(STUDENT_B_ID, 'studentB@test.com', 0),

            // Members
            env.DB.prepare(`INSERT INTO tenant_members (id, tenant_id, user_id, status) VALUES (?, ?, ?, ?)`).bind('mem_owner', TENANT_ID, OWNER_ID, 'active'),
            env.DB.prepare(`INSERT INTO tenant_members (id, tenant_id, user_id, status) VALUES (?, ?, ?, ?)`).bind('mem_student_a', TENANT_ID, STUDENT_A_ID, 'active'),
            env.DB.prepare(`INSERT INTO tenant_members (id, tenant_id, user_id, status) VALUES (?, ?, ?, ?)`).bind('mem_student_b', TENANT_ID, STUDENT_B_ID, 'active'),

            // Roles
            env.DB.prepare(`INSERT INTO tenant_roles (member_id, role) VALUES (?, ?)`).bind('mem_owner', 'owner'),
            env.DB.prepare(`INSERT INTO tenant_roles (member_id, role) VALUES (?, ?)`).bind('mem_student_a', 'student'),
            env.DB.prepare(`INSERT INTO tenant_roles (member_id, role) VALUES (?, ?)`).bind('mem_student_b', 'student'),

            // Booking (Owned by Student B)
            env.DB.prepare(`INSERT INTO bookings (id, member_id, class_id, status) VALUES (?, ?, ?, ?)`).bind(BOOKING_ID, 'mem_student_b', 'class_1', 'confirmed')
        ]);
    });

    it('Scenario 1: IDOR - Student A cannot cancel Student B booking', async () => {
        // As Student A
        const req = createRequest('DELETE', `/bookings/${BOOKING_ID}`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Slug': SLUG
        });

        const res = await fetchWithWaitUntil(req, env);
        expect(res.status).toBe(403); // Forbidden

        const json: any = await res.json();
        expect(json.error).toMatch(/Unauthorized|Forbidden/);
    });

    it('Scenario 2: IDOR - Owner CAN cancel Student B booking', async () => {
        // As Owner
        const req = createRequest('DELETE', `/bookings/${BOOKING_ID}`, {
            'TEST-AUTH': OWNER_ID,
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

    it.skip('Scenario 4: Rate Limiting - Block excess requests', async () => {
        // Skipped because RateLimiter DO is bypassed in test environment due to vitest storage issues
        const diagReq = createRequest('GET', '/diagnostics', {
            'TEST-AUTH': STUDENT_A_ID // Not Platform Admin
        });
        const diagRes = await fetchWithWaitUntil(diagReq, env);
        expect(diagRes.status).toBe(403);
    });
});
