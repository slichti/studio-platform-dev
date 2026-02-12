import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { ChallengeService } from '../../src/services/challenges';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Loyalty Integration', () => {
    const TENANT_ID = 'loyalty_tenant_1';
    const USER_ID = 'loyalty_user_1';
    const CHALLENGE_COUNT_ID = 'ch_count_1';
    const CHALLENGE_STREAK_ID = 'ch_streak_1';

    let db: any;
    let service: ChallengeService;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 3. Seed Data
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'loyalstudio',
            name: 'Loyalty Studio',
            settings: {}
        }).run();

        await db.insert(schema.users).values({
            id: USER_ID,
            email: 'loyal@test.com',
            profile: {}
        }).run();

        // Count Challenge: 5 classes
        await db.insert(schema.challenges).values({
            id: CHALLENGE_COUNT_ID,
            tenantId: TENANT_ID,
            title: 'Count Challenge',
            type: 'count',
            targetValue: 5,
            rewardType: 'retail_credit',
            rewardValue: { creditAmount: 10 },
            active: 1
        }).run();

        // Streak Challenge: 2 times per week
        await db.insert(schema.challenges).values({
            id: CHALLENGE_STREAK_ID,
            tenantId: TENANT_ID,
            title: 'Streak Challenge',
            type: 'streak',
            targetValue: 3,
            rewardType: 'badge',
            rewardValue: {},
            active: 1,
            frequency: 2,
            period: 'week'
        }).run();

        service = new ChallengeService(db, TENANT_ID);
    });

    it('should run full loyalty lifecycle', async () => {
        // 1. Join Challenges
        await service.joinChallenge(USER_ID, CHALLENGE_COUNT_ID);
        await service.joinChallenge(USER_ID, CHALLENGE_STREAK_ID);

        const myChallenges = await db.select().from(schema.userChallenges).where(eq(schema.userChallenges.userId, USER_ID)).all();
        expect(myChallenges.length).toBe(2);

        // 2. Count Challenge Progress
        // Initial state: 0/5
        await service.processClassAttendance(USER_ID, 'class_1', 60);

        let record = await db.query.userChallenges.findFirst({
            where: (uc: any, { and, eq }: any) => and(eq(uc.userId, USER_ID), eq(uc.challengeId, CHALLENGE_COUNT_ID))
        });
        expect(record).not.toBeNull();
        expect(record.progress).toBe(1);
        expect(record.status).toBe('active');

        // 3. Complete Count Challenge
        // Need 4 more check-ins
        for (let i = 0; i < 4; i++) {
            await service.processClassAttendance(USER_ID, 'class_1', 60);
        }

        record = await db.query.userChallenges.findFirst({
            where: (uc: any, { and, eq }: any) => and(eq(uc.userId, USER_ID), eq(uc.challengeId, CHALLENGE_COUNT_ID))
        });
        expect(record.progress).toBe(5);
        expect(record.status).toBe('completed');
        expect(record.completedAt).toBeTruthy();

        // Check Reward
        const giftCard = await db.select().from(schema.giftCards).get();
        expect(giftCard).toBeTruthy();
        expect(giftCard.initialValue).toBe(1000); // $10.00

        // 4. Streak Logic
        record = await db.query.userChallenges.findFirst({
            where: (uc: any, { and, eq }: any) => and(eq(uc.userId, USER_ID), eq(uc.challengeId, CHALLENGE_STREAK_ID))
        });

        // Verify streak
        expect(record.progress).toBe(1);
        const meta = record.metadata as any;
        expect(meta.currentCount).toBeGreaterThanOrEqual(2);

        // 5. Leaderboard
        const leaderboard = await service.getLeaderboard(10);
        expect(leaderboard.length).toBeGreaterThan(0);
        const userEntry = leaderboard.find(e => e.userId === USER_ID);
        expect(userEntry).toBeTruthy();
        expect(userEntry.completedCount).toBe(1);
    });
});

import { eq } from 'drizzle-orm';
