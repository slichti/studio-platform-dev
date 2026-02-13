import { Hono } from 'hono';
import { createDb } from '../db';
import { auditLogs } from '@studio/db/src/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /audit-logs - List logs
app.get('/', async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const db = createDb(c.env.DB);

        // Query Params
        const actorId = c.req.query('actorId');
        const action = c.req.query('action');
        const targetType = c.req.query('targetType');
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

        let conditions = [eq(auditLogs.tenantId, tenant.id)];

        if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
        if (action) conditions.push(eq(auditLogs.action, action));
        if (targetType) conditions.push(eq(auditLogs.targetType, targetType));
        if (startDate) conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
        if (endDate) conditions.push(lte(auditLogs.createdAt, new Date(endDate)));

        const logs = await db.select()
            .from(auditLogs)
            .where(and(...conditions))
            .orderBy(desc(auditLogs.createdAt))
            .limit(limit)
            .all();

        return c.json(logs);
    } catch (e: any) {
        console.error('Audit Logs Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

export default app;
