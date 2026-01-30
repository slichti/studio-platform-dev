import { Hono } from 'hono';
import { createDb } from '../db';
import { videos, brandingAssets, usageLogs } from '@studio/db/src/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /videos - Platform Video Dashboard
app.get('/videos', async (c) => {
    const db = createDb(c.env.DB);
    const limit = 100;

    const totalVideosResult = await db.select({ count: count(videos.id) }).from(videos).get();

    const results = await db.select({
        id: videos.id,
        title: videos.title,
        status: videos.status,
        duration: videos.duration,
        createdAt: videos.createdAt,
    })
        .from(videos)
        .orderBy(desc(videos.createdAt))
        .limit(limit)
        .all();

    const totalUsage = await db.select({ total: sql<number>`sum(value)` })
        .from(usageLogs)
        .where(eq(usageLogs.metric, 'video_storage_bytes'))
        .get();

    return c.json({
        videos: results,
        stats: {
            totalStorageBytes: totalUsage?.total || 0,
            processingCount: 0
        }
    });
});

// DELETE /videos/:id - Admin Force Delete
app.delete('/videos/:id', async (c) => {
    const db = createDb(c.env.DB);
    const videoId = c.req.param('id');
    const auth = c.get('auth');

    const video = await db.query.videos.findFirst({ where: eq(videos.id, videoId) });
    if (!video) return c.json({ error: "Video not found" }, 404);

    await db.delete(videos).where(eq(videos.id, videoId)).run();

    if (video.tenantId) {
        await db.insert(usageLogs).values({
            id: crypto.randomUUID(),
            tenantId: video.tenantId,
            metric: 'audit_video_delete',
            value: 1,
            meta: { videoId, deletedBy: auth.userId }
        }).run();
    }

    return c.json({ success: true });
});

// GET /branding - Platform Branding Assets
app.get('/branding', async (c) => {
    const db = createDb(c.env.DB);
    const limit = 100;

    const results = await db.select({
        id: brandingAssets.id,
        title: brandingAssets.title,
        type: brandingAssets.type,
        cloudflareStreamId: brandingAssets.cloudflareStreamId,
        createdAt: brandingAssets.createdAt
    })
        .from(brandingAssets)
        .orderBy(desc(brandingAssets.createdAt))
        .limit(limit)
        .all();

    return c.json(results);
});

// POST /videos/upload-url - Admin Video Upload (Proxy for Tenant)
app.post('/videos/upload-url', async (c) => {
    const { targetTenantId, type } = await c.req.json();
    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = c.env.CLOUDFLARE_API_TOKEN;

    const meta = {
        tenantId: targetTenantId,
        type: type || 'video',
        isAdminUpload: 'true'
    };

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_upload=true`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                maxDurationSeconds: 3600,
                creator: targetTenantId,
                meta
            })
        }
    );

    const data: any = await response.json();
    if (!data.success) {
        return c.json({ error: "Failed to generate upload URL", details: data.errors }, 500);
    }

    return c.json({
        uploadUrl: data.result.uploadURL,
        uid: data.result.uid
    });
});

export default app;
