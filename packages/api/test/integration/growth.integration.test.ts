import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './test-utils';
import { ChurnService } from '../../src/services/churn';
import { FulfillmentService } from '../../src/services/fulfillment';
import { BookingService } from '../../src/services/bookings';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';

describe('Growth Features Integration', () => {
    let db: any;
    const tenantId = 'tenant_growth_123';
    const userId = 'user_growth_123';
    const memberId = 'member_growth_123';

    beforeEach(async () => {
        db = await setupTestDb(env.DB);

        // Setup Tenant
        await db.insert(schema.tenants).values({
            id: tenantId,
            name: 'Growth Test Studio',
            slug: 'growth-test',
            status: 'active',
            plan: 'pro'
        }).run();

        // Setup User & Member
        await db.insert(schema.users).values({
            id: userId,
            email: 'growth@test.com',
            role: 'user'
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: memberId,
            tenantId,
            userId,
            status: 'active',
            joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Joined 90 days ago
        }).run();
    });

    describe('Enhanced Churn Model', () => {
        it('calculates higher risk for members with payment failures (Dunning)', async () => {
            // Setup an active subscription in dunning warning state
            await db.insert(schema.subscriptions).values({
                id: 'sub_failed_123',
                userId,
                tenantId,
                memberId,
                status: 'active',
                dunningState: 'warning2',
                currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            }).run();

            const churnService = new ChurnService(db, tenantId);
            const result = await churnService.analyzeMemberRisk(memberId);

            // warning2 = -40, score should be around 60 (medium risk) if no bookings
            // wait, if no bookings, recency factor also applies.
            // daysSince joined (90) > 45 = -60. 
            // 100 - 60 - 40 = 0 (high risk)
            expect(result.riskLevel).toBe('high');
            expect(result.churnScore).toBe(0);
        });

        it('detects frequency drop-off (Slope)', async () => {
            // Setup a class
            const classId = 'class_slope_123';
            await db.insert(schema.classes).values({
                id: classId,
                tenantId,
                title: 'Yoga',
                startTime: new Date(),
                durationMinutes: 60,
                status: 'active'
            }).run();

            // Period 2 (31-60 days ago): 4 bookings
            for (let i = 0; i < 4; i++) {
                const cid = `class_p2_${i}`;
                const date = new Date(Date.now() - (40 + i) * 24 * 60 * 60 * 1000);
                await db.insert(schema.classes).values({ id: cid, tenantId, title: 'Yoga', startTime: date, durationMinutes: 60, status: 'active' }).run();
                await db.insert(schema.bookings).values({ id: `b_p2_${i}`, classId: cid, memberId, status: 'confirmed' }).run();
            }

            // Period 1 (Last 30 days): 1 booking
            const cidP1 = 'class_p1_1';
            await db.insert(schema.classes).values({ id: cidP1, tenantId, title: 'Yoga', startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), durationMinutes: 60, status: 'active' }).run();
            await db.insert(schema.bookings).values({ id: 'b_p1_1', classId: cidP1, memberId, status: 'confirmed' }).run();

            const churnService = new ChurnService(db, tenantId);
            const result = await churnService.analyzeMemberRisk(memberId);

            // Recency: 5 days since < 14 = -0?
            // Slope: p2=4, p1=1 -> -25
            // Score should be 100 - 25 = 75 (low/medium boundary? plan says <= 70 is medium)
            // Wait, last booking was 5 days ago. daysSince = 5. Factor A = 0.
            // Factor D (Slope) = -25.
            // Result: Score 75. 
            expect(result.churnScore).toBe(75);
            expect(result.riskLevel).toBe('low'); // 75 > 70
        });
    });

    describe('Referral Rewards', () => {
        it('awards credit to referrer when referee makes a purchase', async () => {
            const referrerUserId = 'referrer_123';
            const refereeUserId = userId; // reusing our test user as referee
            const packId = 'pack_referral_123';

            // Setup Referrer
            await db.insert(schema.users).values({ id: referrerUserId, email: 'referrer@test.com', role: 'user' }).run();

            // Setup Referral Code
            await db.insert(schema.referralCodes).values({
                id: 'code_123',
                tenantId,
                userId: referrerUserId,
                code: 'REFER20',
                active: true,
                earnings: 0
            }).run();

            // Setup Pending Reward
            await db.insert(schema.referralRewards).values({
                id: 'reward_123',
                tenantId,
                referrerUserId,
                referredUserId: refereeUserId,
                amount: 2000, // $20
                status: 'pending'
            }).run();

            // Setup Pack Definition
            await db.insert(schema.classPackDefinitions).values({
                id: packId, tenantId, name: 'Welcome Pack', price: 5000, credits: 5, active: true
            }).run();

            // Simulate Purchase Fulfillment
            const fulfillmentService = new FulfillmentService(db, undefined, { RESEND_API_KEY: 'mock' });
            await fulfillmentService.fulfillPackPurchase({
                packId,
                tenantId,
                userId: refereeUserId,
                memberId
            }, 'pay_123', 5000);

            // Verify Reward Status
            const reward = await db.query.referralRewards.findFirst({ where: eq(schema.referralRewards.id, 'reward_123') });
            expect(reward.status).toBe('paid');
            expect(reward.paidAt).toBeDefined();

            // Verify Referrer Earnings
            const code = await db.query.referralCodes.findFirst({ where: eq(schema.referralCodes.userId, referrerUserId) });
            expect(code.earnings).toBe(2000);
        });
    });

    describe('Waitlist Robustness', () => {
        it('automatically promotes waitlisted member when a booking is cancelled', async () => {
            const classId = 'class_waitlist_123';
            const confirmedMemberId = memberId;
            const waitlistedMemberId = 'member_waitlist_999';
            const waitlistedUserId = 'user_waitlist_999';

            // Setup Class (Capacity 1)
            await db.insert(schema.classes).values({
                id: classId,
                tenantId,
                title: 'Full Class',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                durationMinutes: 60,
                capacity: 1,
                status: 'active'
            }).run();

            // Setup Waitlisted User
            await db.insert(schema.users).values({ id: waitlistedUserId, email: 'waitlist@test.com', role: 'user' }).run();
            await db.insert(schema.tenantMembers).values({ id: waitlistedMemberId, tenantId, userId: waitlistedUserId, status: 'active' }).run();

            // Setup Bookings
            const confirmedBookingId = 'b_confirmed_123';
            const waitlistedBookingId = 'b_waitlist_123';

            await db.insert(schema.bookings).values({
                id: confirmedBookingId,
                classId,
                memberId: confirmedMemberId,
                status: 'confirmed',
                createdAt: new Date(Date.now() - 1000)
            }).run();

            await db.insert(schema.bookings).values({
                id: waitlistedBookingId,
                classId,
                memberId: waitlistedMemberId,
                status: 'waitlisted',
                waitlistPosition: 1,
                createdAt: new Date()
            }).run();

            // Cancel the confirmed booking via service
            const bookingService = new BookingService(db, { RESEND_API_KEY: 'mock' });
            await bookingService.cancelBooking(confirmedBookingId);

            // Verify waitlisted booking promoted
            const waitlistedBooking = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, waitlistedBookingId) });
            expect(waitlistedBooking.status).toBe('confirmed');
            expect(waitlistedBooking.waitlistPosition).toBeNull();
            expect(waitlistedBooking.waitlistNotifiedAt).toBeDefined();
        });
    });
});
