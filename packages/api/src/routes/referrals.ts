import { Hono } from 'hono';
import { createDb } from '../db';
import { referrals, tenantMembers, users, tenants } from 'db';
import { eq, and, desc, sql } from 'drizzle-orm';

interface Bindings {
    DB: D1Database;
}

interface Variables {
    auth: { userId: string; };
    tenant: typeof tenants.$inferSelect;
    member: typeof tenantMembers.$inferSelect;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Generate unique referral code
function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function getReferralStats(db: ReturnType<typeof createDb>, tenantId: string, code: string) {
    // Count how many times this code has been converted (if reusable) or just return 1 if completed
    const completedCount = await db.select({ count: sql<number>`count(*)` })
        .from(referrals)
        .where(and(
            eq(referrals.tenantId, tenantId),
            eq(referrals.code, code),
            eq(referrals.status, 'completed')
        ))
        .get();

    return {
        conversions: completedCount?.count || 0,
        clicks: 0 // Placeholder
    };
}

// GET /referrals - List referrals for current member or all (if owner)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    const isOwner = roles.includes('owner');

    const rawResults = await db.select({
        id: referrals.id,
        code: referrals.code,
        status: referrals.status,
        rewardType: referrals.rewardType,
        rewardValue: referrals.rewardValue,
        rewardedAt: referrals.rewardedAt,
        createdAt: referrals.createdAt,
        referrerId: tenantMembers.id,
        referrerEmail: users.email,
        referrerProfile: users.profile
    })
        .from(referrals)
        .innerJoin(tenantMembers, eq(referrals.referrerId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(
            isOwner
                ? eq(referrals.tenantId, tenant.id)
                : and(eq(referrals.tenantId, tenant.id), eq(referrals.referrerId, member.id))
        )
        .orderBy(desc(referrals.createdAt))
        .all();

    const results = await Promise.all(rawResults.map(async (r) => {
        const stats = await getReferralStats(db, tenant.id, r.code);
        return {
            id: r.id,
            code: r.code,
            status: r.status,
            rewardType: r.rewardType,
            rewardValue: r.rewardValue,
            rewardedAt: r.rewardedAt,
            createdAt: r.createdAt,
            referrer: {
                id: r.referrerId,
                user: {
                    email: r.referrerEmail,
                    profile: r.referrerProfile
                }
            },
            stats
        };
    }));

    return c.json(results);
});

// GET /referrals/my-code - Get or create current member's referral code
app.get('/my-code', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    // Check for existing active referral
    let existing = await db.select({ id: referrals.id, code: referrals.code })
        .from(referrals)
        .where(and(
            eq(referrals.tenantId, tenant.id),
            eq(referrals.referrerId, member.id),
            eq(referrals.status, 'pending')
        ))
        .get();

    if (existing) {
        return c.json({ code: existing.code });
    }

    // Create new referral code
    const id = crypto.randomUUID();
    const code = generateCode();

    await db.insert(referrals).values({
        id,
        tenantId: tenant.id,
        referrerId: member.id,
        code,
        status: 'pending'
    });

    return c.json({ code });
});

// POST /referrals/redeem - Redeem a referral code (called during signup)
app.post('/redeem', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    const { code } = await c.req.json();
    if (!code) return c.json({ error: 'Code is required' }, 400);

    // Find matching referral
    const referral = await db.select()
        .from(referrals)
        .where(and(
            eq(referrals.tenantId, tenant.id),
            eq(referrals.code, code.toUpperCase()),
            eq(referrals.status, 'pending')
        ))
        .get();

    if (!referral) {
        return c.json({ error: 'Invalid or expired referral code' }, 404);
    }

    if (referral.referrerId === member.id) {
        return c.json({ error: 'Cannot use your own referral code' }, 400);
    }

    // Mark as completed
    await db.update(referrals)
        .set({
            status: 'completed',
            refereeId: member.id
        })
        .where(eq(referrals.id, referral.id))
        .run();

    return c.json({ success: true, message: 'Referral applied!' });
});

// POST /referrals/:id/reward - Manually reward a referral (owner only)
app.post('/:id/reward', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const referralId = c.req.param('id');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access denied' }, 403);

    const { rewardType, rewardValue } = await c.req.json();

    await db.update(referrals)
        .set({
            status: 'rewarded',
            rewardType,
            rewardValue,
            rewardedAt: new Date()
        })
        .where(and(eq(referrals.id, referralId), eq(referrals.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// GET /referrals/stats - Get referral program stats (owner only)
app.get('/stats', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access denied' }, 403);

    const all = await db.select({ status: referrals.status })
        .from(referrals)
        .where(eq(referrals.tenantId, tenant.id))
        .all();

    const stats = {
        total: all.length,
        pending: all.filter(r => r.status === 'pending').length,
        completed: all.filter(r => r.status === 'completed').length,
        rewarded: all.filter(r => r.status === 'rewarded').length
    };

    return c.json(stats);
});

export default app;
