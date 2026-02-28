/**
 * Auth middleware behavior: TEST-AUTH bypass, 401 without auth, protected route with auth.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

const TENANT_ID = 'tenant_auth_int';
const USER_ID = 'user_auth_owner';

describe('Auth integration', () => {
    beforeAll(async () => {
        const db = await setupTestDb(env.DB);
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'auth-studio',
            name: 'Auth Studio',
            status: 'active',
        }).run();
        await db.insert(schema.users).values({ id: USER_ID, email: 'owner@auth.com' }).run();
        await db.insert(schema.tenantMembers).values({
            id: 'm_auth_owner',
            tenantId: TENANT_ID,
            userId: USER_ID,
            status: 'active',
        }).run();
        await db.insert(schema.tenantRoles).values({
            id: 'r_auth',
            memberId: 'm_auth_owner',
            role: 'owner',
        }).run();
    });

    it('returns 401 for protected route without any auth', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/retention/cohorts', {
            method: 'GET',
            headers: { 'X-Tenant-Id': TENANT_ID },
        }));
        expect(res.status).toBe(401);
    });

    it('returns 200 for protected route with TEST-AUTH and X-Tenant-Id', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/retention/cohorts', {
            method: 'GET',
            headers: { 'TEST-AUTH': USER_ID, 'X-Tenant-Id': TENANT_ID },
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('cohorts');
    });
});
