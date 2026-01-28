import { Hono } from 'hono';
import { createDb } from '../db';
import { ReportService } from '../services/reports';
import { tenants, scheduledReports } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /revenue
app.get('/revenue', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getRevenue(start, end);

    return c.json(result as unknown as import('../types').ReportsRevenueResponse);
});

// GET /attendance
app.get('/attendance', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getAttendance(start, end);

    return c.json(result as unknown as import('../types').ReportsAttendanceResponse);
});

// GET /retention
app.get('/retention', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getRetention(start, end);

    return c.json(result);
});

// POST /projection
app.post('/projection', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const { studentCount, monthlyFee, costs } = await c.req.json();

    if (studentCount === undefined || monthlyFee === undefined) {
        return c.json({ error: "Student Count and Monthly Fee required" }, 400);
    }

    const service = new ReportService(db, tenant.id);
    const result = service.getProjection(studentCount, monthlyFee, costs);

    return c.json(result);
});

// GET /accounting/journal
app.get('/accounting/journal', async (c) => {
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const { startDate, endDate, format } = c.req.query();

    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;

    const service = new ReportService(db, tenant.id);
    const journalData = await service.getJournal(start, end, format as string, tenant.currency || 'USD');

    if (format === 'csv') {
        const headers = "Date,Description,Account,Debit,Credit,Currency\n";
        // The service returns the CSV string directly if format is csv, 
        // OR it returns the array and we handle it? 
        // Based on my service impl, it returns string if format is csv.
        if (typeof journalData === 'string') {
            // Wait, the service returns rows string (without header? No, I put header in service).
            // Let's re-verify service impl. 
            // Service impl returns: c.text(headers + rows) logic was moved? 
            // In service: return rows; (Wait, I returned headers + rows in service? 
            // Let's check the service I wrote: "return rows" if format csv. (without headers? No, headers included in logic)).
            // Actually, I should probably standardise. 
            // Let's check what I wrote: 
            /* 
               if (format === 'csv') {
                   const headers = "Date,Description,Account,Debit,Credit,Currency\n";
                   const rows = journal.map...
                   return c.text(headers + rows); // OLD
                   return headers + rows; // NEW SERVICE
               }
            */
            return c.text(journalData as string);
        }
    }

    return c.json({
        period: { start, end },
        journal: journalData
    });
});

// --- Scheduled Reports CRUD ---

// GET /schedules
app.get('/schedules', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const schedules = await db.select()
        .from(scheduledReports)
        .where(eq(scheduledReports.tenantId, tenant.id))
        .all();

    return c.json(schedules);
});

// POST /schedules
app.post('/schedules', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const { reportType, frequency, recipients } = await c.req.json();

    if (!reportType || !frequency || !recipients || !Array.isArray(recipients)) {
        return c.json({ error: "Missing required fields: reportType, frequency, recipients (array)" }, 400);
    }

    // Calculate nextRun
    const now = new Date();
    let nextRun = new Date();
    if (frequency === 'daily') nextRun.setDate(now.getDate() + 1);
    else if (frequency === 'weekly') nextRun.setDate(now.getDate() + 7);
    else if (frequency === 'monthly') nextRun.setMonth(now.getMonth() + 1);

    const newSchedule = {
        id: uuidv4(),
        tenantId: tenant.id,
        reportType,
        frequency,
        recipients,
        nextRun,
        status: 'active'
    };

    await db.insert(scheduledReports).values(newSchedule as any).run();

    return c.json(newSchedule);
});

// DELETE /schedules/:id
app.delete('/schedules/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const id = c.req.param('id');
    await db.delete(scheduledReports)
        .where(and(
            eq(scheduledReports.id, id),
            eq(scheduledReports.tenantId, tenant.id)
        ))
        .run();

    return c.json({ success: true });
});

export default app;
