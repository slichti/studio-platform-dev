import { Hono } from 'hono';
import { createDb } from '../db';
import {
    payrollConfig,
    payouts,
    payrollItems,
    tenantMembers,
    classes,
    bookings,
    users,
    appointments,
    appointmentServices
} from 'db/src/schema';
import { and, eq, between, sql, desc, inArray } from 'drizzle-orm';

// Type definitions for context
import { tenants } from 'db/src/schema'; // We need this for the generic type logic if used, or just rely on runtime injection if typical
// Re-using the pattern from reports.ts for Bindings/Variables
type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /config - List all instructors and their payroll config
app.get('/config', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { isFeatureEnabled } = await import('../utils/features');
    if (!isFeatureEnabled(tenant, 'payroll')) return c.json({ error: 'Payroll feature not enabled' }, 403);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);


    // Get all instructors
    // We need to join with potential payrollConfig
    const instructors = await db.select({
        memberId: tenantMembers.id,
        firstName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`,
        lastName: sql<string>`json_extract(${tenantMembers.profile}, '$.lastName')`,
        role: sql<string>`'instructor'`, // Simplified for now, we should filter by role really
        config: {
            id: payrollConfig.id,
            payModel: payrollConfig.payModel,
            rate: payrollConfig.rate,
        }
    })
        .from(tenantMembers)
        .leftJoin(payrollConfig, eq(tenantMembers.id, payrollConfig.memberId))
        .where(and(
            eq(tenantMembers.tenantId, tenant.id),
            // Filter for instructors? simpler to just get all members who ARE instructors?
            // For now, let's just get all members and filtering in UI or query if we can join roles.
            // Joining roles is better.
        ))
        .all();

    // Filter for only 'instructor' role if possible, or leave to UI. 
    // Let's optimize by joining tenantRoles
    /*
    const rows = await db.select(...)
        .from(tenantMembers)
        .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
        .where(eq(tenantRoles.role, 'instructor'))
    */

    return c.json({ instructors });
});

// POST /config - Update instructor payroll config
app.post('/config', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);

    const body = await c.req.json();
    const { memberId, payModel, rate } = body; // rate in cents (flat/hourly) or basis points (%)

    if (!memberId || !payModel || rate === undefined) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    // Upsert
    // Check if exists
    const existing = await db.select().from(payrollConfig).where(eq(payrollConfig.memberId, memberId)).get();

    if (existing) {
        await db.update(payrollConfig)
            .set({ payModel, rate, updatedAt: new Date() })
            .where(eq(payrollConfig.id, existing.id))
            .run();
    } else {
        // Need userId for the schema link? Schema says userId is NOT NULL referencing users.id
        // We have memberId. We need to fetch the member to get the userId.
        const member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();
        if (!member) return c.json({ error: 'Member not found' }, 404);

        await db.insert(payrollConfig).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            memberId,
            userId: member.userId,
            payModel,
            rate
        }).run();
    }

    return c.json({ success: true });
});

// POST /generate - Calculate and Preview or Create
app.post('/generate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);

    const { startDate, endDate, commit } = await c.req.json();

    if (!startDate || !endDate) return c.json({ error: "Date range required" }, 400);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Get all instructors with config
    const configs = await db.select().from(payrollConfig).where(eq(payrollConfig.tenantId, tenant.id)).all();

    const results = [];

    for (const config of configs) {
        let totalDue = 0;
        const items: any[] = [];

        // 2. Find Classes
        const instructorClasses = await db.select()
            .from(classes)
            .where(and(
                eq(classes.instructorId, config.memberId!),
                between(classes.startTime, start, end),
                eq(classes.status, 'active') // Only active classes
            )).all();

        for (const cls of instructorClasses) {
            let amount = 0;
            let details = "";

            if (config.payModel === 'flat') {
                amount = config.rate;
                details = `Flat rate per class`;
            } else if (config.payModel === 'hourly') {
                const hours = cls.durationMinutes / 60;
                amount = Math.round(config.rate * hours);
                details = `${hours.toFixed(2)} hours @ $${(config.rate / 100).toFixed(2)}/hr`;
            } else if (config.payModel === 'percentage') {
                // Complex: Need bookings revenue
                // For MVP, if checks 'price' of class * attendees? Or purely bookings?
                // Let's assume % of Class Price * Count (Simplistic revenue)
                // Or % or bookings.
                // Let's do % of estimated revenue for now (Price * Confirmed Attendees)
                // Accurate way: Sum of bookings pos charges?
                // Fallback: (Class Price * Booked Count) * (Rate / 10000)

                // Fetch count
                const bookingCount = await db.select({ count: sql<number>`count(*)` })
                    .from(bookings)
                    .where(and(eq(bookings.classId, cls.id), eq(bookings.status, 'confirmed')))
                    .get();

                const revenue = (cls.price || 0) * (bookingCount?.count || 0);
                amount = Math.round(revenue * (config.rate / 10000)); // Rate is basis points (5000 = 50%)
                details = `${(config.rate / 100)}% of $${(revenue / 100).toFixed(2)} revenue`;
            }

            if (amount > 0) {
                totalDue += amount;
                items.push({
                    type: 'class',
                    referenceId: cls.id,
                    title: cls.title,
                    date: cls.startTime,
                    amount,
                    details
                });
            }
        }

        // 3. Find Appointments (Completed)
        const instructorAppointments = await db.select({
            id: appointments.id,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
            servicePrice: appointmentServices.price,
            serviceTitle: appointmentServices.title
        })
            .from(appointments)
            .innerJoin(appointmentServices, eq(appointments.serviceId, appointmentServices.id))
            .where(and(
                eq(appointments.instructorId, config.memberId!),
                between(appointments.startTime, start, end),
                eq(appointments.status, 'completed')
            )).all();

        for (const apt of instructorAppointments) {
            let amount = 0;
            let details = "";
            const durationMinutes = (apt.endTime.getTime() - apt.startTime.getTime()) / (1000 * 60);

            if (config.payModel === 'flat') {
                amount = config.rate;
                details = `Flat rate per appointment`;
            } else if (config.payModel === 'hourly') {
                const hours = durationMinutes / 60;
                amount = Math.round(config.rate * hours);
                details = `${hours.toFixed(2)} hours @ $${(config.rate / 100).toFixed(2)}/hr`;
            } else if (config.payModel === 'percentage') {
                const revenue = apt.servicePrice || 0;
                amount = Math.round(revenue * (config.rate / 10000));
                details = `${(config.rate / 100)}% of $${(revenue / 100).toFixed(2)} service price`;
            }

            if (amount > 0) {
                totalDue += amount;
                items.push({
                    type: 'appointment',
                    referenceId: apt.id,
                    title: apt.serviceTitle,
                    date: apt.startTime,
                    amount,
                    details
                });
            }
        }


        if (totalDue > 0) {
            results.push({
                instructorId: config.memberId,
                amount: totalDue,
                itemCount: items.length,
                items
            });
        }
    }

    if (commit) {
        // Save to DB
        const generatedIds = [];
        for (const res of results) {
            const payoutId = crypto.randomUUID();
            await db.insert(payouts).values({
                id: payoutId,
                tenantId: tenant.id,
                instructorId: res.instructorId!,
                amount: res.amount,
                periodStart: start,
                periodEnd: end,
                status: 'processing',
                createdAt: new Date()
            }).run();

            for (const item of res.items) {
                await db.insert(payrollItems).values({
                    id: crypto.randomUUID(),
                    payoutId,
                    type: item.type,
                    referenceId: item.referenceId,
                    amount: item.amount,
                    details: JSON.stringify({ note: item.details, title: item.title, date: item.date })
                }).run();
            }
            generatedIds.push(payoutId);
        }
        return c.json({ success: true, count: generatedIds.length });
    }

    return c.json({ preview: results });
});

// GET /history
app.get('/history', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const roles = c.get('roles') || [];
    const isMine = c.req.query('mine') === 'true';

    // If requesting own history, filter by memberId.
    // Otherwise, assume Admin view (Requires 'owner' role)

    let whereClause = eq(payouts.tenantId, tenant.id);
    if (isMine) {
        if (!member) return c.json({ error: 'Member context not found' }, 404);
        whereClause = and(whereClause, eq(payouts.instructorId, member.id))!;
    } else {
        // Strict check for Owner role to view all history
        if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);
    }

    const list = await db.select({
        id: payouts.id,
        amount: payouts.amount,
        status: payouts.status,
        periodStart: payouts.periodStart,
        periodEnd: payouts.periodEnd,
        paidAt: payouts.paidAt,
        instructorFirstName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`,
        instructorLastName: sql<string>`json_extract(${tenantMembers.profile}, '$.lastName')`,
    })
        .from(payouts)
        .innerJoin(tenantMembers, eq(payouts.instructorId, tenantMembers.id))
        .where(whereClause)
        .orderBy(desc(payouts.createdAt))
        .all();

    return c.json({ history: list });
});

// POST /:id/approve - Mark as Paid
app.post('/:id/approve', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);

    const id = c.req.param('id');

    await db.update(payouts)
        .set({ status: 'paid', paidAt: new Date(), notes: 'Manually marked as paid' })
        .where(and(eq(payouts.id, id), eq(payouts.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
