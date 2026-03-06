import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, users, emailLogs, smsLogs, marketingAutomations, auditLogs, tenantRoles } from '@studio/db/src/schema'; // Ensure imports
import { count, eq, gt, gte, desc, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// Protect all stats routes
app.use('*', authMiddleware);
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    const db = createDb(c.env.DB);

    const user = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (user?.role !== 'admin' && !user?.isPlatformAdmin) {
        return c.json({ error: 'Platform Admin privileges required' }, 403);
    }
    await next();
});

// GET /health - Dashboard Key Metrics
app.get('/health', async (c) => {
    const db = createDb(c.env.DB);
    const { PricingService, TIERS } = await import('../services/pricing');
    await PricingService.loadTiersFromDb(db);
    const start = performance.now();

    // Parallel Queries
    // Calculate MRR based on Tenant Tiers using PricingService
    const [tenantStats, userCount, errorCount, dbCheck] = await Promise.all([
        db.select({
            tier: tenants.tier,
            count: count()
        }).from(tenants)
            .where(eq(tenants.status, 'active'))
            .groupBy(tenants.tier)
            .all(),
        db.select({ count: count() }).from(users).get(),
        Promise.resolve({ count: 0 }),
        db.select({ count: count() }).from(users).limit(1).get()
    ]);

    let estimatedMRR = 0;
    let activeTenants = 0;

    // Get tier prices from PricingService (in cents, convert to dollars)
    const tierPrices: Record<string, number> = {
        launch: TIERS.launch.price / 100,
        growth: TIERS.growth.price / 100,
        scale: TIERS.scale.price / 100
    };

    tenantStats.forEach(stat => {
        activeTenants += stat.count;
        const price = tierPrices[stat.tier || 'launch'] || 0;
        estimatedMRR += price * stat.count;
    });

    const dbLatencyMs = Math.round(performance.now() - start);

    return c.json({
        status: dbLatencyMs > 500 ? 'degraded' : 'healthy',
        dbLatencyMs,
        activeTenants,
        totalUsers: userCount?.count || 0,
        recentErrors: errorCount?.count || 0,
        estimatedMRR,
        error: null
    });
});

// GET /architecture - System Architecture Metrics
app.get('/architecture', async (c) => {
    const db = createDb(c.env.DB);

    // 1. Database Latency Check (Keep separate for accurate isolated measurement)
    const start = performance.now();
    try {
        await db.select({ count: count() }).from(users).get();
    } catch (e) {
        // ignore
    }
    const dbLatency = Math.round(performance.now() - start);

    // Run heavier queries in parallel
    const [connectedUsers, userRegions, tenantCount] = await Promise.all([
        // 2. Connected Users
        (async () => {
            if (c.env.METRICS) {
                try {
                    const doId = c.env.METRICS.idFromName('global');
                    const stub = c.env.METRICS.get(doId);
                    const res = await stub.fetch('http://do/stats');
                    const data: any = await res.json();
                    return data.activeUsers || 0;
                } catch (e) {
                    console.error("Failed to fetch active users from DO", e);
                    return 0;
                }
            } else {
                try {
                    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                    const result = await db.select({ count: count() })
                        .from(users)
                        .where(gt(users.lastActiveAt, fifteenMinutesAgo))
                        .get();
                    return result?.count || 0;
                } catch (e) { return 0; }
            }
        })(),

        // 3. User Geography
        (async () => {
            try {
                const activeUsersWithLocation = await db.select({
                    location: users.lastLocation
                })
                    .from(users)
                    .where(gt(users.lastActiveAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))) // Active in last 30 days
                    .all();

                const regionMap = new Map();

                for (const u of activeUsersWithLocation) {
                    const loc = u.location as any;
                    if (loc && loc.country) {
                        const key = loc.country;
                        if (!regionMap.has(key)) {
                            regionMap.set(key, {
                                code: loc.country,
                                name: loc.country,
                                count: 0,
                                lat: loc.lat || 0,
                                lng: loc.lng || 0
                            });
                        }
                        regionMap.get(key).count++;
                    }
                }

                return Array.from(regionMap.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
            } catch (e) {
                console.error("Failed to fetch user geography", e);
                return [];
            }
        })(),

        // 4. Tenant Count
        (async () => {
            try {
                const result = await db.select({ count: count() }).from(tenants).get();
                return result?.count || 0;
            } catch (e) { return 0; }
        })()
    ]);

    // 5. Service Status
    const services = {
        database: true,
        auth: true,
        storage: true,
        edge: true,
        stripe: !!c.env.STRIPE_SECRET_KEY
    };

    return c.json({
        latency: {
            database_ms: dbLatency,
            edge_ms: 10 // Estimated
        },
        worker: {
            region: (c.req.raw as any).cf?.colo || 'ORD', // Default to ORD (Chicago) if local
            memory_used_mb: Math.floor(Math.random() * 50) + 10 // Simulated for now
        },
        connectedUsers,
        tenantCount,
        userRegions,
        services,
    });
});

// GET /email - Global Email Stats
app.get('/email', async (c) => {
    const db = createDb(c.env.DB);

    const totalResult = await db.select({ count: count() }).from(emailLogs).get();
    const totalSent = totalResult?.count || 0;

    const byTenant = await db.select({
        tenantName: tenants.name,
        slug: tenants.slug,
        count: count(emailLogs.id)
    })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .groupBy(emailLogs.tenantId)
        .orderBy(desc(count(emailLogs.id)))
        .limit(20)
        .all();

    const recentLogs = await db.select({
        id: emailLogs.id,
        subject: emailLogs.subject,
        recipient: emailLogs.recipientEmail,
        sentAt: emailLogs.sentAt,
        tenantName: tenants.name
    })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .orderBy(desc(emailLogs.sentAt))
        .limit(50)
        .all();

    return c.json({ totalSent, byTenant, recentLogs });
});

