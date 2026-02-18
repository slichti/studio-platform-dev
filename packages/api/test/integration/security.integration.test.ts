import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

// Helper to minimize boilerplate
const createRequest = (method: string, path: string, headers: Record<string, string> = {}, body?: any) => {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined
    });
};

describe('Security Regression Tests', () => {
    let db: any;

    const TENANT_ID = 'tenant_123';
    const SLUG = 'security-studio';
    const OWNER_ID = 'user_owner';
    const STUDENT_A_ID = 'user_student_a'; // Attacker
    const STUDENT_B_ID = 'user_student_b'; // Victim
    const BOOKING_ID = 'booking_b';

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 1. Seed Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: SLUG,
            name: 'Security Studio',
            status: 'active'
        }).run();

        // 2. Seed Users
        await db.insert(schema.users).values([
            { id: OWNER_ID, email: 'owner@test.com' },
            { id: STUDENT_A_ID, email: 'attacker@test.com' },
            { id: STUDENT_B_ID, email: 'victim@test.com' }
        ]).run();

        // 3. Seed Members
        await db.insert(schema.tenantMembers).values([
            { id: 'm_owner', tenantId: TENANT_ID, userId: OWNER_ID, status: 'active' },
            { id: 'm_a', tenantId: TENANT_ID, userId: STUDENT_A_ID, status: 'active' },
            { id: 'm_b', tenantId: TENANT_ID, userId: STUDENT_B_ID, status: 'active' }
        ]).run();

        // 4. Assign Owner Role
        await db.insert(schema.tenantRoles).values({
            id: 'r_owner',
            memberId: 'm_owner',
            role: 'owner'
        }).run();

        // 5. Seed Private Data
        await db.insert(schema.classes).values({
            id: 'class_1',
            tenantId: TENANT_ID,
            title: 'Private Class',
            startTime: new Date(),
            durationMinutes: 60,
            status: 'active'
        }).run();

        await db.insert(schema.bookings).values({
            id: BOOKING_ID,
            classId: 'class_1',
            memberId: 'm_b',
            status: 'confirmed'
        }).run();
    });

    it('Scenario 1: Student A should NOT be able to view Student B booking', async () => {
        const req = createRequest('GET', `/bookings/${BOOKING_ID}`, {
            'X-Tenant-Id': TENANT_ID,
            'TEST-AUTH': STUDENT_A_ID
        });

        const res = await SELF.fetch(req);
        if (res.status === 500) {
            console.error('Scenario 1 Error:', await res.json());
        }
        expect(res.status).toBe(403);
    });

    it('Scenario 2: Owner should be able to view Student B booking', async () => {
        const req = createRequest('GET', `/bookings/${BOOKING_ID}`, {
            'X-Tenant-Id': TENANT_ID,
            'TEST-AUTH': OWNER_ID
        });

        const res = await SELF.fetch(req);
        expect(res.status).toBe(200);
    });

    it('Scenario 3: Tenant Isolation - Student A should NOT be able to access Tenant 2', async () => {
        // Seed Tenant 2
        await db.insert(schema.tenants).values({
            id: 'tenant_2',
            slug: 'studio-2',
            name: 'Other Studio'
        }).run();

        const req = createRequest('GET', '/members/me', {
            'X-Tenant-Id': 'tenant_2',
            'TEST-AUTH': STUDENT_A_ID
        });

        const res = await SELF.fetch(req);
        // GET /members/me returns 404 if member record not found for user/tenant combo
        expect(res.status).toBe(404);
    });

    it('Scenario 4: Role-based filtering - Student should NOT see Custom Reports', async () => {
        const req = createRequest('GET', '/reports/custom', {
            'X-Tenant-Id': TENANT_ID,
            'TEST-AUTH': STUDENT_A_ID
        });

        const res = await SELF.fetch(req);
        // Student A has no roles assigned in seed data, so tenantMiddleware defaults to no permissions
        // and requirePermission('view_reports') should deny access.
        expect(res.status).toBe(403);
    });

    it('Scenario 5: OAuth Callback User Mismatch - Should fail if different user tries to finish callback', async () => {
        // 1. Initiate Connect as Owner (to get a valid signed state)
        const connectReq = createRequest('GET', `/studios/gc-connect?tenantId=${TENANT_ID}`, {
            'TEST-AUTH': OWNER_ID,
            'X-Tenant-Id': TENANT_ID
        });
        const connectRes = await SELF.fetch(connectReq, { redirect: 'manual' });
        if (connectRes.status !== 302) {
            console.error('[Scenario 5 DEBUG] Failed with status:', connectRes.status, 'Body:', await connectRes.json());
        }
        expect(connectRes.status).toBe(302);
        const location = connectRes.headers.get('Location');
        const url = new URL(location!);
        const state = url.searchParams.get('state');

        // 2. Attempt Callback as Student A with Owner's state
        const callbackReq = createRequest('GET', `/studios/gc-callback?code=mock_code&state=${state}`, {
            'TEST-AUTH': STUDENT_A_ID,
            'X-Tenant-Id': TENANT_ID
        });
        const callbackRes = await SELF.fetch(callbackReq);

        // Should be 403 due to payload.userId !== c.get('auth')?.userId check
        expect(callbackRes.status).toBe(403);
        const body = await callbackRes.json();
        expect(body.error).toBe('User mismatch');
    });
});
