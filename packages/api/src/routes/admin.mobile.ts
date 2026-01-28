
import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantFeatures, users } from '@studio/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Variables, Bindings } from '../index';

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

// 1. Get Global Mobile Stats & Config
app.get('/config', async (c) => {
    const db = createDb(c.env.DB);

    // Mock global maintenance mode for now (could be stored in platformConfig table)
    const maintenanceMode = false;
    const minVersion = "1.0.0";

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

    return c.json({ success: true, enabled });
});

// 4. Get Logs (Mocked for now)
app.get('/logs', async (c) => {
    // In a real implementation, this would query a logs table or structured logging service
    const mockLogs = [
        { id: 1, timestamp: new Date().toISOString(), level: 'info', message: 'Tenant "Garden Yoga" updated mobile theme', tenant: 'garden-yoga' },
        { id: 2, timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'warn', message: 'Failed login attempt from old app version', tenant: 'city-pilates' },
        { id: 3, timestamp: new Date(Date.now() - 7200000).toISOString(), level: 'error', message: 'Push notification delivery failed', tenant: 'downtown-spin' },
    ];
    return c.json(mockLogs);
});

export default app;
