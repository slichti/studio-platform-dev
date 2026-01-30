import { Hono } from 'hono';
import { createDb } from '../db';
import { marketingAutomations, emailLogs } from '@studio/db/src/schema';
import { eq, desc, isNull, and } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET / - List all automations (platform-wide: tenantId IS NULL)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);

    try {
        const automations = await db.select()
            .from(marketingAutomations)
            .where(isNull(marketingAutomations.tenantId))
            .orderBy(desc(marketingAutomations.createdAt))
            .all();

        return c.json(automations);
    } catch (e: any) {
        console.error('Failed to fetch automations:', e);
        return c.json({ error: e.message }, 500);
    }
});

// POST / - Create a new platform automation
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();

    try {
        const id = crypto.randomUUID();
        await db.insert(marketingAutomations).values({
            id,
            tenantId: null, // Platform-wide
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

// PATCH /:id - Update automation
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
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
            .where(and(eq(marketingAutomations.id, id), isNull(marketingAutomations.tenantId)))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to update automation:', e);
        return c.json({ error: e.message }, 400);
    }
});

// DELETE /:id - Delete automation
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    try {
        await db.delete(marketingAutomations)
            .where(and(eq(marketingAutomations.id, id), isNull(marketingAutomations.tenantId)))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Failed to delete automation:', e);
        return c.json({ error: e.message }, 400);
    }
});

// POST /:id/test - Send test email
app.post('/:id/test', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const { email } = await c.req.json();

    if (!email) return c.json({ error: 'Email required' }, 400);
    if (!c.env.RESEND_API_KEY) return c.json({ error: 'Email not configured' }, 500);

    try {
        const automation = await db.query.marketingAutomations.findFirst({
            where: eq(marketingAutomations.id, id)
        });

        if (!automation) return c.json({ error: 'Not found' }, 404);

        const { Resend } = await import('resend');
        const resend = new Resend(c.env.RESEND_API_KEY);

        await resend.emails.send({
            from: 'Platform <noreply@' + ((c.env as any).DOMAIN || 'platform.com') + '>',
            to: email,
            subject: `[TEST] ${automation.subject}`,
            html: automation.content || '<p>Test email content</p>'
        });

        return c.json({ success: true, sentTo: email });
    } catch (e: any) {
        console.error('Failed to send test email:', e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
