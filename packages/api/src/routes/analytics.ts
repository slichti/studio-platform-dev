import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, tenantMembers, classes, purchasedPacks, posOrders } from '@studio/db/src/schema';
import { eq, and, sql, desc, gte, lt } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

app.use('*', authMiddleware);

/**
 * GET /utilization - Heatmap Data
 * Logic: Occupancy by Day of Week (0-6) and Hour of Day (0-23)
 * Source: Classes (start_time) -> Bookings (count)
 */
app.get('/utilization', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    // Group bookings by the CLASS start time, not booking time.
    // We want to know "When are classes busy?"
    const usage = await db.select({
        day: sql<number>`cast(strftime('%w', ${classes.startTime}) as integer)`, // 0 (Sun) - 6 (Sat)
        hour: sql<number>`cast(strftime('%H', ${classes.startTime}) as integer)`, // 00-23
        bookingCount: sql<number>`count(${bookings.id})`,
        capacitySum: sql<number>`sum(${classes.capacity})`
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.tenantId, tenant.id),
            eq(bookings.status, 'confirmed'),
            gte(classes.startTime, sql`datetime('now', '-30 days')`) // Last 30 days window for relevance
        ))
        .groupBy(sql`strftime('%w', ${classes.startTime})`, sql`strftime('%H', ${classes.startTime})`)
        .all();

    return c.json(usage);
});

// GET /retention - Cohort Analysis
// Group users by "Join Month" and see how many are still "Active" (booked in last 30 days)
app.get('/retention', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const cohorts = await db.select({
        cohortMonth: sql<string>`strftime('%Y-%m', ${tenantMembers.joinedAt})`,
        totalMembers: sql<number>`count(*)`,
        activeMembers: sql<number>`sum(case when ${tenantMembers.status} = 'active' then 1 else 0 end)`
    })
        .from(tenantMembers)
        .where(eq(tenantMembers.tenantId, tenant.id))
        .groupBy(sql`strftime('%Y-%m', ${tenantMembers.joinedAt})`)
        .orderBy(desc(sql`strftime('%Y-%m', ${tenantMembers.joinedAt})`))
        .limit(12) // Last 12 cohorts
        .all();

    // Map to nice format
    const result = cohorts.map(c => ({
        month: c.cohortMonth,
        total: c.totalMembers,
        retained: c.activeMembers,
        retainedPct: c.totalMembers > 0 ? Math.round((c.activeMembers / c.totalMembers) * 100) : 0
    }));

    return c.json(result);
});

/**
 * GET /ltv - Lifetime Value
 * Logic: Total Revenue / Total Members
 * Revenue Sources: Purchased Packs + POS Orders
 */
app.get('/ltv', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    // 1. Total Members
    const memberStats = await db.select({
        count: sql<number>`count(*)`
    })
        .from(tenantMembers)
        .where(eq(tenantMembers.tenantId, tenant.id))
        .get();

    const totalMembers = memberStats?.count || 1; // Avoid div by zero

    // 2. Revenue from Class Packs
    const packsRevenue = await db.select({
        total: sql<number>`sum(${purchasedPacks.price})`
    })
        .from(purchasedPacks)
        .where(eq(purchasedPacks.tenantId, tenant.id))
        .get();

    // 3. Revenue from POS
    const posRevenue = await db.select({
        total: sql<number>`sum(${posOrders.totalAmount})`
    })
        .from(posOrders)
        .where(eq(posOrders.tenantId, tenant.id))
        .get();

    const revenueCents = (packsRevenue?.total || 0) + (posRevenue?.total || 0);
    const revenueDollars = revenueCents / 100;

    const avgLtv = revenueDollars / totalMembers;

    return c.json({
        totalRevenue: revenueDollars,
        totalMembers,
        averageLtv: Number(avgLtv.toFixed(2)),
        sources: {
            packs: (packsRevenue?.total || 0) / 100,
            pos: (posRevenue?.total || 0) / 100
        }
    });
});

// GET /seo - SEO & Search Dominance Stats
app.get('/seo', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const { locations } = await import('@studio/db/src/schema');

    // 1. Indexing Status
    const seoConfig = (tenant.seoConfig || {}) as any;
    const indexingEnabled = !!seoConfig.indexingEnabled;

    // 2. GBP Connectivity
    const gbpConnected = !!tenant.gbpToken;

    // 3. Location Slugs & SEO Health
    const allLocations = await db.select().from(locations).where(eq(locations.tenantId, tenant.id));
    const locationStats = allLocations.map(loc => ({
        id: loc.id,
        name: loc.name,
        slug: (loc as any).slug,
        hasSeoConfig: !!(loc as any).seoConfig && Object.keys((loc as any).seoConfig as object).length > 0,
        isActive: !!loc.isActive
    }));

    // 4. Sitemap Health
    const sitemapEligible = !!tenant.isPublic && indexingEnabled;

    return c.json({
        stats: {
            indexingEnabled,
            gbpConnected,
            sitemapEligible,
            totalLocations: allLocations.length,
            seoOptimizedLocations: locationStats.filter(l => l.hasSeoConfig).length
        },
        locations: locationStats
    });
});

