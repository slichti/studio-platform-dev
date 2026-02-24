import { OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '../db';
import { tenants, classes, videos, locations } from '@studio/db/src/schema';
import { eq, and, gt } from 'drizzle-orm';
import { Bindings, Variables } from '../types';

const sitemapRoute = new OpenAPIHono<{ Bindings: Bindings, Variables: Variables }>();

// Global Streaming Sitemap
// Memory-efficient query using D1 cursor (or batching) wrapped in a ReadableStream
sitemapRoute.get('/sitemap.xml', async (c) => {
    const db = createDb(c.env.DB);

    // Check Cache First
    const cacheUrl = new URL(c.req.url);
    const cacheKey = new Request(cacheUrl.toString(), c.req);
    const cache = (caches as any).default;
    let response = await cache.match(cacheKey);

    if (response) {
        return response;
    }

    // Create streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const encoder = new TextEncoder();

    c.executionCtx.waitUntil((async () => {
        try {
            await writer.write(encoder.encode('<?xml version="1.0" encoding="UTF-8"?>\n'));
            await writer.write(encoder.encode('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'));

            // 1. Stream all active tenants (studios)
            const allTenants = await db.select({
                slug: tenants.slug,
                createdAt: tenants.createdAt
            }).from(tenants)
                .where(eq(tenants.status, 'active'))
                .all();

            for (const t of allTenants) {
                const lastMod = t.createdAt ? new Date(t.createdAt as Date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                const urlNode = `  <url>\n    <loc>https://studio-platform.com/studios/${t.slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
                await writer.write(encoder.encode(urlNode));
            }

            // 2. Stream all future classes
            const now = new Date();
            const futureClasses = await db.select({
                id: classes.id,
                tenantSlug: tenants.slug,
                startTime: classes.startTime
            }).from(classes)
                .innerJoin(tenants, eq(classes.tenantId, tenants.id))
                .where(and(gt(classes.startTime, now), eq(classes.status, 'active')))
                .all();

            for (const cls of futureClasses) {
                const urlNode = `  <url>\n    <loc>https://studio-platform.com/studios/${cls.tenantSlug}/classes/${cls.id}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                await writer.write(encoder.encode(urlNode));
            }

            // 3. Stream all Videos (Tier 3: LMS SEO)
            const allVideos = await db.select({
                id: videos.id,
                tenantSlug: tenants.slug,
                title: videos.title,
                posterUrl: videos.posterUrl,
                createdAt: videos.createdAt
            }).from(videos)
                .innerJoin(tenants, eq(videos.tenantId, tenants.id))
                .where(eq(videos.status, 'ready'))
                .all();

            for (const vid of allVideos) {
                const urlNode = `  <url>\n    <loc>https://studio-platform.com/studios/${vid.tenantSlug}/videos/${vid.id}</loc>\n    <video:video>\n      <video:thumbnail_loc>${vid.posterUrl || 'https://studio-platform.com/default-video.jpg'}</video:thumbnail_loc>\n      <video:title>${vid.title}</video:title>\n      <video:publication_date>${new Date(vid.createdAt as Date).toISOString()}</video:publication_date>\n    </video:video>\n  </url>\n`;
                await writer.write(encoder.encode(urlNode));
            }

            // 4. Stream all locations (Tier 3: Multi-Location SEO)
            const allLocations = await db.select({
                slug: tenants.slug,
                locationId: locations.id,
                createdAt: locations.createdAt
            }).from(locations)
                .innerJoin(tenants, eq(locations.tenantId, tenants.id))
                .where(eq(locations.isActive, true))
                .all();

            for (const loc of allLocations) {
                const lastMod = loc.createdAt ? new Date(loc.createdAt as Date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                const urlNode = `  <url>\n    <loc>https://studio-platform.com/studios/${loc.slug}/locations/${loc.locationId}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
                await writer.write(encoder.encode(urlNode));
            }

            await writer.write(encoder.encode('</urlset>'));
        } catch (e) {
            console.error('Sitemap streaming error', e);
        } finally {
            await writer.close();
        }
    })());

    const res = new Response(readable, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour at edge
        }
    });

    // Store in cache
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
});

export default sitemapRoute;
