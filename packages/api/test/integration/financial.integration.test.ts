import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './test-utils';
import * as schema from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

describe('Financial & Payout Precision', () => {
    let db: any;
    const tenantId = 'tenant_fin_123';
    const instructorId = 'inst_fin_123';
    const instructorUserId = 'user_inst_fin_123';

    beforeEach(async () => {
        db = await setupTestDb(env.DB);

        // Setup Tenant
        await db.insert(schema.tenants).values({
            id: tenantId,
            name: 'Finance Test Studio',
            slug: 'finance-test',
            status: 'active'
        }).run();

        // Setup Instructor
        await db.insert(schema.users).values({
            id: instructorUserId,
            email: 'instructor@finance.test',
            role: 'user'
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: instructorId,
            tenantId,
            userId: instructorUserId,
            status: 'active'
        }).run();

        // Enable Payroll Feature
        await db.insert(schema.tenantFeatures).values({
            id: crypto.randomUUID(),
            tenantId,
            featureKey: 'payroll',
            enabled: true
        }).run();

        // Add Role for manage_payroll
        await db.insert(schema.tenantRoles).values({
            id: crypto.randomUUID(),
            memberId: instructorId,
            role: 'admin'
        }).run();
    });

    async function generatePayroll(startDate: string, endDate: string) {
        const response = await SELF.fetch('https://api.studio.local/payroll/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': instructorUserId,
                'X-Tenant-Slug': 'finance-test'
            },
            body: JSON.stringify({ startDate, endDate, commit: false })
        });
        if (response.status !== 200) {
            const err = await response.text();
            throw new Error(`Payroll generation failed: ${response.status} - ${err}`);
        }
        return await response.json() as any;
    }

    describe('Hourly Pay Precision', () => {
        it('calculates precise pay for non-even class durations (e.g. 45 mins)', async () => {
            // Set hourly rate: $50/hr (5000 cents)
            await db.insert(schema.payrollConfig).values({
                id: 'config_hourly',
                tenantId,
                memberId: instructorId,
                userId: instructorUserId,
                payModel: 'hourly',
                rate: 5000
            }).run();

            // Create a 45-minute class
            const startTime = new Date('2026-03-01T10:00:00Z');
            await db.insert(schema.classes).values({
                id: 'class_45min',
                tenantId,
                instructorId,
                title: '45min HIIT',
                startTime,
                durationMinutes: 45,
                status: 'active'
            }).run();

            const body = await generatePayroll('2026-03-01', '2026-03-02');
            const result = body.preview[0];

            // 5000 * (45/60) = 3750 cents
            expect(result.amount).toBe(3750);
            expect(result.items[0].details).toContain('45 mins @ $50.00/hr');
        });

        it('handles repeating decimals correctly (e.g. 50 mins @ $50/hr)', async () => {
            await db.insert(schema.payrollConfig).values({
                id: 'config_hourly_50',
                tenantId,
                memberId: instructorId,
                userId: instructorUserId,
                payModel: 'hourly',
                rate: 5000
            }).run();

            await db.insert(schema.classes).values({
                id: 'class_50min',
                tenantId,
                instructorId,
                title: '50min Flow',
                startTime: new Date('2026-03-01T11:00:00Z'),
                durationMinutes: 50,
                status: 'active'
            }).run();

            const body = await generatePayroll('2026-03-01', '2026-03-02');
            const result = body.preview[0];

            // 5000 * (50/60) = 4166.666... rounds to 4167
            expect(result.amount).toBe(4167);
        });
    });

    describe('Credit Pack Revenue Precision', () => {
        it('avoids accumulation errors when allocating revenue from odd-priced packs', async () => {
            // Set 50% revenue share (5000 basis points)
            await db.insert(schema.payrollConfig).values({
                id: 'config_rev_share',
                tenantId,
                memberId: instructorId,
                userId: instructorUserId,
                payModel: 'percentage',
                rate: 5000,
                payoutBasis: 'gross'
            }).run();

            // Create a class
            const classId = 'class_credits';
            await db.insert(schema.classes).values({
                id: classId,
                tenantId,
                instructorId,
                title: 'Credit Class',
                startTime: new Date('2026-03-01T12:00:00Z'),
                durationMinutes: 60,
                status: 'active'
            }).run();

            // Pack: 10 credits for $9.99 (999 cents) -> 99.9 cents per credit
            const packId = 'pack_999';
            await db.insert(schema.purchasedPacks).values({
                id: packId,
                tenantId,
                memberId: 'some_member',
                packDefinitionId: 'def_123',
                initialCredits: 10,
                remainingCredits: 0,
                price: 999, // $9.99
                status: 'active'
            }).run();

            // 10 bookings using 1 credit each from this pack
            for (let i = 0; i < 10; i++) {
                await db.insert(schema.bookings).values({
                    id: `b_${i}`,
                    classId,
                    memberId: `member_${i}`,
                    status: 'confirmed',
                    paymentMethod: 'credit',
                    usedPackId: packId
                }).run();
            }

            const body = await generatePayroll('2026-03-01', '2026-03-02');
            const result = body.preview[0];

            // Precise Revenue calculation (10 * 99.9 rounded) = 999 cents.
            // Payout (50% of 999 rounded) = 499.5 rounds to 500.
            expect(result.amount).toBe(500);
        });
    });

    describe('Net Revenue Precision (Fees)', () => {
        it('calculates net revenue sharing correctly after estimated fees', async () => {
            // Set 100% revenue share (10000 basis points) on NET
            await db.insert(schema.payrollConfig).values({
                id: 'config_net_share',
                tenantId,
                memberId: instructorId,
                userId: instructorUserId,
                payModel: 'percentage',
                rate: 10000,
                payoutBasis: 'net'
            }).run();

            const classId = 'class_fees';
            await db.insert(schema.classes).values({
                id: classId,
                tenantId,
                instructorId,
                title: 'Fee Class',
                startTime: new Date('2026-03-01T13:00:00Z'),
                durationMinutes: 60,
                price: 10000, // $100 drop-in
                status: 'active'
            }).run();

            await db.insert(schema.bookings).values({
                id: 'b_dropin',
                classId,
                memberId: 'member_dropin',
                status: 'confirmed',
                paymentMethod: 'drop_in'
            }).run();

            const body = await generatePayroll('2026-03-01', '2026-03-02');
            const result = body.preview[0];

            // Revenue: 10000 cents.
            // Fees: floor(10000 * 0.029) + (1 * 30) = 290 + 30 = 320 cents.
            // Net: 10000 - 320 = 9680 cents.
            // Payout: 100% of 9680 = 9680.
            expect(result.amount).toBe(9680);
        });
    });
});
