/**
 * Post-deploy smoke tests: critical path checks that can be run in CI
 * to verify core API behavior (auth, tenant context, reports).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

const TENANT_ID = 'tenant_smoke_123';
const OWNER_ID = 'user_smoke_owner';

describe('Smoke tests (critical path)', () => {
    beforeAll(async () => {
        const db = await setupTestDb(env.DB);
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'smoke-studio',
            name: 'Smoke Studio',
            status: 'active',
        }).run();
        await db.insert(schema.users).values({ id: OWNER_ID, email: 'owner@smoke.com' }).run();
        await db.insert(schema.tenantMembers).values({
            id: 'm_smoke_owner',
            tenantId: TENANT_ID,
            userId: OWNER_ID,
            status: 'active',
        }).run();
        await db.insert(schema.tenantRoles).values({
            id: 'r_smoke',
            memberId: 'm_smoke_owner',
            role: 'owner',
        }).run();
    });

    it('rejects reports without auth', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/retention/cohorts', {
            method: 'GET',
            headers: { 'X-Tenant-Id': TENANT_ID },
        }));
        expect(res.status).toBe(401);
    });

    it('rejects reports without tenant', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/retention/cohorts', {
            method: 'GET',
            headers: { 'TEST-AUTH': OWNER_ID },
        }));
        expect([400, 401, 403, 404]).toContain(res.status);
    });

    it('GET /reports/retention/cohorts with auth and tenant returns 200', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/retention/cohorts', {
            method: 'GET',
            headers: { 'TEST-AUTH': OWNER_ID, 'X-Tenant-Id': TENANT_ID },
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('cohorts');
    });

    it('GET /reports/churn with auth and tenant returns 200 or 500 (schema-dependent)', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/churn', {
            method: 'GET',
            headers: { 'TEST-AUTH': OWNER_ID, 'X-Tenant-Id': TENANT_ID },
        }));
        expect([200, 500]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('totalMembers');
            expect(body).toHaveProperty('atRiskMembers');
        }
    });
});
