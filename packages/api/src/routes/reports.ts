import { Hono } from 'hono';
import { createDb } from '../db';
import { ReportService } from '../services/reports';
import { tenants } from 'db/src/schema';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /revenue
app.get('/revenue', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

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

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getAttendance(start, end);

    return c.json(result as unknown as import('../types').ReportsAttendanceResponse);
});

// POST /projection
app.post('/projection', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
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

export default app;
