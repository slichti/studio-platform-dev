
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Platform API Integation', () => {
    const TENANT_ID = 'platform_test_tenant';
    const PLATFORM_ADMIN_ID = 'platform_admin_user';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 1. Create Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            name: 'Platform Test Studio',
            slug: 'platform-studio',
            marketingProvider: 'system',
            currency: 'usd',
            status: 'active',
            tier: 'launch',
            subscriptionStatus: 'active',
            branding: {},
            settings: {},
            mobileAppConfig: {}
        }).onConflictDoNothing().run();

        // 2. Create Platform Admin User (Not a member of the tenant)
        await db.insert(schema.users).values({
            id: PLATFORM_ADMIN_ID,
            email: 'admin@platform.com',
            role: 'platform_admin',
            isPlatformAdmin: true,
            createdAt: new Date()
        }).onConflictDoNothing().run();
    });

    it('should identify platform admin correctly via /tenant/me even without membership', async () => {
        const res = await SELF.fetch('https://api.studio.local/tenant/me', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': PLATFORM_ADMIN_ID,
                'X-Tenant-Slug': 'platform-studio'
            }
        });

        expect(res.status).toBe(200);
        const json = await res.json() as any;

        // Verify the fix: user object should be present and isPlatformAdmin should be true
        expect(json.user).toBeDefined();
        expect(json.user.isPlatformAdmin).toBe(true);
        expect(json.user.email).toBe('admin@platform.com');

        // Also verify roles (should include 'owner' virtually)
        expect(json.roles).toBeDefined();
        expect(json.roles).toContain('owner');
    });
});
