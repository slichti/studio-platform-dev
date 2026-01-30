import { Hono } from 'hono';
import { createDb } from '../db';
import { videos, brandingAssets, videoCollections, videoCollectionItems } from '@studio/db/src/schema';
import { eq, and, desc, sql, like } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// List Studio Videos (with Search & Filter)
app.get('/', async (c) => {
    try {
        if (!c.get('can')('manage_classes')) {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

        const query = c.req.query('q');
        const status = c.req.query('status');

        const conditions = [eq(videos.tenantId, tenant.id)];
        if (query) conditions.push(like(videos.title, `%${query}%`));
        if (status && status !== 'all') conditions.push(eq(videos.status, status as any));

        const results = await db.select()
            .from(videos)
            .where(and(...conditions))
            .orderBy(desc(videos.createdAt))
            .all();

        let totalSize = 0;
        try {
            const stats = await db.select({ totalSize: sql<number>`sum(${videos.sizeBytes})` })
                .from(videos)
                .where(eq(videos.tenantId, tenant.id))
                .get();
            totalSize = stats?.totalSize || 0;
        } catch (e) { console.error(e); }

        return c.json({ videos: results, storageUsage: totalSize });
    } catch (e: any) {
        return c.json({ videos: [], storageUsage: 0, error: e.message });
    }
});

// Update Video
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const videoId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));

    const video = await db.select().from(videos)
        .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenant.id)))
        .get();

    if (!video) return c.json({ error: "Video not found" }, 404);

    const updateData: any = {};
    const fields = ['title', 'description', 'tags', 'posterUrl', 'accessLevel', 'trimStart', 'trimEnd'];
    fields.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });

    await db.update(videos).set(updateData).where(eq(videos.id, videoId)).run();
    return c.json({ success: true });
});

// List Branding Assets
app.get('/branding', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const assets = await db.select()
        .from(brandingAssets)
        .where(eq(brandingAssets.tenantId, tenant.id))
        .all();

    return c.json(assets);
});

// Activate Branding Asset
app.patch('/branding/:id/activate', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const assetId = c.req.param('id');

    const asset = await db.select().from(brandingAssets)
        .where(and(eq(brandingAssets.id, assetId), eq(brandingAssets.tenantId, tenant.id)))
        .get();

    if (!asset) return c.json({ error: "Asset not found" }, 404);

    await db.update(brandingAssets).set({ active: false })
        .where(and(eq(brandingAssets.tenantId, tenant.id), eq(brandingAssets.type, asset.type))).run();

    await db.update(brandingAssets).set({ active: true }).where(eq(brandingAssets.id, assetId)).run();
    return c.json({ success: true });
});

// Update Branding Asset
app.patch('/branding/:id', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const assetId = c.req.param('id');
    const body = await c.req.json();

    const asset = await db.select().from(brandingAssets)
        .where(and(eq(brandingAssets.id, assetId), eq(brandingAssets.tenantId, tenant.id)))
        .get();

    if (!asset) return c.json({ error: "Asset not found" }, 404);

    const updateData: any = {};
    ['title', 'description', 'tags'].forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });

    await db.update(brandingAssets).set(updateData).where(eq(brandingAssets.id, assetId)).run();
    return c.json({ success: true });
});

// Get Upload URL for Branding
app.post('/branding/upload-url', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { type } = await c.req.json();

    if (!['intro', 'outro'].includes(type)) return c.json({ error: "Invalid type" }, 400);

    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = c.env.CLOUDFLARE_API_TOKEN;

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxDurationSeconds: 60, creator: `tenant:${tenant.id}`, meta: { tenantId: tenant.id, type } })
    });

    const data: any = await response.json();
    if (!data.success) return c.json({ error: "Failed to generate upload URL" }, 500);

    return c.json({ uploadUrl: data.result.uploadURL, uid: data.result.uid });
});

// Save Branding Asset Metadata
app.post('/branding', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { cloudflareStreamId, title, type } = await c.req.json();

    if (!cloudflareStreamId || !title || !type) return c.json({ error: "Missing required fields" }, 400);

    await db.insert(brandingAssets).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        type: type as any,
        title,
        cloudflareStreamId,
        active: false
    }).run();

    return c.json({ success: true });
});

