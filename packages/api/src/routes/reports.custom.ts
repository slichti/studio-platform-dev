import { Hono } from 'hono';
import { createDb } from '../db';
import { customReports } from '@studio/db/src/schema';
import { ReportService } from '../services/reports';
import { eq, and, desc } from 'drizzle-orm';
import { HonoContext } from '../types';
import { requirePermission } from '../middleware/rbac';

const app = new Hono<HonoContext>();

// GET /
app.get('/', requirePermission('view_reports'), async (c) => {
    const db = createDb(c.env.DB);
    const list = await db.select().from(customReports).where(eq(customReports.tenantId, c.get('tenant')!.id)).orderBy(desc(customReports.createdAt)).all();
    return c.json({ reports: list });
});

// POST /query
app.post('/query', requirePermission('view_reports'), async (c) => {
    const db = createDb(c.env.DB);
    const { metrics, dimensions, filters, format } = await c.req.json();
    const service = new ReportService(db, c.get('tenant')!.id);
    try {
        const res = await service.query({ metrics, dimensions, filters: { ...filters, startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) } });
        if (format === 'csv') return c.text(service.generateCsv(res.chartData, metrics, dimensions), 200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="report.csv"` });
        return c.json(res);
    } catch (e: any) {
        console.error("[REPORT QUERY ERROR]", e);
        return c.json({ error: e.message }, 500);
    }
});

// POST /
app.post('/', requirePermission('manage_reports'), async (c) => {
    const db = createDb(c.env.DB);
    const { name, config, isPublic } = await c.req.json();
    const id = crypto.randomUUID();
    await db.insert(customReports).values({ id, tenantId: c.get('tenant')!.id, name, config, isPublic: !!isPublic, createdBy: c.get('auth')!.userId, createdAt: new Date(), updatedAt: new Date() }).run();
    return c.json({ success: true, id });
});

// DELETE /:id
app.delete('/:id', requirePermission('manage_reports'), async (c) => {
    const db = createDb(c.env.DB);
    await db.delete(customReports).where(and(eq(customReports.id, c.req.param('id')), eq(customReports.tenantId, c.get('tenant')!.id))).run();
    return c.json({ success: true });
});

export default app;
