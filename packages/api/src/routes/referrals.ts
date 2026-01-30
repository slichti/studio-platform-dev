import { Hono } from 'hono';
import { createDb } from '../db';
import { referrals, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

async function getReferralStats(db: any, tenantId: string, code: string) {
    const completedCount = await db.select({ count: sql<number>`count(*)` })
        .from(referrals).where(and(eq(referrals.tenantId, tenantId), eq(referrals.code, code), eq(referrals.status, 'completed'))).get();
    return { conversions: completedCount?.count || 0, clicks: 0 };
}

// GET /referrals
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const filterAll = c.get('can')('manage_marketing');
    if (!filterAll && !member) return c.json({ error: 'Unauthorized' }, 403);

    const rawResults = await db.select({
        id: referrals.id, code: referrals.code, status: referrals.status, rewardType: referrals.rewardType,
        rewardValue: referrals.rewardValue, rewardedAt: referrals.rewardedAt, createdAt: referrals.createdAt,
        referrerId: tenantMembers.id, referrerEmail: users.email, referrerProfile: users.profile
    })
        .from(referrals)
        .innerJoin(tenantMembers, eq(referrals.referrerId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(filterAll ? eq(referrals.tenantId, tenant.id) : and(eq(referrals.tenantId, tenant.id), eq(referrals.referrerId, member!.id)))
        .orderBy(desc(referrals.createdAt)).all();

    const results = await Promise.all(rawResults.map(async (r) => ({
        ...r, referrer: { id: r.referrerId, user: { email: r.referrerEmail, profile: r.referrerProfile } },
        stats: await getReferralStats(db, tenant.id, r.code)
    })));

    return c.json(results);
});

// GET /my-code
app.get('/my-code', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 400);

    let existing = await db.select({ id: referrals.id, code: referrals.code }).from(referrals)
        .where(and(eq(referrals.tenantId, tenant.id), eq(referrals.referrerId, member.id), eq(referrals.status, 'pending'))).get();

    if (existing) return c.json({ code: existing.code });

    const code = generateCode();
    await db.insert(referrals).values({ id: crypto.randomUUID(), tenantId: tenant.id, referrerId: member.id, code, status: 'pending' }).run();
    return c.json({ code });
});

// POST /redeem
app.post('/redeem', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 400);

    const { code } = await c.req.json();
    if (!code) return c.json({ error: 'Code required' }, 400);

    const referral = await db.select().from(referrals)
        .where(and(eq(referrals.tenantId, tenant.id), eq(referrals.code, code.toUpperCase()), eq(referrals.status, 'pending'))).get();

    if (!referral) return c.json({ error: 'Invalid code' }, 404);
    if (referral.referrerId === member.id) return c.json({ error: 'Cannot self-refer' }, 400);

    await db.update(referrals).set({ status: 'completed', refereeId: member.id }).where(eq(referrals.id, referral.id)).run();
    return c.json({ success: true });
});

// POST /:id/reward
app.post('/:id/reward', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);
    const { rewardType, rewardValue } = await c.req.json();

    await db.update(referrals).set({ status: 'rewarded', rewardType, rewardValue, rewardedAt: new Date() })
        .where(and(eq(referrals.id, c.req.param('id')), eq(referrals.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

// GET /stats
app.get('/stats', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const all = await db.select({ status: referrals.status }).from(referrals).where(eq(referrals.tenantId, tenant.id)).all();
    return c.json({
        total: all.length, pending: all.filter(r => r.status === 'pending').length,
        completed: all.filter(r => r.status === 'completed').length, rewarded: all.filter(r => r.status === 'rewarded').length
    });
});

export default app;
