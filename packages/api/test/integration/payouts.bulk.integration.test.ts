import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './test-utils';
import * as schema from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

describe('Payouts & Analytics Integration', () => {
    let db: any;
    const tenantId = crypto.randomUUID();
    const instructorId = crypto.randomUUID();
    const adminUserId = 'test-admin';

    beforeEach(async () => {
        db = await setupTestDb(env.DB);

        // Setup Tenant
        await db.insert(schema.tenants).values({
            id: tenantId,
            name: 'Analytics Test Studio',
            slug: 'analytics-test',
            status: 'active'
        }).run();

        // Setup Admin User
        await db.insert(schema.users).values({
            id: adminUserId,
            email: 'admin@test.com',
            role: 'owner',
            isPlatformAdmin: true
        }).run();

        // Setup Instructor Member
        await db.insert(schema.tenantMembers).values({
            id: instructorId,
            tenantId,
            userId: crypto.randomUUID(),
            status: 'active',
            joinedAt: new Date()
        }).run();

        // Setup Payroll Config
        await db.insert(schema.payrollConfig).values({
            id: crypto.randomUUID(),
            tenantId,
            memberId: instructorId,
            userId: crypto.randomUUID(),
            payModel: 'flat',
            rate: 5000,
            payoutBasis: 'gross'
        }).run();

        // Enable Payroll Feature
        await db.insert(schema.tenantFeatures).values({
            id: crypto.randomUUID(),
            tenantId,
            featureKey: 'payroll',
            enabled: true
        }).run();
    });

    it('successfully generates and bulk approves payouts', async () => {
        const classId = crypto.randomUUID();
        await db.insert(schema.classes).values({
            id: classId,
            tenantId,
            instructorId,
            title: 'ROI Class',
            startTime: new Date(),
            durationMinutes: 60,
            price: 2500,
            status: 'active'
        }).run();

        await db.insert(schema.bookings).values({
            id: crypto.randomUUID(),
            tenantId,
            classId,
            memberId: crypto.randomUUID(),
            status: 'confirmed',
            paymentMethod: 'drop_in'
        }).run();

        // 1. Generate Payouts
        const genResp = await SELF.fetch('http://localhost/payroll/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
                'TEST-AUTH': adminUserId
            },
            body: JSON.stringify({
                startDate: new Date(Date.now() - 86400000).toISOString(),
                endDate: new Date(Date.now() + 86400000).toISOString(),
                commit: true
            })
        });
        expect(genResp.status).toBe(200);

        const activePayouts = await db.select().from(schema.payouts).where(eq(schema.payouts.tenantId, tenantId)).all();
        expect(activePayouts.length).toBe(1);

        // 2. Bulk Approve
        const approveResp = await SELF.fetch('http://localhost/payroll/payouts/bulk-approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
                'TEST-AUTH': adminUserId
            },
            body: JSON.stringify({ ids: [activePayouts[0].id] })
        });
        expect(approveResp.status).toBe(200);

        const updatedPayout = await db.select().from(schema.payouts).where(eq(schema.payouts.id, activePayouts[0].id)).get();
        expect(updatedPayout.status).toBe('paid');
    });

    it('provides accurate instructor profitability metrics', async () => {
        const classId = crypto.randomUUID();
        await db.insert(schema.classes).values({
            id: classId,
            tenantId,
            instructorId,
            title: 'Profit Class',
            startTime: new Date(),
            durationMinutes: 60,
            price: 10000,
            status: 'active'
        }).run();

        await db.insert(schema.bookings).values([
            { id: crypto.randomUUID(), tenantId, classId, memberId: crypto.randomUUID(), status: 'confirmed', paymentMethod: 'drop_in' },
            { id: crypto.randomUUID(), tenantId, classId, memberId: crypto.randomUUID(), status: 'confirmed', paymentMethod: 'drop_in' }
        ]).run();

        await db.insert(schema.payouts).values({
            id: crypto.randomUUID(),
            tenantId,
            instructorId,
            amount: 5000,
            periodStart: new Date(Date.now() - 3600),
            periodEnd: new Date(Date.now() + 3600),
            status: 'paid',
            createdAt: new Date()
        }).run();

        const resp = await SELF.fetch('http://localhost/reports/custom/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
                'TEST-AUTH': adminUserId
            },
            body: JSON.stringify({
                metrics: ['instructor_roi'],
                dimensions: ['instructor'],
                filters: {
                    startDate: new Date(Date.now() - 86400000).toISOString(),
                    endDate: new Date(Date.now() + 86400000).toISOString()
                }
            })
        });
        expect(resp.status).toBe(200);
        const { chartData } = await resp.json();

        const instructorStat = chartData.find((s: any) => s.profit > 0);
        expect(instructorStat.profit).toBe(150); // major units
        expect(instructorStat.revenue).toBe(200);
        expect(instructorStat.cost).toBe(50);
    });

    it('exports payroll history to CSV', async () => {
        await db.insert(schema.payouts).values({
            id: crypto.randomUUID(),
            tenantId,
            instructorId,
            amount: 15000,
            periodStart: new Date(),
            periodEnd: new Date(),
            status: 'paid',
            createdAt: new Date()
        }).run();

        const resp = await SELF.fetch('http://localhost/payroll/history/export', {
            headers: {
                'x-tenant-id': tenantId,
                'TEST-AUTH': adminUserId
            }
        });

        expect(resp.status).toBe(200);
        expect(resp.headers.get('Content-Type')).toContain('text/csv');
        const text = await resp.text();
        expect(text).toContain('ID,Instructor,Amount,Status');
        expect(text).toContain('150.00,paid');
    });
});
