
import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantFeatures, users, platformConfig, auditLogs } from '@studio/db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { Variables, Bindings } from '../types';

const app = new Hono<{ Variables: Variables, Bindings: Bindings }>();

// [SECURITY] Enforce Platform Admin Access
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDb(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, auth.userId)).get();

    if (!user?.isPlatformAdmin && user?.role !== 'admin') {
        return c.json({ error: "Forbidden: Admin Access Required" }, 403);
    }

    await next();
});
// SECURITY NOTE: All routes below are protected by the middleware above which requires Platform Admin access.

// 1. Get Global Mobile Stats & Config
app.get('/config', async (c) => {
    const db = createDb(c.env.DB);

    // Read from platformConfig table
    const configRows = await db.select().from(platformConfig).all();
    const configMap = new Map(configRows.map(r => [r.key, r]));

    const maintenanceMode = configMap.get('mobile_maintenance_mode')?.enabled ?? false;
    const minVersion = (configMap.get('mobile_min_version')?.value as any)?.version || "1.0.0";

    const totalTenants = await db.select({ count: tenants.id }).from(tenants).all();
    const authorizedTenants = await db.select().from(tenantFeatures).where(eq(tenantFeatures.featureKey, 'mobile_access')).all();

    return c.json({
        maintenanceMode,
        minVersion,
        stats: {
            totalTenants: totalTenants.length,
            authorizedCount: authorizedTenants.length
        }
    });
});

// 1b. Update Global Mobile Config
app.put('/config', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    const { maintenanceMode, minVersion } = await c.req.json();
    const actions: string[] = [];

    if (maintenanceMode !== undefined) {
        await db.insert(platformConfig).values({
            key: 'mobile_maintenance_mode',
            enabled: maintenanceMode,
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: [platformConfig.key],
            set: { enabled: maintenanceMode, updatedAt: new Date() }
        }).run();
        actions.push(`maintenance_mode:${maintenanceMode}`);
    }

    if (minVersion !== undefined) {
        await db.insert(platformConfig).values({
            key: 'mobile_min_version',
            value: { version: minVersion },
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: [platformConfig.key],
            set: { value: { version: minVersion }, updatedAt: new Date() }
        }).run();
        actions.push(`min_version:${minVersion}`);
    }

    // Log the action
    if (actions.length > 0 && auth?.userId) {
        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: auth.userId,
            action: 'update_global_mobile_config',
            details: { changes: actions },
            createdAt: new Date()
        }).run();
    }

    return c.json({ success: true });
});

// 2. List Tenants with Mobile Status
app.get('/tenants', async (c) => {
    const db = createDb(c.env.DB);
    const search = c.req.query('search') || '';

    const allTenants = await db.select().from(tenants).all();
    const mobileFeatures = await db.select().from(tenantFeatures).where(eq(tenantFeatures.featureKey, 'mobile_access')).all();
    const authorizedTenantIds = new Set(mobileFeatures.map(f => f.tenantId));

    const result = allTenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        mobileEnabled: authorizedTenantIds.has(t.id),
        mobileConfig: t.mobileAppConfig, // To see if they have configured it
    })).filter(t => {
        if (!search) return true;
        return t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase());
    });

    return c.json(result);
});

// 3. Toggle Mobile Access for a Tenant
app.put('/tenants/:id/access', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    const tenantId = c.req.param('id');
    const { enabled } = await c.req.json();

    if (enabled) {
        await db.insert(tenantFeatures).values({
            id: crypto.randomUUID(),
            tenantId,
            featureKey: 'mobile_access',
            enabled: true
        }).onConflictDoUpdate({
            target: [tenantFeatures.tenantId, tenantFeatures.featureKey],
            set: { enabled: true }
        }).run();
    } else {
        await db.delete(tenantFeatures)
            .where(and(
                eq(tenantFeatures.tenantId, tenantId),
                eq(tenantFeatures.featureKey, 'mobile_access')
            ))
            .run();
    }

    // Log the action
    if (auth?.userId) {
        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: auth.userId,
            tenantId,
            action: enabled ? 'enable_mobile_access' : 'disable_mobile_access',
            targetId: tenantId,
            createdAt: new Date()
        }).run();
    }

    return c.json({ success: true, enabled });
});

// 4. Get Logs (Real Audit Logs)
app.get('/logs', async (c) => {
    const db = createDb(c.env.DB);

    // Fetch last 50 logs, joining with tenant info
    const logs = await db.select({
        id: auditLogs.id,
        timestamp: auditLogs.createdAt,
        action: auditLogs.action,
        tenant: tenants.slug,
        details: auditLogs.details
    })
        .from(auditLogs)
        .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(50)
        .all();

    return c.json(logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        level: 'info', // Default to info, could be derived from action type
        message: `${log.action} - ${JSON.stringify(log.details)}`,
        tenant: log.tenant || 'System'
    })));
});

export default app;
