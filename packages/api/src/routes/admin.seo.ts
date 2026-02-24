import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, platformConfig, auditLogs, platformSeoTopics, tenantSeoContentSettings } from '@studio/db/src/schema';
import { count, eq, and, sql, desc, like, or } from 'drizzle-orm';
import type { HonoContext } from '../types';
import { SitemapService } from '../services/sitemap';

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
    const limit = Number(c.req.query('limit')) || 100;

    const list = await db.query.tenants.findMany({
        columns: {
            id: true,
            name: true,
            slug: true,
            isPublic: true,
            seoConfig: true,
            gbpToken: true,
            createdAt: true
        },
        with: {
            seoAutomation: true
        },
        orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
        limit
    });

    return c.json(list.map(t => ({
        ...t,
        hasGbp: !!t.gbpToken
    })));
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

// GET /failures - Recent SEO & GBP Failures
app.get('/failures', async (c) => {
    const db = createDb(c.env.DB);
    const failures = await db.select()
        .from(auditLogs)
        .where(
            or(
                like(auditLogs.action, '%indexing_failed%'),
                like(auditLogs.action, '%gbp_sync_failed%'),
                like(auditLogs.action, '%sitemap_error%')
            )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(20)
        .all();

    return c.json(failures);
});

// POST /health/validate - Trigger global sitemap validation
app.get('/health/validate', async (c) => {
    const db = createDb(c.env.DB);
    const publicTenants = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isPublic, true)).limit(10).all();

    // We'll validate a sample of 10 for the quick health check
    const baseUrl = new URL(c.req.url).origin;
    const results = await Promise.all(publicTenants.map(async (t) => {
        const isValid = await SitemapService.validateSitemap(t.slug, baseUrl);
        return { slug: t.slug, isValid };
    }));

    const validCount = results.filter(r => r.isValid).length;
    const healthScore = publicTenants.length > 0 ? (validCount / publicTenants.length) * 100 : 100;

    return c.json({
        healthScore,
        totalChecked: publicTenants.length,
        validCount,
        details: results
    });
});

// POST /rebuild - Trigger global sitemap/cache rebuild
// GET /topics - Global SEO Topics
app.get('/topics', async (c) => {
    const db = createDb(c.env.DB);
    const list = await db.select().from(platformSeoTopics).orderBy(desc(platformSeoTopics.createdAt)).all();
    return c.json(list);
});

// POST /topics - Create SEO Topic
app.post('/topics', async (c) => {
    const db = createDb(c.env.DB);
    const { name, description } = await c.req.json();
    const id = crypto.randomUUID();
    await db.insert(platformSeoTopics).values({ id, name, description, isActive: true }).run();
    return c.json({ id });
});

// PATCH /topics/:id - Update SEO Topic
app.patch('/topics/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(platformSeoTopics).set(body).where(eq(platformSeoTopics.id, id)).run();
    return c.json({ success: true });
});

// GET /tenants/:id/automation - Tenant Content Automation Settings
app.get('/tenants/:id/automation', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const settings = await db.select().from(tenantSeoContentSettings).where(eq(tenantSeoContentSettings.tenantId, tenantId)).all();
    return c.json(settings);
});

// PATCH /tenants/:id/automation - Toggle/Update Tenant content automation
app.patch('/tenants/:id/automation', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { topicId, frequency, isActive } = await c.req.json();

    const id = crypto.randomUUID();
    await db.insert(tenantSeoContentSettings)
        .values({ id, tenantId, topicId, frequency, isActive, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: [tenantSeoContentSettings.tenantId, tenantSeoContentSettings.topicId],
            set: { frequency, isActive, updatedAt: new Date() }
        })
        .run();

    return c.json({ success: true });
});

export default app;
