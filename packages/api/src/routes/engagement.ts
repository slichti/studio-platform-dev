import { Hono } from 'hono';
import { createDb } from 'db/src/client';
import { tenantMembers, bookings, classes, subscriptions, users, purchasedPacks } from 'db/src/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

interface Bindings {
    DB: D1Database;
}

interface Variables {
    auth: { userId: string; };
    tenant?: any;
    member?: any;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Calculate engagement score for a member
async function calculateEngagementScore(db: any, memberId: string, tenantId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // 1. Attendance frequency (0-40 points)
    const recentBookings = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(bookings.memberId, memberId),
            eq(bookings.status, 'confirmed'),
            gte(bookings.createdAt, thirtyDaysAgo)
        ))
        .get();

    const attendancePoints = Math.min(40, (recentBookings?.count || 0) * 5);

    // 2. Active membership/packs (0-30 points)
    const activeSub = await db.select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.memberId, memberId), eq(subscriptions.status, 'active')))
        .get();

    const activePacks = await db.select({ count: sql<number>`count(*)` })
        .from(purchasedPacks)
        .where(and(
            eq(purchasedPacks.memberId, memberId),
            sql`${purchasedPacks.remainingCredits} > 0`
        ))
        .get();

    let membershipPoints = 0;
    if (activeSub) membershipPoints = 30;
    else if ((activePacks?.count || 0) > 0) membershipPoints = 20;

    // 3. Consistency over time (0-30 points)
    const olderBookings = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(bookings.memberId, memberId),
            eq(bookings.status, 'confirmed'),
            gte(bookings.createdAt, ninetyDaysAgo)
        ))
        .get();

    const consistencyPoints = Math.min(30, Math.floor((olderBookings?.count || 0) / 3));

    return Math.min(100, attendancePoints + membershipPoints + consistencyPoints);
}

// GET /engagement - List members with scores
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) return c.json({ error: 'Access denied' }, 403);

    const filter = c.req.query('filter'); // 'at_risk', 'engaged', 'inactive'

    let members = await db.select({
        id: tenantMembers.id,
        engagementScore: tenantMembers.engagementScore,
        churnStatus: tenantMembers.churnStatus,
        status: tenantMembers.status,
        joinedAt: tenantMembers.joinedAt,
        user: {
            id: users.id,
            email: users.email,
            profile: users.profile
        }
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tenantMembers.tenantId, tenant.id))
        .orderBy(desc(tenantMembers.engagementScore))
        .all();

    // Apply filter
    if (filter === 'at_risk') {
        members = members.filter((m: any) => (m.engagementScore || 50) < 30);
    } else if (filter === 'engaged') {
        members = members.filter((m: any) => (m.engagementScore || 50) >= 70);
    } else if (filter === 'inactive') {
        members = members.filter((m: any) => (m.engagementScore || 50) < 20);
    }

    return c.json(members);
});

// POST /engagement/recalculate - Recalculate all engagement scores
app.post('/recalculate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access denied' }, 403);

    const members = await db.select({ id: tenantMembers.id })
        .from(tenantMembers)
        .where(eq(tenantMembers.tenantId, tenant.id))
        .all();

    let updated = 0;
    for (const member of members) {
        const score = await calculateEngagementScore(db, member.id, tenant.id);
        await db.update(tenantMembers)
            .set({
                engagementScore: score,
                lastEngagementCalc: new Date()
            })
            .where(eq(tenantMembers.id, member.id))
            .run();
        updated++;
    }

    return c.json({ success: true, updated });
});

// GET /engagement/summary - Get engagement distribution
app.get('/summary', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access denied' }, 403);

    const members = await db.select({ engagementScore: tenantMembers.engagementScore })
        .from(tenantMembers)
        .where(eq(tenantMembers.tenantId, tenant.id))
        .all();

    const total = members.length;
    const engaged = members.filter((m: any) => (m.engagementScore || 50) >= 70).length;
    const moderate = members.filter((m: any) => (m.engagementScore || 50) >= 30 && (m.engagementScore || 50) < 70).length;
    const atRisk = members.filter((m: any) => (m.engagementScore || 50) < 30).length;

    const avgScore = total ? Math.round(members.reduce((sum: number, m: any) => sum + (m.engagementScore || 50), 0) / total) : 0;

    return c.json({
        total,
        engaged,
        moderate,
        atRisk,
        avgScore,
        distribution: {
            engaged: total ? Math.round(engaged / total * 100) : 0,
            moderate: total ? Math.round(moderate / total * 100) : 0,
            atRisk: total ? Math.round(atRisk / total * 100) : 0
        }
    });
});

export default app;
