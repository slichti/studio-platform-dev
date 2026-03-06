import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantFeatures, platformConfig } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET / - Get global community settings and tenant status
app.get('/', async (c) => {
    const db = createDb(c.env.DB);

    // 1. Get global community config
    const globalConfig = await db.select()
        .from(platformConfig)
        .where(eq(platformConfig.key, 'feature_community'))
        .get();

    // 2. Get all tenants and their community status
    const allTenants = await db.select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        plan: tenants.tier,
    }).from(tenants).all();

    const enabledFeatures = await db.select()
        .from(tenantFeatures)
        .where(eq(tenantFeatures.featureKey, 'community'))
        .all();

    const featureMap = new Set(enabledFeatures.filter(f => f.enabled).map(f => f.tenantId));

    const tenantsResult = allTenants.map(t => ({
        ...t,
        communityEnabled: featureMap.has(t.id)
    }));

    return c.json({
        global: {
            enabled: globalConfig?.enabled ?? false,
            updatedAt: globalConfig?.updatedAt
        },
        tenants: tenantsResult
    });
});

// PUT /global - Update global community toggle
app.put('/global', async (c) => {
    const db = createDb(c.env.DB);
    const { enabled } = await c.req.json();

    await db.insert(platformConfig).values({
        key: 'feature_community',
        enabled: !!enabled,
        description: 'Enable rich social engagement, media sharing, and AI-assisted community building.',
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: [platformConfig.key],
        set: {
            enabled: !!enabled,
            updatedAt: new Date()
        }
    }).run();

    return c.json({ success: true });
});

// PUT /tenants/:id - Toggle community for a specific tenant
app.put('/tenants/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { enabled } = await c.req.json();

    await db.insert(tenantFeatures).values({
        id: crypto.randomUUID(),
        tenantId,
        featureKey: 'community',
        enabled: !!enabled,
        source: 'manual',
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: [tenantFeatures.tenantId, tenantFeatures.featureKey],
        set: {
            enabled: !!enabled,
            source: 'manual',
            updatedAt: new Date()
        }
    }).run();

    return c.json({ success: true });
});

export default app;