// GET /sms - Global SMS Stats
app.get('/sms', async (c) => {
    const db = createDb(c.env.DB);

    const totalResult = await db.select({ count: count() }).from(smsLogs).get();
    const totalSent = totalResult?.count || 0;

    const byTenant = await db.select({
        tenantName: tenants.name,
        slug: tenants.slug,
        count: count(smsLogs.id)
    })
        .from(smsLogs)
        .leftJoin(tenants, eq(smsLogs.tenantId, tenants.id))
        .groupBy(smsLogs.tenantId)
        .orderBy(desc(count(smsLogs.id)))
        .limit(20)
        .all();

    const recentLogs = await db.select({
        id: smsLogs.id,
        body: smsLogs.body,
        recipient: smsLogs.recipientPhone,
        sentAt: smsLogs.sentAt,
        status: smsLogs.status,
        tenantName: tenants.name
    })
        .from(smsLogs)
        .leftJoin(tenants, eq(smsLogs.tenantId, tenants.id))
        .orderBy(desc(smsLogs.sentAt))
        .limit(50)
        .all();

    return c.json({ totalSent, byTenant, recentLogs });
});

// GET /communications - Unified Comms Stats
app.get('/communications', async (c) => {
    const db = createDb(c.env.DB);

    const [emailCounts, smsCounts, automationStats, allTenants, recentEmailLogs, recentSmsLogs] = await Promise.all([
        db.select({ tenantId: emailLogs.tenantId, count: count(emailLogs.id) })
            .from(emailLogs)
            .groupBy(emailLogs.tenantId)
            .all(),
        db.select({ tenantId: smsLogs.tenantId, count: count(smsLogs.id) })
            .from(smsLogs)
            .groupBy(smsLogs.tenantId)
            .all(),
        db.select({
            tenantId: marketingAutomations.tenantId,
            type: marketingAutomations.triggerEvent,
            active: marketingAutomations.isEnabled
        })
            .from(marketingAutomations)
            .all(),
        db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug }).from(tenants).where(eq(tenants.status, 'active')).all(),
        db.select({
            id: emailLogs.id,
            subject: emailLogs.subject,
            recipient: emailLogs.recipientEmail,
            sentAt: emailLogs.sentAt,
            tenantName: tenants.name
        })
            .from(emailLogs)
            .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
            .orderBy(desc(emailLogs.sentAt))
            .limit(50)
            .all(),
        db.select({
            id: smsLogs.id,
            body: smsLogs.body,
            recipient: smsLogs.recipientPhone,
            sentAt: smsLogs.sentAt,
            status: smsLogs.status,
            tenantName: tenants.name
        })
            .from(smsLogs)
            .leftJoin(tenants, eq(smsLogs.tenantId, tenants.id))
            .orderBy(desc(smsLogs.sentAt))
            .limit(50)
            .all()
    ]);

    const emailMap = new Map(emailCounts.map(e => [e.tenantId, e.count]));
    const smsMap = new Map(smsCounts.map(s => [s.tenantId, s.count]));

    const automationMap = new Map<string, any[]>();
    for (const auto of automationStats) {
        if (!auto.active) continue;
        const key = auto.tenantId || 'platform';
        const existing = automationMap.get(key) || [];
        existing.push({ type: auto.type, active: auto.active });
        automationMap.set(key, existing);
    }

    const tenantStats = allTenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        emailCount: emailMap.get(t.id) || 0,
        smsCount: smsMap.get(t.id) || 0,
        automations: automationMap.get(t.id) || []
    }));

    const totals = {
        email: tenantStats.reduce((acc, t) => acc + t.emailCount, 0),
        sms: tenantStats.reduce((acc, t) => acc + t.smsCount, 0)
    };

    return c.json({
        totals,
        tenants: tenantStats
            .sort((a, b) => (b.emailCount + b.smsCount) - (a.emailCount + a.smsCount)),
        recentEmailLogs,
        recentSmsLogs
    });
});

// GET /:id - Tenant-specific stats
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    if (!tenantId) return c.json({ error: 'Missing tenantId' }, 400);

    const [owners, instructors, students, emailCount, smsCount] = await Promise.all([
        db.select({ count: count() })
            .from(tenantMembers)
            .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
            .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantRoles.role, 'owner')))
            .get(),
        db.select({ count: count() })
            .from(tenantMembers)
            .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
            .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantRoles.role, 'instructor')))
            .get(),
        db.select({ count: count() })
            .from(tenantMembers)
            .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
            .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantRoles.role, 'student')))
            .get(),
        db.select({ count: count() })
            .from(emailLogs)
            .where(eq(emailLogs.tenantId, tenantId))
            .get(),
        db.select({ count: count() })
            .from(smsLogs)
            .where(eq(smsLogs.tenantId, tenantId))
            .get()
    ]);

    return c.json({
        owners: owners?.count || 0,
        instructors: instructors?.count || 0,
        subscribers: students?.count || 0,
        emailsSent: emailCount?.count || 0,
        smsSent: smsCount?.count || 0
    });
});

export default app;
