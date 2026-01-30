import { Hono } from 'hono';
import { createDb } from '../db';
import { classes, bookings, subscriptions, membershipPlans } from '@studio/db/src/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { StreamService } from '../services/stream';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /:id/recording - Get video details for playback
app.get('/:id/recording', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo || !classInfo.cloudflareStreamId) {
        return c.json({ error: 'No recording available' }, 404);
    }

    let canWatch = false;

    if (c.get('can')('manage_classes')) {
        canWatch = true;
    } else if (auth && auth.userId) {
        const member = c.get('member');
        if (member) {
            // 1. Check Booking (Confirmed)
            const booking = await db.query.bookings.findFirst({
                where: and(
                    eq(bookings.classId, classId),
                    eq(bookings.memberId, member.id),
                    eq(bookings.status, 'confirmed')
                )
            });
            if (booking) {
                canWatch = true;
            } else {
                // 2. Check Membership with VOD Access
                const activeSub = await db.select({ id: subscriptions.id })
                    .from(subscriptions)
                    .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
                    .where(and(
                        eq(subscriptions.userId, auth.userId),
                        eq(subscriptions.tenantId, tenant.id),
                        inArray(subscriptions.status, ['active', 'trialing']),
                        eq(membershipPlans.vodEnabled, true)
                    ))
                    .limit(1)
                    .get();

                if (activeSub) canWatch = true;
            }
        }
    }

    if (!canWatch) return c.json({ error: 'Access Denied: You must book this class to watch the recording.' }, 403);

    return c.json({
        videoId: classInfo.cloudflareStreamId,
        status: classInfo.recordingStatus
    });
});

// POST /:id/recording - Attach a video from a URL
app.post('/:id/recording', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);
    const { url, name } = await c.req.json();

    if (!url) return c.json({ error: 'URL required' }, 400);
    if (!c.env.CLOUDFLARE_STREAM_ACCOUNT_ID || !c.env.CLOUDFLARE_STREAM_API_TOKEN) {
        return c.json({ error: 'Video service not configured' }, 500);
    }

    const stream = new StreamService(c.env.CLOUDFLARE_STREAM_ACCOUNT_ID, c.env.CLOUDFLARE_STREAM_API_TOKEN);

    try {
        const videoId = await stream.uploadViaLink(url, { name: name || `Class ${classId}` });
        await db.update(classes)
            .set({ cloudflareStreamId: videoId, recordingStatus: 'processing' })
            .where(eq(classes.id, classId))
            .run();

        return c.json({ success: true, videoId, status: 'processing' });
    } catch (e: any) {
        return c.json({ error: e.message || 'Failed to start video upload' }, 500);
    }
});

// DELETE /:id/recording - Remove a recording
app.delete('/:id/recording', async (c) => {
    if (!c.get('can')('manage_classes')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');

    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo || !classInfo.cloudflareStreamId) {
        return c.json({ error: 'No recording found' }, 404);
    }

    try {
        const stream = new StreamService(c.env.CLOUDFLARE_STREAM_ACCOUNT_ID as string, c.env.CLOUDFLARE_STREAM_API_TOKEN as string);
        await stream.deleteVideo(classInfo.cloudflareStreamId);

        await db.update(classes)
            .set({ cloudflareStreamId: null, recordingStatus: null })
            .where(eq(classes.id, classId))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
