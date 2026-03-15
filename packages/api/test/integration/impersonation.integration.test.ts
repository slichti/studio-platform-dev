/**
 * Impersonation JWT: HS256 token with IMPERSONATION_SECRET allows platform admin
 * to act as another user; protected route returns 200 with impersonated user context.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { sign } from 'hono/jwt';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

const IMPERSONATION_SECRET = 'test-impersonation-secret-32-chars!!'; // Must match vitest.config.integration.ts bindings

const TENANT_ID = 'tenant_impersonation';
const SLUG = 'impersonation-studio';
const ADMIN_ID = 'user_platform_admin';
const TARGET_USER_ID = 'user_impersonation_target';

describe('Impersonation integration', () => {
    beforeAll(async () => {
        const db = await setupTestDb(env.DB);

        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: SLUG,
            name: 'Impersonation Studio',
            status: 'active',
        }).run();

        await db.insert(schema.users).values([
            { id: ADMIN_ID, email: 'admin@platform.com', isPlatformAdmin: true },
            { id: TARGET_USER_ID, email: 'target@studio.com' },
        ]).run();

        await db.insert(schema.tenantMembers).values({
            id: 'm_imp_target',
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            status: 'active',
        }).run();

        await db.insert(schema.tenantRoles).values({
            id: 'r_imp_target',
            memberId: 'm_imp_target',
            role: 'owner',
        }).run();
    });

    it('returns 200 for protected route with valid impersonation JWT (HS256)', async () => {
        const token = await sign(
            {
                sub: TARGET_USER_ID,
                impersonatorId: ADMIN_ID,
                exp: Math.floor(Date.now() / 1000) + 3600,
            },
            IMPERSONATION_SECRET,
            'HS256'
        );

        const res = await SELF.fetch(new Request('http://localhost/tenant/info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Slug': SLUG,
            },
        }));

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body).toHaveProperty('id', TENANT_ID);
        expect(body).toHaveProperty('slug', SLUG);
    });

    it('returns 401 for impersonation JWT signed with wrong secret', async () => {
        const token = await sign(
            {
                sub: TARGET_USER_ID,
                impersonatorId: ADMIN_ID,
                exp: Math.floor(Date.now() / 1000) + 3600,
            },
            'wrong-secret-32-chars!!!!!!!!!!!!!!',
            'HS256'
        );

        const res = await SELF.fetch(new Request('http://localhost/tenant/info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Slug': SLUG,
            },
        }));

        expect(res.status).toBe(401);
    });
});
