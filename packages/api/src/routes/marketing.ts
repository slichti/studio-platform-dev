import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, sql, desc } from 'drizzle-orm';
import { tenantMembers, platformConfig, aiUsageLogs, automationLogs, marketingAutomations, marketingCampaigns } from '@studio/db/src/schema';
import { HonoContext } from '../types';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { EmailService } from '../services/email';
import { Permission } from '../services/permissions';

const marketing = new Hono<HonoContext>();

/**
 * [GET] /
 * List campaigns for this tenant
 */
marketing.get('/', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    try {
        const campaigns = await db.select()
            .from(marketingCampaigns)
            .where(eq(marketingCampaigns.tenantId, tenant.id))
            .orderBy(desc(marketingCampaigns.createdAt))
            .all();

        return c.json({ campaigns });
    } catch (e: any) {
        console.error('Failed to fetch campaigns:', e);
        return c.json({ error: 'Failed to fetch campaigns' }, 500);
    }
});

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

/**
 * [POST] /generate-email
 * Uses Gemini to generate AI email copy
 */
import { GeminiService } from '../services/gemini';

const generateEmailSchema = z.object({
    prompt: z.string().min(1),
    context: z.string().optional()
});

marketing.post('/generate-email', zValidator('json', generateEmailSchema), async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) {
        return c.json({ error: 'AI features not configured (missing GEMINI_API_KEY)' }, 503);
    }

    const { prompt, context } = c.req.valid('json');
    const tenant = c.get('tenant');
    const aiConfigRow = await createDb(c.env.DB).query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'config_ai')
    });
    const configAi = aiConfigRow?.value as any;

    const gemini = new GeminiService(apiKey, configAi);

    try {
        const { content, usage } = await gemini.generateEmailCopy(prompt, tenant?.name, context);

        // Log Usage asynchronously (don't block response)
        const db = createDb(c.env.DB);
        c.executionCtx.waitUntil(
            db.insert(aiUsageLogs).values({
                id: crypto.randomUUID(),
                tenantId: tenant?.id || null,
                userId: c.get('auth').userId || null,
                model: configAi?.model || 'gemini-2.0-flash',
                feature: 'email_marketing',
                promptTokens: usage.promptTokenCount,
                completionTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount,
            }).run()
        );

        return c.json({ html: content });
    } catch (e: any) {
        console.error('Failed to generate AI email:', e);
        return c.json({ error: 'Failed to generate content' }, 500);
    }
});

// ============================================================
// AUTOMATIONS ROUTES (tenant-specific)
// ============================================================

// GET /automations/stats - Aggregate stats for this tenant
marketing.get('/automations/stats', async (c) => {
    const can = c.get('can');
    if (!can('manage_marketing' as Permission)) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    try {
        const [counts, sentLogs] = await Promise.all([
            db.select({
                total: sql`count(*)`,
                active: sql`count(case when is_enabled = 1 then 1 end)`
            })
                .from(marketingAutomations)
                .where(eq(marketingAutomations.tenantId, tenant.id))
                .get(),

            db.select({ count: sql`count(*)` })
                .from(automationLogs)
                .where(eq(automationLogs.tenantId, tenant.id))
                .get()
        ]) as any[];

        return c.json({
            totalAutomations: Number(counts?.total || 0),
            activeCount: Number(counts?.active || 0),
            emailsSent: Number(sentLogs?.count || 0)
        });
    } catch (e: any) {
        console.error('Failed to fetch automation stats:', e);
        return c.json({ error: 'Failed' }, 500);
    }
});

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
        return c.json({ error: 'Failed to fetch automations' }, 500);
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
            steps: body.steps || [],
            isEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }).run();

        return c.json({ id, success: true }, 201);
    } catch (e: any) {
        console.error('Failed to create automation:', e);
        return c.json({ error: 'Failed to create automation' }, 400);
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
        if (body.steps) updateData.steps = body.steps;

        await db.update(marketingAutomations)
            .set(updateData)
            .where(eq(marketingAutomations.id, id))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to update automation:', e);
        return c.json({ error: 'Failed to update automation' }, 400);
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
        return c.json({ error: 'Failed to delete automation' }, 400);
    }
});

export default marketing;
