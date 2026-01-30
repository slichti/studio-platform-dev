import { Hono } from 'hono';
import { createDb } from '../db';
import { users, auditLogs } from '@studio/db/src/schema';
import { eq, desc } from 'drizzle-orm';
import type { HonoContext } from '../types';
import { authMiddleware } from '../middleware/auth';

// Sub-routers
import tenantFeaturesRouter from './admin.features';
import usersRouter from './admin.users';
import tenantsRouter from './admin.tenants';
import billingRouter from './admin.billing';
import mediaRouter from './admin.media';
import statsRouter from './admin.stats';
import commsRouter from './admin.communications';
import supportRouter from './admin.support';
import configRouter from './admin.config';

const app = new Hono<HonoContext>();

// Protect all admin routes
app.use('*', authMiddleware);
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    const db = createDb(c.env.DB);

    const user = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    // DEBUG: Log admin access attempts to diagnose 403
    if (user?.role !== 'admin' && !user?.isPlatformAdmin) {
        console.error(`[Admin Access Denied] UserID: ${auth.userId}, Found: ${!!user}, Role: ${user?.role}, IsPlatformAdmin: ${user?.isPlatformAdmin}`);
        return c.json({ error: 'Platform Admin privileges required' }, 403);
    }
    await next();
});

// Mounted Routes
app.route('/users', usersRouter);
app.route('/tenants', tenantsRouter);
app.route('/billing', billingRouter);
app.route('/media', mediaRouter);
app.route('/stats', statsRouter);
app.route('/communications', commsRouter);
app.route('/support', supportRouter);
app.route('/config', configRouter);
app.route('/', tenantFeaturesRouter); // Preserves /admin/tenants/:id/features

// GET /logs - Recent Audit Logs (Global view)
app.get('/logs', async (c) => {
    const db = createDb(c.env.DB);

    try {
        const logs = await db.select({
            id: auditLogs.id,
            action: auditLogs.action,
            actorId: auditLogs.actorId,
            targetId: auditLogs.targetId,
            details: auditLogs.details,
            createdAt: auditLogs.createdAt,
            actorEmail: users.email,
            actorProfile: users.profile
        })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.actorId, users.id))
            .orderBy(desc(auditLogs.createdAt))
            .limit(100)
            .all();

        return c.json(logs);
    } catch (e: any) {
        console.error("Fetch Logs Failed:", e);
        return c.json({ error: "Failed to fetch audit logs: " + e.message }, 500);
    }
});

export default app;
