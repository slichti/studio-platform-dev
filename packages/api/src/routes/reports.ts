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
} from 'db'; // Static import
import { and, between, eq, sql, desc, count } from 'drizzle-orm';

import { tenants } from 'db';

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

    // 4. Subscription Renewals (Estimated based on active subs intersecting with period)
    // In a real system, you'd query an Invoices table. Here we estimate.
    const renewalsEstimate = activeSubs.reduce((sum, sub) => sum + (sub.price || 0), 0); // Simplified: Assume 1 renewal per month per active sub

    const retailTotal = retailRevenue?.total || 0;
    const packsTotal = packsRevenue?.total || 0;
    const grossVolume = retailTotal + packsTotal + renewalsEstimate;

    // Breakdown
    const breakdown = {
        retail: retailTotal,
        packs: packsTotal,
        mrr: mrr,
        renewals: renewalsEstimate
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

    // Add amortized MRR to daily chart for smoothness
    const dailyMrr = mrr / 30; // Rough approximation
    for (const [key, val] of dayMap.entries()) {
        dayMap.set(key, val + dailyMrr);
    }

    const chartData = Array.from(dayMap.entries())
        .map(([name, value]) => ({ name, value: value / 100 })) // Value in dollars
        .sort((a, b) => a.name.localeCompare(b.name));

    return c.json({
        grossVolume,
        mrr,
        breakdown,
        chartData,
        period: { start: start.toISOString(), end: end.toISOString() }
    } as unknown as import('../types').ReportsRevenueResponse);
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
    } as unknown as import('../types').ReportsAttendanceResponse);
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


// --- Accounting Exports ---
// GET /accounting/journal (Daily Sales Journal)
app.get('/accounting/journal', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { startDate, endDate, format } = c.req.query();

    // Default to current month
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;

    const { posOrders, purchasedPacks, classPackDefinitions } = await import('db/src/schema');
    const { and, eq, gte, lte } = await import('drizzle-orm');

    // 1. Fetch POS Orders (Goods/Services)
    const orders = await db.select({
        id: posOrders.id,
        date: posOrders.createdAt,
        total: posOrders.totalAmount,
        tax: posOrders.taxAmount,
    }).from(posOrders)
        .where(and(
            eq(posOrders.tenantId, tenant.id),
            gte(posOrders.createdAt, start),
            lte(posOrders.createdAt, end),
            eq(posOrders.status, 'completed')
        )).all();

    // 2. Fetch Pack Purchases (Credits)
    const packs = await db.select({
        id: purchasedPacks.id,
        date: purchasedPacks.createdAt,
        name: classPackDefinitions.name,
        total: purchasedPacks.price
    }).from(purchasedPacks)
        .innerJoin(classPackDefinitions, eq(purchasedPacks.packDefinitionId, classPackDefinitions.id))
        .where(and(
            eq(purchasedPacks.tenantId, tenant.id),
            gte(purchasedPacks.createdAt, start),
            lte(purchasedPacks.createdAt, end)
        )).all();

    // 3. Transform to Journal Entries
    const journal: any[] = [];

    // POS Revenue
    for (const o of orders) {
        // Credit Sales (Revenue)
        journal.push({
            date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
            description: `POS Order #${o.id.slice(0, 8)}`,
            account: 'Revenue: Sales',
            debit: 0,
            credit: (o.total - (o.tax || 0)) / 100, // Net Sales
            currency: tenant.currency
        });

        // Credit Tax (Liability)
        if (o.tax && o.tax > 0) {
            journal.push({
                date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
                description: `Tax on Order #${o.id.slice(0, 8)}`,
                account: 'Liability: Sales Tax',
                debit: 0,
                credit: o.tax / 100,
                currency: tenant.currency
            });
        }

        // Debit Cash/Bank (Asset)
        journal.push({
            date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
            description: `Payment for Order #${o.id.slice(0, 8)}`,
            account: 'Assets: Stripe Clearing', // Assuming generic
            debit: o.total / 100,
            credit: 0,
            currency: tenant.currency
        });
    }

    // Pack Revenue
    for (const p of packs) {
        journal.push({
            date: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
            description: `Class Pack: ${p.name}`,
            account: 'Revenue: Class Packs',
            debit: 0,
            credit: (p.total || 0) / 100,
            currency: tenant.currency
        });

        journal.push({
            date: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
            description: `Payment for Pack ${p.name}`,
            account: 'Assets: Stripe Clearing',
            debit: (p.total || 0) / 100,
            credit: 0,
            currency: tenant.currency
        });
    }

    if (format === 'csv') {
        const headers = "Date,Description,Account,Debit,Credit,Currency\n";
        const rows = journal.map(j =>
            `${j.date},"${j.description}","${j.account}",${j.debit},${j.credit},${j.currency}`
        ).join("\n");
        return c.text(headers + rows);
    }

    return c.json({
        period: { start, end },
        journal
    });
});

export default app;
