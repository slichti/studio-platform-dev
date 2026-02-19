import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

const TENANT_ID = 'tenant_analytics_123';
const OWNER_ID = 'user_owner_analytics';

describe('Analytics Reporting Integration Tests', () => {
    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // Seed Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'analytics-studio',
            name: 'Analytics Studio',
            status: 'active'
        }).run();

        // Seed Members (Joining at different times)
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

        await db.insert(schema.users).values([
            { id: OWNER_ID, email: 'owner@analytics.com' },
            { id: 'user_1', email: 'u1@test.com' },
            { id: 'user_2', email: 'u2@test.com' },
            { id: 'user_3', email: 'u3@test.com' }
        ]).run();

        await db.insert(schema.tenantMembers).values([
            { id: 'm_owner', tenantId: TENANT_ID, userId: OWNER_ID, status: 'active', joinedAt: new Date(sixtyDaysAgo) },
            { id: 'm_1', tenantId: TENANT_ID, userId: 'user_1', status: 'active', joinedAt: new Date(sixtyDaysAgo) },
            { id: 'm_2', tenantId: TENANT_ID, userId: 'user_2', status: 'active', joinedAt: new Date(thirtyDaysAgo) },
            { id: 'm_3', tenantId: TENANT_ID, userId: 'user_3', status: 'active', joinedAt: new Date(now) }
        ]).run();

        // Assign Owner Role for view_reports permission
        await db.insert(schema.tenantRoles).values({
            id: 'r_owner_analytics',
            memberId: 'm_owner',
            role: 'owner'
        }).run();

        // Seed Revenue (POS Orders)
        await db.insert(schema.posOrders).values([
            { id: 'o_1', tenantId: TENANT_ID, totalAmount: 5000, status: 'completed', createdAt: new Date(thirtyDaysAgo) },
            { id: 'o_2', tenantId: TENANT_ID, totalAmount: 10000, status: 'completed', createdAt: new Date(now) }
        ]).run();

        // Seed Subscriptions for Retention
        await db.insert(schema.subscriptions).values([
            { id: 's_1', tenantId: TENANT_ID, userId: 'user_1', status: 'active', createdAt: new Date(sixtyDaysAgo) },
            { id: 's_2', tenantId: TENANT_ID, userId: 'user_2', status: 'canceled', createdAt: new Date(sixtyDaysAgo), canceledAt: new Date(thirtyDaysAgo) }
        ]).run();
    });

    it('should calculate new_signups correctly', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/custom/query', {
            method: 'POST',
            body: JSON.stringify({
                metrics: ['new_signups'],
                dimensions: ['date'],
                filters: {
                    startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                }
            }),
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': OWNER_ID, 'X-Tenant-Id': TENANT_ID }
        }));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.summary.new_signups).toBe(2); // m_2 and m_3
    });

    it('should calculate active_members growth correctly', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/custom/query', {
            method: 'POST',
            body: JSON.stringify({
                metrics: ['active_members'],
                dimensions: ['date'],
                filters: {
                    startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                }
            }),
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': OWNER_ID, 'X-Tenant-Id': TENANT_ID }
        }));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.summary.active_members).toBe(4);
        // Expect growth data in chartData
        expect(body.chartData.length).toBeGreaterThan(0);
        const lastPoint = body.chartData[body.chartData.length - 1];
        expect(lastPoint.active_members).toBe(4);
    });

    it('should calculate retention_rate correctly', async () => {
        const res = await SELF.fetch(new Request('http://localhost/reports/custom/query', {
            method: 'POST',
            body: JSON.stringify({
                metrics: ['retention_rate'],
                dimensions: ['date'],
                filters: {
                    startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                }
            }),
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': OWNER_ID, 'X-Tenant-Id': TENANT_ID }
        }));

        expect(res.status).toBe(200);
        const body = await res.json();
        // Start: 2 subs (s1, s2). Churned: 1 (s2). Retention: 50%
        expect(body.summary.retention_rate).toBe(50);
    });
});
