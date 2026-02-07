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

// ============================================================
// AUTOMATIONS ROUTES (tenant-specific)
// ============================================================
import { marketingAutomations } from '@studio/db/src/schema';
import { desc } from 'drizzle-orm';

// GET /automations - List automations for this tenant
marketing.get('/automations', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    try {
        const automations = await db.select()
            .from(marketingAutomations)
            .where(eq(marketingAutomations.tenantId, tenant.id))
            .orderBy(desc(marketingAutomations.createdAt))
            .all();

        return c.json(automations);
    } catch (e: any) {
        console.error('Failed to fetch automations:', e);
        return c.json({ error: e.message }, 500);
    }
});

// POST /automations - Create a new automation for this tenant
marketing.post('/automations', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const body = await c.req.json();

    try {
        const id = crypto.randomUUID();
        await db.insert(marketingAutomations).values({
            id,
            tenantId: tenant.id,
            triggerEvent: body.triggerEvent,
            subject: body.subject,
            content: body.content,
            timingType: body.timingType || 'immediate',
            timingValue: body.timingValue || 0,
            isEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }).run();

        return c.json({ id, success: true }, 201);
    } catch (e: any) {
        console.error('Failed to create automation:', e);
        return c.json({ error: e.message }, 400);
    }
});

// PATCH /automations/:id - Update automation
marketing.patch('/automations/:id', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const id = c.req.param('id');
    const body = await c.req.json();

    try {
        const updateData: any = { updatedAt: new Date() };
        if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
        if (body.subject) updateData.subject = body.subject;
        if (body.content) updateData.content = body.content;
        if (body.timingType) updateData.timingType = body.timingType;
        if (body.timingValue !== undefined) updateData.timingValue = body.timingValue;

        await db.update(marketingAutomations)
            .set(updateData)
            .where(eq(marketingAutomations.id, id))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to update automation:', e);
        return c.json({ error: e.message }, 400);
    }
});

// DELETE /automations/:id - Delete automation
marketing.delete('/automations/:id', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    try {
        await db.delete(marketingAutomations)
            .where(eq(marketingAutomations.id, id))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to delete automation:', e);
        return c.json({ error: e.message }, 400);
    }
});

export default marketing;
