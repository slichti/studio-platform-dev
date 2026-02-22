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
            metadata: payrollConfig.metadata,
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
    const { memberId, payModel, rate, payoutBasis, fixedDeduction } = body;

    if (!memberId || !payModel || rate === undefined) return c.json({ error: 'Missing required fields' }, 400);

    const existing = await db.select().from(payrollConfig).where(eq(payrollConfig.memberId, memberId)).get();

    // fixedDeduction (cents) is stored in metadata JSON for percentage pay model
    const metadata: Record<string, any> = {};
    if (fixedDeduction !== undefined && fixedDeduction > 0) {
        metadata.fixedDeduction = Number(fixedDeduction);
    }

    if (existing) {
        await db.update(payrollConfig)
            .set({ payModel, rate, payoutBasis, metadata: Object.keys(metadata).length ? metadata : null, updatedAt: new Date() })
            .where(eq(payrollConfig.id, existing.id)).run();
    } else {
        const member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();
        if (!member) return c.json({ error: 'Member not found' }, 404);

        await db.insert(payrollConfig).values({
            id: crypto.randomUUID(), tenantId: tenant.id, memberId, userId: member.userId,
            payModel, rate, payoutBasis: payoutBasis || 'net',
            metadata: Object.keys(metadata).length ? metadata : null,
        }).run();
    }
    return c.json({ success: true });
});

// GET /profitability - Instructor ROI Report
app.get('/profitability', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const { PayrollService } = await import('../services/payroll');
    const service = new PayrollService(db, tenant.id);
    const stats = await service.getInstructorProfitability(start, end);

    return c.json({ stats });
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

    const { PayrollService } = await import('../services/payroll');
    const service = new PayrollService(db, tenant.id);
    const results = await service.generatePayoutData(start, end);

    if (commit) {
        await service.commitPayouts(results, start, end);
        return c.json({ success: true, count: results.length });
    }
    return c.json({ preview: results });
});

// POST /payouts/bulk-approve
app.post('/payouts/bulk-approve', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids)) return c.json({ error: "IDs array required" }, 400);

    const { PayrollService } = await import('../services/payroll');
    const service = new PayrollService(db, tenant.id);
    await service.bulkApprove(ids);

    return c.json({ success: true });
});

// GET /history/export - CSV
app.get('/history/export', async (c) => {
    if (!c.get('can')('manage_payroll')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 90));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const { PayrollService } = await import('../services/payroll');
    const service = new PayrollService(db, tenant.id);
    const csv = await service.generateExportCsv(start, end);

    return c.body(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=payroll_history_${new Date().toISOString().split('T')[0]}.csv`
    });
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
