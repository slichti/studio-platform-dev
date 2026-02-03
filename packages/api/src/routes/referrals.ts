import { Hono } from 'hono';
import { createDb } from '../db';
import { referralCodes, referralRewards, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { StudioVariables, Bindings } from '../types';

const app = new Hono<{ Variables: StudioVariables, Bindings: Bindings }>();

function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// GET /referrals/stats (User's Dashboard)
app.get('/stats', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member'); // The current user/member context

    if (!tenant || !member) return c.json({ error: 'Unauthorized' }, 401);

    // 1. Get My Code
    let myCode = await db.select().from(referralCodes)
        .where(and(eq(referralCodes.tenantId, tenant.id), eq(referralCodes.userId, member.userId)))
        .get();

    if (!myCode) {
        // Auto-generate if missing
        const code = generateCode();
        await db.insert(referralCodes).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            userId: member.userId,
            memberId: member.id,
            code: code,
            active: true
        }).run();
        myCode = { code, clicks: 0, signups: 0, earnings: 0 } as any;
    }

    // 2. Get Rewards History
    const rewards = await db.select({
        id: referralRewards.id,
        status: referralRewards.status,
        amount: referralRewards.amount,
        currency: referralRewards.currency,
        createdAt: referralRewards.createdAt,
        referredUser: {
            firstName: sql<string>`json_extract(${users.profile}, '$.firstName')`,
        }
    })
        .from(referralRewards)
        .innerJoin(users, eq(referralRewards.referredUserId, users.id))
        .where(and(
            eq(referralRewards.tenantId, tenant.id),
            eq(referralRewards.referrerUserId, member.userId)
        ))
        .orderBy(desc(referralRewards.createdAt))
        .all();

    return c.json({
        code: myCode!.code,
        stats: {
            clicks: myCode!.clicks,
            signups: myCode!.signups,
            earnings: myCode!.earnings
        },
        history: rewards
    });
});

// POST /referrals/validate (For Signup Form)
app.post('/validate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { code } = await c.req.json();
    if (!code) return c.json({ valid: false });

    // Check code existence
    const ref = await db.select().from(referralCodes)
        .where(and(
            eq(referralCodes.tenantId, tenant.id),
            eq(referralCodes.code, code.toUpperCase()),
            eq(referralCodes.active, true)
        ))
        .get();

    if (!ref) return c.json({ valid: false });

    return c.json({ valid: true, referrerId: ref.userId });
});

// POST /referrals/apply (Claim a code)
app.post('/apply', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Auth required' }, 401);

    const { code } = await c.req.json();
    if (!code) return c.json({ error: 'Code required' }, 400);

    // 1. Validate Code
    const ref = await db.select().from(referralCodes)
        .where(and(
            eq(referralCodes.tenantId, tenant.id),
            eq(referralCodes.code, code.toUpperCase()),
            eq(referralCodes.active, true)
        ))
        .get();

    if (!ref) return c.json({ error: 'Invalid code' }, 400);
    if (ref.userId === member.userId) return c.json({ error: 'Cannot refer yourself' }, 400);

    // 2. Check overlap
    const existing = await db.select().from(referralRewards)
        .where(and(
            eq(referralRewards.tenantId, tenant.id),
            eq(referralRewards.referredUserId, member.userId)
        )) // User can only be referred ONCE per tenant? Usually yes.
        .get();

    if (existing) return c.json({ error: 'Already referred' }, 400);

    // 3. Create Reward (Pending)
    // "Give 20, Get 20" model. We track the reward for the referrer.
    // The referee gets their reward immediately? Or via coupon?
    // Implementation: Just track the relationship now.

    await db.insert(referralRewards).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        referrerUserId: ref.userId,
        referredUserId: member.userId,
        amount: 2000, // $20.00 standard (This should define on tenant config in future)
        status: 'pending',
        createdAt: new Date()
    }).run();

    // 4. Update Stats
    await db.update(referralCodes)
        .set({ signups: sql`${referralCodes.signups} + 1` })
        .where(eq(referralCodes.id, ref.id))
        .run();

    return c.json({ success: true });
});

// POST /referrals/track-click (Optional telemetry)
app.post('/track-click', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { code } = await c.req.json();

    if (tenant && code) {
        // Atomic Increment
        await db.update(referralCodes)
            .set({ clicks: sql`${referralCodes.clicks} + 1` })
            .where(and(eq(referralCodes.tenantId, tenant.id), eq(referralCodes.code, code)))
            .run();
    }
    return c.json({ success: true });
});

export default app;
