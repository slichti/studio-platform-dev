
import { D1Database } from '@cloudflare/workers-types';
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { challenges, userChallenges, users, giftCards } from '@studio/db/src/schema';

type Env = {
    DB: D1Database;
    [key: string]: any;
}

function isD1Database(db: any): db is D1Database {
    return db && typeof db === 'object' && 'prepare' in db;
}

export class ChallengeService {
    private db: DrizzleD1Database<typeof schema>;
    private tenantId: string;

    constructor(dbOrD1: D1Database | DrizzleD1Database<any>, tenantId: string, private env?: Env) {
        if (isD1Database(dbOrD1)) {
            this.db = drizzle(dbOrD1, { schema });
        } else {
            // Re-cast with schema to ensure typing
            this.db = dbOrD1 as DrizzleD1Database<typeof schema>;
        }
        this.tenantId = tenantId;
    }

    // Join a challenge
    async joinChallenge(userId: string, challengeId: string) {
        // 1. Verify Challenge
        const challenge = await this.db.select().from(challenges).where(and(
            eq(challenges.id, challengeId),
            eq(challenges.tenantId, this.tenantId),
            eq(challenges.active, true)
        )).get();

        if (!challenge) throw new Error("Challenge not found or inactive");

        // 2. Check overlap
        const existing = await this.db.select().from(userChallenges).where(and(
            eq(userChallenges.userId, userId),
            eq(userChallenges.challengeId, challengeId)
        )).get();

        if (existing) throw new Error("Already joined");

        // 3. Create Record
        await this.db.insert(userChallenges).values({
            id: crypto.randomUUID(),
            tenantId: this.tenantId,
            userId,
            challengeId,
            progress: 0,
            status: 'active',
            createdAt: new Date()
        }).run();
    }

