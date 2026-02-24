import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';
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

export default app;