// Delete Branding Asset
app.delete('/branding/:id', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const assetId = c.req.param('id');

    const asset = await db.select().from(brandingAssets)
        .where(and(eq(brandingAssets.id, assetId), eq(brandingAssets.tenantId, tenant.id)))
        .get();

    if (!asset) return c.json({ error: "Asset not found" }, 404);

    await db.delete(brandingAssets).where(eq(brandingAssets.id, assetId)).run();
    return c.json({ success: true });
});

// Get Upload URL for GENERIC VOD
app.post('/upload-url', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = c.env.CLOUDFLARE_API_TOKEN;

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator: `tenant:${tenant.id}`, meta: { tenantId: tenant.id, type: 'vod' } })
    });

    const data: any = await response.json();
    if (!data.success) return c.json({ error: "Failed to generate upload URL" }, 500);

    return c.json({ uploadUrl: data.result.uploadURL, uid: data.result.uid });
});

// Create Video (After Upload)
app.post('/', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { cloudflareStreamId, title, description } = await c.req.json();

    if (!cloudflareStreamId || !title) return c.json({ error: "Missing required fields" }, 400);

    await db.insert(videos).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        title,
        description,
        cloudflareStreamId,
        r2Key: 'stream-direct-upload',
        source: 'upload',
        status: 'processing',
        sizeBytes: 0,
    }).run();

    return c.json({ success: true });
});

// List Collections
app.get('/collections', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const cols = await db.select()
        .from(videoCollections)
        .where(eq(videoCollections.tenantId, tenant.id))
        .orderBy(desc(videoCollections.updatedAt))
        .all();

    return c.json(cols);
});

// Create Collection
app.post('/collections', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const { title, description, slug } = await c.req.json();

    if (!title || !slug) return c.json({ error: "Missing required fields" }, 400);

    const id = crypto.randomUUID();
    await db.insert(videoCollections).values({ id, tenantId: tenant.id, title, description, slug }).run();
    return c.json({ id, success: true });
});

// Get Collection Details
app.get('/collections/:id', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');

    const collection = await db.select().from(videoCollections)
        .where(and(eq(videoCollections.id, id), eq(videoCollections.tenantId, tenant.id))).get();

    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const items = await db.select({
        id: videoCollectionItems.id,
        videoId: videoCollectionItems.videoId,
        order: videoCollectionItems.order,
        video: videos
    })
        .from(videoCollectionItems)
        .leftJoin(videos, eq(videoCollectionItems.videoId, videos.id))
        .where(eq(videoCollectionItems.collectionId, id))
        .orderBy(videoCollectionItems.order).all();

    return c.json({ ...collection, items });
});

// Update Collection
app.patch('/collections/:id', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');
    const { title, description, slug } = await c.req.json();

    await db.update(videoCollections)
        .set({ title, description, slug, updatedAt: new Date() })
        .where(and(eq(videoCollections.id, id), eq(videoCollections.tenantId, tenant.id))).run();

    return c.json({ success: true });
});

// Delete Collection
app.delete('/collections/:id', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');

    await db.delete(videoCollections)
        .where(and(eq(videoCollections.id, id), eq(videoCollections.tenantId, tenant.id))).run();

    return c.json({ success: true });
});

// Manage Collection Items
app.post('/collections/:id/items', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const collectionId = c.req.param('id');
    const { action, videoId, order, itemId } = await c.req.json();

    const collection = await db.select().from(videoCollections)
        .where(and(eq(videoCollections.id, collectionId), eq(videoCollections.tenantId, tenant.id))).get();

    if (!collection) return c.json({ error: "Collection not found" }, 404);

    if (action === 'add') {
        await db.insert(videoCollectionItems).values({ id: crypto.randomUUID(), collectionId, videoId, order: order || 0 }).run();
    } else if (action === 'remove') {
        await db.delete(videoCollectionItems).where(eq(videoCollectionItems.id, itemId)).run();
    } else if (action === 'reorder') {
        await db.update(videoCollectionItems).set({ order }).where(eq(videoCollectionItems.id, itemId)).run();
    }

    return c.json({ success: true });
});

export default app;