    async processClassAttendance(userId: string, classId: string, durationMinutes: number) {
        // 1. Get Active Challenges
        const activeChallenges = await this.db.select()
            .from(challenges)
            .where(and(
                eq(challenges.tenantId, this.tenantId),
                eq(challenges.active, true)
            ))
            .all();

        // 2. Filter by date overlap
        const now = new Date();
        const relevantChallenges = activeChallenges.filter(c => {
            const startOk = !c.startDate || new Date(c.startDate) <= now;
            const endOk = !c.endDate || new Date(c.endDate) >= now;
            return startOk && endOk;
        });

        for (const challenge of relevantChallenges) {
            // Calculate Increment based on Type
            let increment = 0;
            if (challenge.type === 'count') {
                increment = 1;
            } else if (challenge.type === 'minutes') {
                increment = durationMinutes;
            }

            if (increment > 0 || challenge.type === 'streak') {
                // Find or Create User Challenge progress
                let userProgress = await this.db.select()
                    .from(userChallenges)
                    .where(and(
                        eq(userChallenges.userId, userId),
                        eq(userChallenges.challengeId, challenge.id)
                    ))
                    .get();

                if (!userProgress) {
                    userProgress = await this.db.insert(userChallenges).values({
                        id: crypto.randomUUID(),
                        tenantId: this.tenantId,
                        userId: userId,
                        challengeId: challenge.id,
                        progress: 0,
                        status: 'active',
                        metadata: { currentCount: 0, streakCount: 0 },
                        createdAt: new Date()
                    }).returning().get();
                }

                if (userProgress.status === 'active') {
                    let newProgress = userProgress.progress;
                    let shouldUpdate = false;
                    let metadata: any = userProgress.metadata || {};

                    if (challenge.type === 'streak') {
                        const period = challenge.period || 'week';
                        const frequency = challenge.frequency || 1;

                        // Determine Current Period Key
                        let currentPeriodKey = '';
                        if (period === 'week') {
                            const oneJan = new Date(now.getFullYear(), 0, 1);
                            const days = Math.floor((now.getTime() - oneJan.getTime()) / 86400000);
                            const week = Math.ceil((now.getDay() + 1 + days) / 7);
                            currentPeriodKey = `${now.getFullYear()}-W${week}`;
                        } else if (period === 'month') {
                            currentPeriodKey = `${now.getFullYear()}-M${now.getMonth() + 1}`;
                        } else {
                            currentPeriodKey = now.toISOString().split('T')[0];
                        }

                        // Period Transition
                        if (metadata.currentPeriod !== currentPeriodKey) {
                            let isBroken = false;

                            if (metadata.currentPeriod) {
                                // 1. Did we complete the last period we attempted?
                                if (!metadata.periodCompleted) {
                                    isBroken = true;
                                } else {
                                    // 2. Gap Check (Simplified)
                                    if (period === 'week') {
                                        const [prevYear, prevWeek] = metadata.currentPeriod.split('-W').map(Number);
                                        const [currYear, currWeek] = currentPeriodKey.split('-W').map(Number);
                                        const diff = ((currYear * 52) + currWeek) - ((prevYear * 52) + prevWeek);
                                        if (diff > 1) isBroken = true;
                                    } else if (period === 'month') {
                                        const [prevYear, prevMonth] = metadata.currentPeriod.split('-M').map(Number);
                                        const [currYear, currMonth] = currentPeriodKey.split('-M').map(Number);
                                        const diff = ((currYear * 12) + currMonth) - ((prevYear * 12) + prevMonth);
                                        if (diff > 1) isBroken = true;
                                    } else if (period === 'day') {
                                        const prevDate = new Date(metadata.currentPeriod);
                                        const currDate = new Date(currentPeriodKey);
                                        const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
                                        if (diffDays > 1) isBroken = true;
                                    }
                                }
                            }

                            if (isBroken) {
                                newProgress = 0; // Break streak
                            }

                            // Reset for new period
                            metadata.currentPeriod = currentPeriodKey;
                            metadata.currentCount = 0;
                            metadata.periodCompleted = false;
                            shouldUpdate = true;
                        }

                        // Increment for this period
                        metadata.currentCount = (metadata.currentCount || 0) + 1;
                        shouldUpdate = true;

                        // Check Completion
                        if (metadata.currentCount >= frequency && !metadata.periodCompleted) {
                            metadata.periodCompleted = true;
                            newProgress += 1;
                            shouldUpdate = true;
                        }
                    } else {
                        // Count / Minutes
                        newProgress += increment;
                        shouldUpdate = true;
                    }

                    if (shouldUpdate) {
                        const isCompleted = newProgress >= challenge.targetValue;

                        await this.db.update(userChallenges)
                            .set({
                                progress: newProgress,
                                status: isCompleted ? 'completed' : 'active',
                                metadata: metadata,
                                completedAt: isCompleted ? new Date() : null,
                                updatedAt: new Date()
                            })
                            .where(eq(userChallenges.id, userProgress.id))
                            .run();

                        if (isCompleted) {
                            // Reward Fulfillment
                            if (challenge.rewardType === 'retail_credit') {
                                const val = challenge.rewardValue as any;
                                const creditAmount = typeof val === 'object' && val?.creditAmount ? parseInt(val.creditAmount) * 100 : 0;

                                if (creditAmount > 0) {
                                    const code = `REW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

                                    await this.db.insert(giftCards).values({
                                        id: crypto.randomUUID(),
                                        tenantId: this.tenantId,
                                        code,
                                        initialValue: creditAmount,
                                        currentBalance: creditAmount,
                                        status: 'active',
                                        createdAt: new Date(),
                                        expiryDate: null // Fixed: expiryDate matches schema
                                    }).run();
                                    console.log(`[Challenge] Awarded ${creditAmount} credit to user ${userId}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    async getLeaderboard(limit = 10) {
        const results = await this.db.select({
            userId: userChallenges.userId,
            completedCount: sql<number>`count(*)`,
            totalPoints: sql<number>`count(*) * 100`
        })
            .from(userChallenges)
            .where(eq(userChallenges.status, 'completed'))
            .groupBy(userChallenges.userId)
            .orderBy(desc(sql`count(*)`))
            .limit(limit)
            .all();

        const enriched = [];
        for (const row of results) {
            const user = await this.db.query.users.findFirst({
                where: eq(users.id, row.userId),
            });
            enriched.push({ ...row, user });
        }

        return enriched;
    }
}
