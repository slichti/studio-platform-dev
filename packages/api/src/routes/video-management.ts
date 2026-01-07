import { Hono } from 'hono';
import { createDb } from '../db';
import { videos, brandingAssets, tenants, tenantMembers } from 'db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const app = new Hono<{ Bindings: any, Variables: any }>();

// List Studio Videos
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    // Pagination (TODO)
    const results = await db.select()
        .from(videos)
        .where(eq(videos.tenantId, tenant.id))
        .orderBy(desc(videos.createdAt))
        .all();

    const stats = await db.select({ totalSize: sql<number>`sum(${videos.sizeBytes})` })
        .from(videos)
        .where(eq(videos.tenantId, tenant.id))
        .get();

    return c.json({ videos: results, storageUsage: stats?.totalSize || 0 });
});

// Update Video (Trim)
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const videoId = c.req.param('id');
    const { trimStart, trimEnd, title } = await c.req.json();

    // Verify ownership
    const video = await db.select().from(videos)
        .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenant.id)))
        .get();

    if (!video) return c.json({ error: "Video not found" }, 404);

    const updateData: any = {};
    if (trimStart !== undefined) updateData.trimStart = trimStart;
    if (trimEnd !== undefined) updateData.trimEnd = trimEnd;
    if (title !== undefined) updateData.title = title;

    await db.update(videos).set(updateData).where(eq(videos.id, videoId)).run();
    return c.json({ success: true });
});

// List Branding Assets
app.get('/branding', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const assets = await db.select()
        .from(brandingAssets)
        .where(eq(brandingAssets.tenantId, tenant.id))
        .all();

    return c.json(assets);
});

// Activate Branding Asset
app.patch('/branding/:id/activate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const assetId = c.req.param('id');

    const asset = await db.select().from(brandingAssets)
        .where(and(eq(brandingAssets.id, assetId), eq(brandingAssets.tenantId, tenant.id)))
        .get();

    if (!asset) return c.json({ error: "Asset not found" }, 404);

    // Deactivate others of same type
    await db.update(brandingAssets)
        .set({ active: false })
        .where(and(eq(brandingAssets.tenantId, tenant.id), eq(brandingAssets.type, asset.type)))
        .run();

    // Activate target
    await db.update(brandingAssets)
        .set({ active: true })
        .where(eq(brandingAssets.id, assetId))
        .run();

    return c.json({ success: true });
});

export default app;
