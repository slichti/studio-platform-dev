import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../src/db';
import { tenants, classPackDefinitions, membershipPlans, users, tenantMembers, tenantRoles } from '@studio/db/src/schema';
import app from '../../src/index';
import { setupTestDb } from './test-utils';

// Mock Stripe Service
vi.mock('../../src/services/stripe', () => ({
    StripeService: vi.fn().mockImplementation(() => ({
        createProduct: vi.fn().mockResolvedValue({ id: 'prod_mock' }),
        createPrice: vi.fn().mockResolvedValue({ id: 'price_mock' }),
    })),
}));

describe('Commerce Integration', () => {
    const tenantId = 'test-tenant-' + Date.now();
    const slug = 'test-studio-' + Date.now();

    beforeEach(async () => {
        // Setup clean test database using our standard utility
        await setupTestDb(env.DB);
        const db = createDb(env.DB);

        // Seed Platform User / Member / Role
        await db.insert(users).values({
            id: 'user_test_admin',
            email: 'test@example.com',
            role: 'owner',
            createdAt: new Date()
        }).run();

        await db.insert(tenantMembers).values({
            id: 'test-member-id',
            tenantId: tenantId,
            userId: 'user_test_admin',
            status: 'active'
        }).run();

        await db.insert(tenantRoles).values({
            id: 'test-role-id',
            memberId: 'test-member-id',
            role: 'owner'
        }).run();

        // Seed Tenant
        await db.insert(tenants).values({
            id: tenantId,
            slug,
            name: 'Test Studio',
            currency: 'usd',
            status: 'active',
            subscriptionStatus: 'active',
            tier: 'launch',
            isTest: true
        } as any).run();
    });

    it('GET /commerce/products should return aggregated packs and plans', async () => {
        const db = createDb(env.DB);

        // Seed a pack
        await db.insert(classPackDefinitions).values({
            id: 'pack-1',
            tenantId,
            name: 'Test Pack',
            credits: 10,
            price: 10000,
            active: true
        } as any).run();

        // Seed a plan
        await db.insert(membershipPlans).values({
            id: 'plan-1',
            tenantId,
            name: 'Test Plan',
            price: 5000,
            interval: 'month',
            active: true
        } as any).run();

        const req = new Request(`http://localhost/commerce/products`, {
            headers: {
                'X-Tenant-Slug': slug,
                'TEST-AUTH': 'user_test_admin'
            }
        });

        const res = await app.fetch(req, env);
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.products).toHaveLength(2);
        expect(data.products.find((p: any) => p.type === 'pack').name).toBe('Test Pack');
        expect(data.products.find((p: any) => p.type === 'membership').name).toBe('Test Plan');
    });

    it('POST /commerce/products/bulk should return results (idempotency/permissions handled by middleware)', async () => {
        const bulkRes = await app.fetch(new Request('http://localhost/commerce/products/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': 'user_test_admin',
                'X-Tenant-Slug': slug
            },
            body: JSON.stringify({
                items: [
                    { name: 'Bulk Pack', type: 'pack', price: 5000, credits: 5 },
                    { name: 'Bulk Plan', type: 'membership', price: 9900, interval: 'month' }
                ]
            })
        }), env);

        const bulkData: any = await bulkRes.json();
        if (bulkRes.status !== 200 || bulkData.results.some((r: any) => r.status === 'failed')) {
            console.error('Bulk Res Results:', JSON.stringify(bulkData.results, null, 2));
        }
        expect(bulkRes.status).toBe(200);
        expect(bulkData.results).toHaveLength(2);
        expect(bulkData.results[0].status).toBe('created');
        expect(bulkData.results[1].status).toBe('created');
    });
});
