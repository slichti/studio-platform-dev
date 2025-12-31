import { Hono } from 'hono';
import { createDb } from '../db';
import { emailLogs, marketingCampaigns, tenants, tenantFeatures } from 'db/src/schema'; // Ensure imports
import { eq, sql, desc, count } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

import { authMiddleware } from '../middleware/auth';

type Variables = {
    auth: { userId: string; claims: any };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Protect all admin routes
app.use('*', authMiddleware);
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    const { createDb } = await import('../db');
    const { users } = await import('db/src/schema');
    const { eq } = await import('drizzle-orm');
    const db = createDb(c.env.DB);

    const user = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!user?.isSystemAdmin) {
        return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
});

// GET /logs - Recent Audit Logs
app.get('/logs', async (c) => {
    const db = createDb(c.env.DB);
    const { auditLogs } = await import('db/src/schema');
    const { desc } = await import('drizzle-orm');

    const logs = await db.select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(100)
        .all();

    return c.json(logs);
});

// GET /stats/email - Global Email Stats
app.get('/stats/email', async (c) => {
    const db = createDb(c.env.DB);

    // Total emails sent
    const totalResult = await db.select({ count: count() }).from(emailLogs).get();
    const totalSent = totalResult?.count || 0;

    // By Tenant
    const byTenant = await db.select({
        tenantName: tenants.name,
        slug: tenants.slug,
        count: count(emailLogs.id)
    })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .groupBy(emailLogs.tenantId)
        .orderBy(desc(count(emailLogs.id)))
        .limit(20)
        .all();

    // Recent Logs
    const recentLogs = await db.select({
        id: emailLogs.id,
        subject: emailLogs.subject,
        recipient: emailLogs.recipientEmail,
        sentAt: emailLogs.sentAt,
        tenantName: tenants.name
    })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .orderBy(desc(emailLogs.sentAt))
        .limit(50)
        .all();

    return c.json({
        totalSent,
        byTenant,
        recentLogs
    });
});

// GET /admin/tenants - Enhanced List (Access existing helper if available or new route)
// The existing /admin/tenants route might return basic info. 
// Let's create an "enrichment" endpoint or just one for specific tenant details.

// For the "Feature View", the user asked to see features on the list.
// The frontend likely calls `GET /admin/tenants`. We should verify if that endpoint returns feature flags/email stats.
// If not, we should update IT, rather than making a new one here.
// But I will provide raw stats endpoint here just in case.

app.get('/tenants/:id/stats', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');

    // Email Count
    const emailCount = await db.select({ count: count() })
        .from(emailLogs)
        .where(eq(emailLogs.tenantId, tenantId))
        .get();

    return c.json({
        emailCount: emailCount?.count || 0
    });
});

export default app;
