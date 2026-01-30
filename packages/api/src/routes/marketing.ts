import { Hono } from 'hono';
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { tenantMembers } from '@studio/db/src/schema';
import { HonoContext } from '../types';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { EmailService } from '../services/email';
import { Permission } from '../services/permissions';

const marketing = new Hono<HonoContext>();

/**
 * [GET] /audiences
 * List audiences from Resend
 */
marketing.get('/audiences', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized', message: 'You do not have permission to manage marketing' }, 403);
    }

    const emailService = c.get('email');

    try {
        const { data, error } = await emailService.resendClient.audiences.list();

        if (error) {
            return c.json({ error: 'Resend Error', message: error.message }, 400);
        }

        return c.json({ audiences: data?.data || [] });
    } catch (e: any) {
        return c.json({ error: 'Server Error', message: e.message }, 500);
    }
});

/**
 * [POST] /broadcast
 * Send an email to an audience
 */
const broadcastSchema = z.object({
    audienceId: z.string(),
    subject: z.string(),
    content: z.string(), // Markdown
});

marketing.post('/broadcast', zValidator('json', broadcastSchema), async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized', message: 'You do not have permission to manage marketing' }, 403);
    }

    const { audienceId, subject, content } = c.req.valid('json');
    const emailService = c.get('email');

    try {
        await emailService.sendBroadcast(audienceId, subject, content);
        return c.json({ success: true, message: 'Broadcast queued successfully' });
    } catch (e: any) {
        return c.json({ error: 'Broadcast Failed', message: e.message }, 500);
    }
});

marketing.post('/sync-members', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const emailService = c.get('email');

    // Run in background
    c.executionCtx.waitUntil((async () => {
        const members = await db.query.tenantMembers.findMany({
            where: eq(tenantMembers.tenantId, tenant.id),
            with: { user: true }
        });

        for (const m of members) {
            const firstName = (m.profile as any)?.firstName || (m.user.profile as any)?.firstName;
            const lastName = (m.profile as any)?.lastName || (m.user.profile as any)?.lastName;
            await emailService.syncContact(m.user.email, firstName, lastName);
        }
    })());

    return c.json({ success: true, message: 'Sync started' });
});

export default marketing;
