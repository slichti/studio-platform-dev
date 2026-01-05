
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { createDb } from '../db';
import { challenges, userChallenges } from 'db/src/schema'; // Updated import path
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: { id: string };
    roles: string[];
    member: { userId: string };
    auth: { userId: string };
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /challenges - List all challenges for the tenant
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    // Safety check for tenant context
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const result = await db.select()
        .from(challenges)
        .where(and(
            eq(challenges.tenantId, tenant.id),
            eq(challenges.active, true)
        ))
        .orderBy(desc(challenges.createdAt));

    return c.json(result);
});

// POST /challenges - Create a new challenge (Admin only)
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // Authorization check
    if (!roles.includes('admin') && !roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const body = await c.req.json();
    const { title, description, type, targetValue, rewardType, rewardValue, startDate, endDate } = body;

    const newChallenge = await db.insert(challenges).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        title,
        description,
        type: type as 'count' | 'streak',
        targetValue,
        rewardType: rewardType as 'badge' | 'coupon' | 'retail_credit',
        rewardValue,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        active: true
    }).returning().get();

    return c.json(newChallenge);
});

// GET /challenges/my-progress - Get current user's progress
app.get('/my-progress', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 401);

    const activeChallenges = await db.select()
        .from(challenges)
        .where(
            and(
                eq(challenges.tenantId, tenant.id),
                eq(challenges.active, true)
            )
        );

    const progressMap = new Map();
    const userProgress = await db.select()
        .from(userChallenges)
        .where(
            and(
                eq(userChallenges.userId, member.userId),
                eq(userChallenges.tenantId, tenant.id)
            )
        );

    userProgress.forEach(p => progressMap.set(p.challengeId, p));

    const enriched = activeChallenges.map(ch => ({
        ...ch,
        userProgress: progressMap.get(ch.id) || { progress: 0, status: 'active' }
    }));

    return c.json(enriched);
});

export default app;
