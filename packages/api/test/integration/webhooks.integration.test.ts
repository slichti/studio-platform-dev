import { describe, it, expect, vi, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Webhook Integration', () => {
    const TENANT_ID = 'test_tenant_webhooks';
    const ENDPOINT_ID = 'ep_123';
    const SECRET = 'sec_123';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);
    });

    it('should be able to trigger a test webhook', async () => {
        const ADMIN_ID = 'user_admin';
        // 1. Seed DB
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'webhook-test',
            name: 'Webhook Test'
        }).run();

        // Seed Admin User
        await db.insert(schema.users).values({
            id: ADMIN_ID,
            email: 'admin@test.com'
        }).run();

        const MEMBER_ID = 'm_admin';
        await db.insert(schema.tenantMembers).values({
            id: MEMBER_ID,
            tenantId: TENANT_ID,
            userId: ADMIN_ID,
            status: 'active'
        }).run();

        await db.insert(schema.tenantRoles).values({
            id: 'r_admin',
            memberId: MEMBER_ID,
            role: 'owner'
        }).run();

        // Enable feature
        await db.insert(schema.tenantFeatures).values({
            id: 'f_webhooks',
            tenantId: TENANT_ID,
            featureKey: 'webhooks',
            enabled: true
        }).run();

        // Create Endpoint
        await db.insert(schema.webhookEndpoints).values({
            id: ENDPOINT_ID,
            tenantId: TENANT_ID,
            url: 'https://example.com/webhook',
            secret: SECRET,
            events: ['student.created'],
            isActive: true,
            createdAt: new Date()
        }).run();

        // Mock global fetch for the outgoing request
        vi.spyOn(global, 'fetch').mockResolvedValue(new Response('OK', { status: 200 }));

        const req = new Request(`http://localhost/tenant/webhooks/test`, {
            method: 'POST',
            body: JSON.stringify({ eventType: 'test.ping', payload: { foo: 'bar' } }),
            headers: {
                'X-Tenant-Id': TENANT_ID,
                'TEST-AUTH': ADMIN_ID,
                'Content-Type': 'application/json'
            }
        });

        const res = await SELF.fetch(req);
        if (res.status !== 200) {
            throw new Error(`Webhook test failed: ${res.status} - ${await res.text()}`);
        }
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.success).toBe(true);
    });
});
