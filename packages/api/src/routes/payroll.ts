import { Hono } from 'hono';
import { createDb } from '../db';
import { payrollConfig, payouts, payrollItems, tenantMembers, classes, bookings, users, appointments, appointmentServices } from '@studio/db/src/schema';
import { and, eq, between, sql, desc } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /config - List all instructors and their payroll config
app.get('/config', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { isFeatureEnabled } = await import('../utils/features');
    if (!isFeatureEnabled(tenant, 'payroll')) return c.json({ error: 'Payroll feature not enabled' }, 403);

    const instructors = await db.select({
        memberId: tenantMembers.id,
        firstName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`,
        lastName: sql<string>`json_extract(${tenantMembers.profile}, '$.lastName')`,
        role: sql<string>`'instructor'`,
        config: {
            id: payrollConfig.id,
            payModel: payrollConfig.payModel,
            rate: payrollConfig.rate,
            payoutBasis: payrollConfig.payoutBasis,
        },
        stripeAccountId: users.stripeAccountId
    })
        .from(tenantMembers)
        .leftJoin(users, eq(tenantMembers.userId, users.id))
        .leftJoin(payrollConfig, eq(tenantMembers.id, payrollConfig.memberId))
        .where(eq(tenantMembers.tenantId, tenant.id))
        .all();

    return c.json({ instructors });
});

// POST /config - Update instructor payroll config
app.post('/config', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const body = await c.req.json();
    const { memberId, payModel, rate, payoutBasis } = body;

    if (!memberId || !payModel || rate === undefined) return c.json({ error: 'Missing required fields' }, 400);

    const existing = await db.select().from(payrollConfig).where(eq(payrollConfig.memberId, memberId)).get();

    if (existing) {
        await db.update(payrollConfig)
            .set({ payModel, rate, payoutBasis, updatedAt: new Date() })
            .where(eq(payrollConfig.id, existing.id)).run();
    } else {
        const member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();
        if (!member) return c.json({ error: 'Member not found' }, 404);

        await db.insert(payrollConfig).values({
            id: crypto.randomUUID(), tenantId: tenant.id, memberId, userId: member.userId,
            payModel, rate, payoutBasis: payoutBasis || 'net'
        }).run();
    }
    return c.json({ success: true });
});

// POST /generate
app.post('/generate', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { startDate, endDate, commit } = await c.req.json();
    if (!startDate || !endDate) return c.json({ error: "Date range required" }, 400);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const configs = await db.select().from(payrollConfig).where(eq(payrollConfig.tenantId, tenant.id)).all();
    const results = [];

    for (const config of configs) {
        let totalDue = 0;
        const items: any[] = [];

        const instructorClasses = await db.select()
            .from(classes)
            .where(and(eq(classes.instructorId, config.memberId!), between(classes.startTime, start, end), eq(classes.status, 'active'))).all();

        for (const cls of instructorClasses) {
            let amount = 0, details = "";
            if (config.payModel === 'flat') {
                amount = config.rate;
                details = `Flat rate per class`;
            } else if (config.payModel === 'hourly') {
                amount = Math.round((config.rate * cls.durationMinutes) / 60);
                details = `${cls.durationMinutes} mins @ $${(config.rate / 100).toFixed(2)}/hr`;
            } else if (config.payModel === 'percentage') {
                const classBookings = await db.query.bookings.findMany({
                    where: and(eq(bookings.classId, cls.id), eq(bookings.status, 'confirmed')),
                    with: { usedPack: true }
                });
                let totalRevenueCents = 0;
                for (const b of classBookings) {
                    if (b.paymentMethod === 'drop_in') totalRevenueCents += (cls.price || 0);
                    else if (b.paymentMethod === 'credit' && b.usedPack) {
                        totalRevenueCents += (b.usedPack.price || 0) / (b.usedPack.initialCredits || 1);
                    }
                }
                const revenue = Math.round(totalRevenueCents);
                let basisAmount = revenue, basisLabel = "Gross Revenue";
                if (config.payoutBasis === 'net') {
                    // Floor fees to be conservative for the platform
                    const estimatedFees = Math.floor(revenue * 0.029) + (classBookings.filter(b => b.paymentMethod === 'drop_in').length * 30);
                    basisAmount = Math.max(0, revenue - estimatedFees);
                    basisLabel = "Net Revenue (Est.)";
                }
                amount = Math.round(basisAmount * (config.rate / 10000));
                details = `${(config.rate / 100)}% of $${(basisAmount / 100).toFixed(2)} (${basisLabel})`;
            }
            if (amount > 0) {
                totalDue += amount;
                items.push({ type: 'class', referenceId: cls.id, title: cls.title, date: cls.startTime, amount, details });
            }
        }

        const instructorAppointments = await db.select({
            id: appointments.id, startTime: appointments.startTime, endTime: appointments.endTime,
            servicePrice: appointmentServices.price, serviceTitle: appointmentServices.title
        })
            .from(appointments)
            .innerJoin(appointmentServices, eq(appointments.serviceId, appointmentServices.id))
            .where(and(eq(appointments.instructorId, config.memberId!), between(appointments.startTime, start, end), eq(appointments.status, 'completed'))).all();

        for (const apt of instructorAppointments) {
            let amount = 0, details = "";
            const durationMinutes = (apt.endTime.getTime() - apt.startTime.getTime()) / (1000 * 60);
            if (config.payModel === 'flat') {
                amount = config.rate;
                details = `Flat rate per appointment`;
            } else if (config.payModel === 'hourly') {
                amount = Math.round((config.rate * durationMinutes) / 60);
                details = `${durationMinutes} mins @ $${(config.rate / 100).toFixed(2)}/hr`;
            } else if (config.payModel === 'percentage') {
                const revenue = apt.servicePrice || 0;
                amount = Math.round(revenue * (config.rate / 10000));
                details = `${(config.rate / 100)}% of $${(revenue / 100).toFixed(2)} service price`;
            }
            if (amount > 0) {
                totalDue += amount;
                items.push({ type: 'appointment', referenceId: apt.id, title: apt.serviceTitle, date: apt.startTime, amount, details });
            }
        }

        if (totalDue > 0) results.push({ instructorId: config.memberId, amount: totalDue, itemCount: items.length, items });
    }

    if (commit) {
        for (const res of results) {
            const payoutId = crypto.randomUUID();
            await db.insert(payouts).values({
                id: payoutId, tenantId: tenant.id, instructorId: res.instructorId!, amount: res.amount,
                periodStart: start, periodEnd: end, status: 'processing', createdAt: new Date()
            }).run();
            for (const item of res.items) {
                await db.insert(payrollItems).values({
                    id: crypto.randomUUID(), payoutId, type: item.type, referenceId: item.referenceId,
                    amount: item.amount, details: JSON.stringify({ note: item.details, title: item.title, date: item.date })
                }).run();
            }
        }
        return c.json({ success: true, count: results.length });
    }
    return c.json({ preview: results });
});

// GET /history
app.get('/history', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const isMine = c.req.query('mine') === 'true';

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    let whereClause = eq(payouts.tenantId, tenant.id);
    if (isMine) {
        if (!member) return c.json({ error: 'Member context not found' }, 404);
        whereClause = and(whereClause, eq(payouts.instructorId, member.id))!;
    } else {
        if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    }

    const list = await db.select({
        id: payouts.id, amount: payouts.amount, status: payouts.status, periodStart: payouts.periodStart,
        periodEnd: payouts.periodEnd, paidAt: payouts.paidAt,
        instructorFirstName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`,
        instructorLastName: sql<string>`json_extract(${tenantMembers.profile}, '$.lastName')`,
        stripeAccountId: users.stripeAccountId
    })
        .from(payouts)
        .innerJoin(tenantMembers, eq(payouts.instructorId, tenantMembers.id))
        .leftJoin(users, eq(tenantMembers.userId, users.id))
        .where(whereClause)
        .orderBy(desc(payouts.createdAt))
        .all();

    return c.json({ history: list });
});

