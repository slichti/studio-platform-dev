
import { Hono } from 'hono';
import { createDb } from '../db';
import { customReports, tenants } from 'db/src/schema';
import { ReportService } from '../services/reports';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    user: any;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.use('*', authMiddleware);

// GET / - List Saved Reports
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const reports = await db.select().from(customReports)
        .where(eq(customReports.tenantId, tenant.id))
        .orderBy(desc(customReports.createdAt))
        .all();

    return c.json({ reports });
});

// POST /query - Run Ad-hoc Query
app.post('/query', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();

    const { metrics, dimensions, filters } = body;
    // Validate?
    // Filters should have start/end date
    const validatedFilters = {
        ...filters,
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate)
    };

    const service = new ReportService(db, tenant.id);
    const result = await service.query({ metrics, dimensions, filters: validatedFilters });

    return c.json(result);
});

// POST / - Save Report
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const user = c.get('user');
    const { name, config, isPublic } = await c.req.json();

    const id = crypto.randomUUID();
    await db.insert(customReports).values({
        id,
        tenantId: tenant.id,
        name,
        config, // JSON
        isPublic: !!isPublic,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return c.json({ success: true, id });
});

// DELETE /:id - Delete Report
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

    await db.delete(customReports)
        .where(and(eq(customReports.id, id), eq(customReports.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
