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

    return c.json({
        grossVolume,
        mrr,
        breakdown,
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

    // 1. Total Bookings vs Check-ins
    const attendanceStats = await db.select({
        count: count(bookings.id),
        status: bookings.status,
        checkedIn: bookings.checkedInAt
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end)
        ))
        .groupBy(bookings.status, bookings.checkedInAt) // This grouping might be too granular for simple counts, let's just fetch all and agg in code or use multiple queries
        .all();

    // Simplify:
    // Total Confirmed
    const totalBookings = await db.select({ count: count() })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end),
            eq(bookings.status, 'confirmed')
        )).get();

    // Total Checked In
    const totalCheckins = await db.select({ count: count() })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.tenantId, tenant.id),
            between(classes.startTime, start, end),
            eq(bookings.status, 'confirmed'),
            sql`${bookings.checkedInAt} IS NOT NULL`
        )).get();

    // Top Classes (by attendance)
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

    return c.json({
        totalBookings: totalBookings?.count || 0,
        totalCheckins: totalCheckins?.count || 0,
        topClasses
    });
});

export default app;
