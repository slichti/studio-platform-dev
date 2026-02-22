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

export default app;