// POST /:id/approve
app.post('/:id/approve', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const id = c.req.param('id');

    await db.update(payouts).set({ status: 'paid', paidAt: new Date(), notes: 'Manually marked as paid' })
        .where(and(eq(payouts.id, id), eq(payouts.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

// POST /:id/pay
app.post('/:id/pay', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const id = c.req.param('id');
    const payout = await db.select().from(payouts).where(and(eq(payouts.id, id), eq(payouts.tenantId, tenant.id))).get();

    if (!payout || payout.status === 'paid') return c.json({ error: "Invalid payout" }, 400);

    const instructor = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.id, payout.instructorId), with: { user: true }
    });

    if (!instructor?.user.stripeAccountId) return c.json({ error: "Missing instructor Stripe account" }, 400);

    try {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        const transfer = await stripe.createTransfer({
            amount: payout.amount, currency: payout.currency || 'usd',
            destination: instructor.user.stripeAccountId,
            sourceAccountId: tenant.stripeAccountId || undefined,
            description: `Payout ${payout.id}`
        });

        await db.update(payouts).set({ status: 'paid', paidAt: new Date(), stripeTransferId: transfer.id, notes: 'Paid via Stripe' })
            .where(eq(payouts.id, id)).run();
        return c.json({ success: true, transferId: transfer.id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /transfer
app.post('/transfer', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { instructorId, amount, currency, notes } = await c.req.json();
    if (!instructorId || !amount) return c.json({ error: "Missing fields" }, 400);

    const instructor = await db.query.tenantMembers.findFirst({ where: eq(tenantMembers.id, instructorId), with: { user: true } });
    if (!instructor?.user.stripeAccountId) return c.json({ error: "Missing instructor Stripe account" }, 400);

    try {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        const transfer = await stripe.createTransfer({
            amount, currency: currency || 'usd', destination: instructor.user.stripeAccountId,
            sourceAccountId: tenant.stripeAccountId || undefined, description: `Manual Payout`
        });

        await db.insert(payouts).values({
            id: crypto.randomUUID(), tenantId: tenant.id, instructorId, amount,
            currency: currency || 'usd', periodStart: new Date(), periodEnd: new Date(),
            status: 'paid', paidAt: new Date(), stripeTransferId: transfer.id, notes: notes || 'Manual', createdAt: new Date()
        }).run();
        return c.json({ success: true, transferId: transfer.id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