// GET /churn-overview - Member Distribution by Churn Status
app.get('/churn-overview', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const results = await db.select({
        status: tenantMembers.churnStatus,
        count: sql<number>`count(*)`
    })
        .from(tenantMembers)
        .where(eq(tenantMembers.tenantId, tenant.id))
        .groupBy(tenantMembers.churnStatus)
        .all();

    const overview = { safe: 0, at_risk: 0, churned: 0, total: 0 };
    results.forEach(r => {
        const s = r.status || 'safe';
        overview[s as keyof typeof overview] = r.count;
        overview.total += r.count;
    });

    return c.json(overview);
});

// GET /revenue-breakdown - Monthly Revenue by Source
app.get('/revenue-breakdown', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const { subscriptions } = await import('@studio/db/src/schema');

    // Packs revenue by month
    const packsByMonth = await db.select({
        month: sql<string>`strftime('%Y-%m', ${purchasedPacks.createdAt})`,
        total: sql<number>`sum(${purchasedPacks.price})`
    })
        .from(purchasedPacks)
        .where(and(eq(purchasedPacks.tenantId, tenant.id), gte(purchasedPacks.createdAt, sql`datetime('now', '-12 months')`)))
        .groupBy(sql`strftime('%Y-%m', ${purchasedPacks.createdAt})`)
        .all();

    // POS revenue by month
    const posByMonth = await db.select({
        month: sql<string>`strftime('%Y-%m', ${posOrders.createdAt})`,
        total: sql<number>`sum(${posOrders.totalAmount})`
    })
        .from(posOrders)
        .where(and(eq(posOrders.tenantId, tenant.id), gte(posOrders.createdAt, sql`datetime('now', '-12 months')`)))
        .groupBy(sql`strftime('%Y-%m', ${posOrders.createdAt})`)
        .all();

    // Membership revenue by month (active subscriptions)
    const membershipByMonth = await db.select({
        month: sql<string>`strftime('%Y-%m', ${subscriptions.createdAt})`,
        count: sql<number>`count(*)`
    })
        .from(subscriptions)
        .where(and(eq(subscriptions.tenantId, tenant.id), gte(subscriptions.createdAt, sql`datetime('now', '-12 months')`)))
        .groupBy(sql`strftime('%Y-%m', ${subscriptions.createdAt})`)
        .all();

    // Build unified monthly data
    const months = new Set<string>();
    packsByMonth.forEach(r => months.add(r.month));
    posByMonth.forEach(r => months.add(r.month));
    membershipByMonth.forEach(r => months.add(r.month));

    const packsMap = Object.fromEntries(packsByMonth.map(r => [r.month, (r.total || 0) / 100]));
    const posMap = Object.fromEntries(posByMonth.map(r => [r.month, (r.total || 0) / 100]));
    const membershipMap = Object.fromEntries(membershipByMonth.map(r => [r.month, r.count]));

    const breakdown = Array.from(months).sort().map(month => ({
        month,
        packs: packsMap[month] || 0,
        pos: posMap[month] || 0,
        memberships: membershipMap[month] || 0
    }));

    return c.json(breakdown);
});

// GET /automation-stats - Automation Effectiveness
app.get('/automation-stats', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const { automationLogs, marketingAutomations } = await import('@studio/db/src/schema');

    const stats = await db.select({
        automationId: automationLogs.automationId,
        channel: automationLogs.channel,
        totalSent: sql<number>`count(*)`,
        totalOpened: sql<number>`sum(case when ${automationLogs.openedAt} is not null then 1 else 0 end)`,
        totalClicked: sql<number>`sum(case when ${automationLogs.clickedAt} is not null then 1 else 0 end)`,
    })
        .from(automationLogs)
        .where(eq(automationLogs.tenantId, tenant.id))
        .groupBy(automationLogs.automationId, automationLogs.channel)
        .all();

    // Get automation names
    const automationIds = [...new Set(stats.map(s => s.automationId))];
    const automations = automationIds.length > 0
        ? await db.select({ id: marketingAutomations.id, triggerEvent: marketingAutomations.triggerEvent, metadata: marketingAutomations.metadata })
            .from(marketingAutomations)
            .where(sql`${marketingAutomations.id} IN (${sql.join(automationIds.map(id => sql`${id}`), sql`, `)})`)
            .all()
        : [];

    const nameMap = Object.fromEntries(automations.map(a => [a.id, (a.metadata as any)?.name || a.triggerEvent || 'Unnamed']));

    return c.json(stats.map(s => ({
        ...s,
        name: nameMap[s.automationId] || 'Unknown',
        openRate: s.totalSent > 0 ? Math.round((s.totalOpened / s.totalSent) * 100) : 0,
        clickRate: s.totalSent > 0 ? Math.round((s.totalClicked / s.totalSent) * 100) : 0,
    })));
});

export default app;
