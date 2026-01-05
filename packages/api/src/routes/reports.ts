import { Hono } from 'hono';
import { createDb } from '../db';
import {
    bookings,
    classes,
    membershipPlans,
    posOrders,
    purchasedPacks,
    subscriptions,
    tenantMembers,
    users
} from 'db/src/schema'; // Static import
import { and, between, eq, sql, desc, count } from 'drizzle-orm';

import { tenants } from 'db/src/schema';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /revenue
// Query params: startDate, endDate (ISO strings)
app.get('/revenue', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    // 1. POS Orders (Retail)
    const retailRevenue = await db.select({
        total: sql<number>`sum(${posOrders.totalAmount})`
    })
        .from(posOrders)
        .where(and(
            eq(posOrders.tenantId, tenant.id),
            between(posOrders.createdAt, start, end),
            eq(posOrders.status, 'completed')
        ))
        .get();

    // 2. Class Packs
    const packsRevenue = await db.select({
        total: sql<number>`sum(${purchasedPacks.price})`
    })
        .from(purchasedPacks)
        .where(and(
            eq(purchasedPacks.tenantId, tenant.id),
            between(purchasedPacks.createdAt, start, end)
        ))
        .get();

    // 3. Subscriptions (MRR - Snapshot of current active)
    // Note: This is "Current MRR", not "Revenue collected in period" from renewals.
    // For "Revenue", we'd need an invoices table. We'll return MRR separately.
    const activeSubs = await db.select({
        price: membershipPlans.price
    })
        .from(subscriptions)
        .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
        .where(and(
            eq(subscriptions.tenantId, tenant.id),
            eq(subscriptions.status, 'active')
        ))
        .all();

    const mrr = activeSubs.reduce((sum, sub) => sum + (sub.price || 0), 0);
    const retailTotal = retailRevenue?.total || 0;
    const packsTotal = packsRevenue?.total || 0;
    const grossVolume = retailTotal + packsTotal; // + Subscription Renewals (Missing)

    // Breakdown
    const breakdown = {
        retail: retailTotal,
        packs: packsTotal,
        mrr: mrr
    };

    // Chart Data (Time Series)
    // Fetch raw data for time-series aggregation
    const [retailItems, packItems] = await Promise.all([
        db.select({ date: posOrders.createdAt, amount: posOrders.totalAmount })
            .from(posOrders)
            .where(and(
                eq(posOrders.tenantId, tenant.id),
                between(posOrders.createdAt, start, end),
                eq(posOrders.status, 'completed')
            )).all(),

        db.select({ date: purchasedPacks.createdAt, amount: purchasedPacks.price })
            .from(purchasedPacks)
            .where(and(
                eq(purchasedPacks.tenantId, tenant.id),
                between(purchasedPacks.createdAt, start, end)
            )).all()
    ]);

    // Aggregate by day
    const dayMap = new Map<string, number>();

    // Initialize all days in range with 0
    const cursor = new Date(start);
    while (cursor <= end) {
        dayMap.set(cursor.toISOString().split('T')[0], 0);
        cursor.setDate(cursor.getDate() + 1);
    }

    [...retailItems, ...packItems].forEach(item => {
        const d = new Date(item.date || new Date().toISOString());
        const key = d.toISOString().split('T')[0];
        if (dayMap.has(key)) {
            dayMap.set(key, (dayMap.get(key) || 0) + (item.amount || 0));
        }
    });

    const chartData = Array.from(dayMap.entries())
        .map(([name, value]) => ({ name, value: value / 100 })) // Value in dollars
        .sort((a, b) => a.name.localeCompare(b.name));

    return c.json({
        grossVolume,
        mrr,
        breakdown,
        chartData,
        period: { start, end }
    });
});

// GET /attendance
app.get('/attendance', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    // 1. Total Bookings vs Check-ins logic...
    // Re-using previous aggregations for Totals
    const totalBookings = await db.select({ count: count() })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end),
            eq(bookings.status, 'confirmed')
        )).get();

    const totalCheckins = await db.select({ count: count() })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end),
            eq(bookings.status, 'confirmed'),
            sql`${bookings.checkedInAt} IS NOT NULL`
        )).get();

    // Top Classes
    const topClasses = await db.select({
        title: classes.title,
        attendees: count(bookings.id)
    })
        .from(classes)
        .leftJoin(bookings, eq(classes.id, bookings.classId))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end),
            eq(bookings.status, 'confirmed')
        ))
        .groupBy(classes.title)
        .orderBy(desc(count(bookings.id)))
        .limit(5)
        .all();

    // Chart Data (Daily Attendance)
    const dailyData = await db.select({
        date: classes.startTime,
        count: count(bookings.id)
    })
        .from(classes)
        .leftJoin(bookings, eq(classes.id, bookings.classId))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end),
            eq(bookings.status, 'confirmed')
        ))
        .groupBy(classes.startTime) // Group by Class Time first
        .all();

    // Now aggregate class-times to days in JS
    const dayMap = new Map<string, number>();
    const cursor = new Date(start);
    while (cursor <= end) {
        dayMap.set(cursor.toISOString().split('T')[0], 0);
        cursor.setDate(cursor.getDate() + 1);
    }

    dailyData.forEach(item => {
        const d = new Date(item.date);
        const key = d.toISOString().split('T')[0];
        if (dayMap.has(key)) {
            dayMap.set(key, (dayMap.get(key) || 0) + item.count);
        }
    });

    const chartData = Array.from(dayMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return c.json({
        totalBookings: totalBookings?.count || 0,
        totalCheckins: totalCheckins?.count || 0,
        topClasses,
        chartData
    });
});

// POST /projection - Project Profit & Tier Recommendation (Tenant Side)
app.post('/projection', async (c) => {
    const { studentCount, monthlyFee, costs } = await c.req.json();

    if (studentCount === undefined || monthlyFee === undefined) {
        return c.json({ error: "Student Count and Monthly Fee required" }, 400);
    }

    const revenue = studentCount * monthlyFee; // Monthly

    // TIERS logic (Standardized)
    const tiers = [
        { id: 'basic', name: 'Launch', price: 0, fee: 0.05 },
        { id: 'growth', name: 'Growth', price: 49, fee: 0.015 },
        { id: 'scale', name: 'Scale', price: 129, fee: 0.0 }
    ];

    const projections = tiers.map(t => {
        const platformCost = t.price + (revenue * t.fee);
        const profit = revenue - platformCost - (costs || 0);
        return {
            tier: t.id,
            name: t.name,
            revenue,
            platformCost,
            estimatedProfit: profit,
            details: `Platform: $${platformCost.toFixed(2)} ($${t.price} fixed + ${(t.fee * 100)}% fees)`
        };
    });

    // Sort by Profit Descending
    const recommended = [...projections].sort((a, b) => b.estimatedProfit - a.estimatedProfit)[0];

    return c.json({
        inputs: { studentCount, monthlyFee, costs },
        projections,
        recommendation: recommended.tier
    });
});

export default app;
