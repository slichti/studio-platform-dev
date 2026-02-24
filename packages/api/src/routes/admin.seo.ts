import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, platformConfig } from '@studio/db/src/schema';
import { count, eq, and, sql, desc } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /stats - Global SEO Metrics
app.get('/stats', async (c) => {
    const db = createDb(c.env.DB);

    // 1. Tenants with Indexing Enabled (via seo_config)
    const indexingEnabledRes = await db.select({ count: count() })
        .from(tenants)
        .where(sql`json_extract(${tenants.seoConfig}, '$.indexingEnabled') = true`)
        .get();

    // 2. Tenants with GBP Connected
    const gbpConnectedRes = await db.select({ count: count() })
        .from(tenants)
        .where(sql`${tenants.gbpToken} IS NOT NULL`)
        .get();

    // 3. Sitemap Coverage (Tenants with sitemaps potentially generated - roughly all public tenants)
    const sitemapEligibleRes = await db.select({ count: count() })
        .from(tenants)
        .where(eq(tenants.isPublic, true))
        .get();

    return c.json({
        indexingEnabled: indexingEnabledRes?.count || 0,
        gbpConnected: gbpConnectedRes?.count || 0,
        sitemapEligible: sitemapEligibleRes?.count || 0,
        // Mock queue size if binding not present or inaccessible
        queueBacklog: 0
    });
});

// GET /tenants - Detailed SEO list
app.get('/tenants', async (c) => {
    const db = createDb(c.env.DB);
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;

    const list = await db.select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        isPublic: tenants.isPublic,
        seoConfig: tenants.seoConfig,
        hasGbp: sql<boolean>`${tenants.gbpToken} IS NOT NULL`,
        createdAt: tenants.createdAt
    })
        .from(tenants)
        .orderBy(desc(tenants.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

    return c.json(list);
});

// GET /config - Global Platform SEO Config
app.get('/config', async (c) => {
    const db = createDb(c.env.DB);
    const config = await db.select().from(platformConfig).where(eq(platformConfig.key, 'platform_seo')).get();

    // Default config if not exists
    if (!config) {
        return c.json({
            titleTemplate: 'Studio Platform | %s',
            metaDescription: 'The all-in-one platform for fitness studios.',
            keywords: 'fitness, studio, management, yoga, dance'
        });
    }

    return c.json(config.value || {});
});

// PATCH /config - Update Global Platform SEO Config
app.patch('/config', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const { titleTemplate, metaDescription, keywords } = body;

    await db.insert(platformConfig)
        .values({
            key: 'platform_seo',
            value: { titleTemplate, metaDescription, keywords },
            enabled: true,
            updatedAt: new Date()
        })
        .onConflictDoUpdate({
            target: platformConfig.key,
            set: {
                value: { titleTemplate, metaDescription, keywords },
                updatedAt: new Date()
            }
        })
        .run();

    return c.json({ success: true });
});

// PATCH /tenants/:id/seo - Override Tenant SEO Config
app.patch('/tenants/:id/seo', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { indexingEnabled, gbpConnected } = await c.req.json();

    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

    const seoConfig = (tenant.seoConfig || {}) as any;
    if (indexingEnabled !== undefined) seoConfig.indexingEnabled = indexingEnabled;

    const updates: any = { seoConfig, updatedAt: new Date() };

    // If gbpConnected is being explicitly set/unset from admin (NAP sync toggle)
    // Note: GBP Token is usually handled via OAuth, but admin can "disconnect" it
    if (gbpConnected === false) {
        updates.gbpToken = null;
    }

    await db.update(tenants)
        .set(updates)
        .where(eq(tenants.id, tenantId))
        .run();

    return c.json({ success: true });
});

export default app;
