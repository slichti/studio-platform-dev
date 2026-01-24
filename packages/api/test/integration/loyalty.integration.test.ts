
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { ChallengeService } from '../../src/services/challenges';
import { createDb } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';
import { challenges, userChallenges, giftCards } from '@studio/db/src/schema';

describe('Loyalty Integration', () => {
    const TENANT_ID = 'loyalty_tenant_1';
    const USER_ID = 'loyalty_user_1';
    const CHALLENGE_COUNT_ID = 'ch_count_1';
    const CHALLENGE_STREAK_ID = 'ch_streak_1';

    let db: any;
    let service: ChallengeService;

    beforeAll(async () => {
        db = createDb(env.DB);

        // 1. Cleanup
        await env.DB.batch([
            env.DB.prepare('DROP TABLE IF EXISTS challenges'),
            env.DB.prepare('DROP TABLE IF EXISTS user_challenges'),
            env.DB.prepare('DROP TABLE IF EXISTS gift_cards'),
            env.DB.prepare('DROP TABLE IF EXISTS users'),
            env.DB.prepare('DROP TABLE IF EXISTS tenant_members'),
            env.DB.prepare('DROP TABLE IF EXISTS tenants'),
        ]);

        // 2. Schema Setup
        await env.DB.batch([
            env.DB.prepare(`CREATE TABLE tenants (id TEXT PRIMARY KEY, slug TEXT, name TEXT, settings TEXT)`),
            env.DB.prepare(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, profile TEXT, last_location TEXT)`),
            env.DB.prepare(`CREATE TABLE tenant_members (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT)`),

            env.DB.prepare(`CREATE TABLE challenges (
                id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, description TEXT, type TEXT,
                target_value INTEGER, reward_type TEXT, reward_value TEXT, active INTEGER,
                start_date INTEGER, end_date INTEGER, frequency INTEGER, period TEXT,
                created_at INTEGER, updated_at INTEGER
            )`),

            env.DB.prepare(`CREATE TABLE user_challenges (
                id TEXT PRIMARY KEY, tenant_id TEXT, challenge_id TEXT, user_id TEXT,
                status TEXT, progress INTEGER, completed_at INTEGER, joined_at INTEGER,
                current_streak INTEGER, best_streak INTEGER, last_activity_date INTEGER,
                period_progress INTEGER, current_period_start INTEGER, metadata TEXT,
                created_at INTEGER, updated_at INTEGER
            )`),

            env.DB.prepare(`CREATE TABLE gift_cards (
                id TEXT PRIMARY KEY, tenant_id TEXT, code TEXT, initial_value INTEGER,
                current_balance INTEGER, status TEXT, created_by TEXT, purchased_by TEXT,
                recipient_email TEXT, expiry_date INTEGER, created_at INTEGER, updated_at INTEGER,
                buyer_member_id TEXT, recipient_member_id TEXT, notes TEXT
            )`),
        ]);

        // 3. Seed Data
        await env.DB.prepare(`INSERT INTO tenants (id, slug, name, settings) VALUES (?, ?, ?, ?)`).bind(
            TENANT_ID, 'loyalstudio', 'Loyalty Studio', '{}'
        ).run();

        await env.DB.prepare(`INSERT INTO users (id, email, profile) VALUES (?, ?, ?)`).bind(USER_ID, 'loyal@test.com', '{}').run();

        // Count Challenge: 5 classes
        await env.DB.prepare(`INSERT INTO challenges (id, tenant_id, title, type, target_value, reward_type, reward_value, active, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            CHALLENGE_COUNT_ID, TENANT_ID, 'Count Challenge', 'count', 5, 'retail_credit', JSON.stringify({ creditAmount: 10 }), 1, null, null
        ).run();

        // Streak Challenge: 2 times per week
        await env.DB.prepare(`INSERT INTO challenges (id, tenant_id, title, type, target_value, reward_type, reward_value, active, start_date, end_date, frequency, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            CHALLENGE_STREAK_ID, TENANT_ID, 'Streak Challenge', 'streak', 3, 'badge', '{}', 1, null, null, 2, 'week'
        ).run();

        service = new ChallengeService(db, TENANT_ID);
    });

    it('should run full loyalty lifecycle', async () => {
        // 1. Join Challenges
        await service.joinChallenge(USER_ID, CHALLENGE_COUNT_ID);
        await service.joinChallenge(USER_ID, CHALLENGE_STREAK_ID);

        const myChallenges = await env.DB.prepare('SELECT * FROM user_challenges WHERE user_id = ?').bind(USER_ID).all();
        expect(myChallenges.results.length).toBe(2);

        // 2. Count Challenge Progress
        // Initial state: 0/5
        await service.processClassAttendance(USER_ID, 'class_1', 60);

        let record = await env.DB.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?').bind(USER_ID, CHALLENGE_COUNT_ID).first();
        expect(record).not.toBeNull();
        expect(record.progress).toBe(1);
        expect(record.status).toBe('active');

        // 3. Complete Count Challenge
        // Need 4 more check-ins
        for (let i = 0; i < 4; i++) {
            await service.processClassAttendance(USER_ID, 'class_1', 60);
        }

        record = await env.DB.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?').bind(USER_ID, CHALLENGE_COUNT_ID).first();
        expect(record.progress).toBe(5);
        expect(record.status).toBe('completed');
        expect(record.completed_at).toBeTruthy();

        // Check Reward
        const giftCard = await env.DB.prepare('SELECT * FROM gift_cards').first();
        expect(giftCard).toBeTruthy();
        expect(giftCard.initial_value).toBe(1000); // $10.00

        // 4. Streak Logic
        // Since we did 5 check-ins for the Count Challenge, they also count for the Streak Challenge.
        // Streak Challenge = 2/week. 
        // 5 Check-ins in same period (now).
        // Check 1: Period 1, Prog 1.
        // Check 2: Period 1, Prog 2. Target Met? Streak = 1.
        // Check 3: Period 1, Prog 3.

        record = await env.DB.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?').bind(USER_ID, CHALLENGE_STREAK_ID).first();

        // Verify streak
        expect(record.progress).toBe(1);
        const meta = JSON.parse(record.metadata as string);
        expect(meta.currentCount).toBeGreaterThanOrEqual(2);

        // 5. Leaderboard
        const leaderboard = await service.getLeaderboard(10);
        expect(leaderboard.length).toBeGreaterThan(0);
        const userEntry = leaderboard.find(e => e.userId === USER_ID);
        expect(userEntry).toBeTruthy();
        expect(userEntry.completedCount).toBe(1);
    });
});
