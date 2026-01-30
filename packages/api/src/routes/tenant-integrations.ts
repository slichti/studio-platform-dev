import { Hono } from 'hono';
import { createDb } from '../db';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /webhooks
app.get('/webhooks', async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    const global = await db.query.platformConfig.findFirst({ where: eq(schema.platformConfig.key, 'feature_webhooks') });
    if (!global?.enabled) return c.json({ error: "Disabled globally" }, 403);

    const list = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.tenantId, tenant.id)).all();
    return c.json({ endpoints: list });
});

// POST /webhooks
app.post('/webhooks', async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { url, events, description } = await c.req.json();
    if (!url || !events) return c.json({ error: "Missing fields" }, 400);

    const id = crypto.randomUUID();
    const secret = crypto.randomUUID().replace(/-/g, '');
    await db.insert(schema.webhookEndpoints).values({ id, tenantId: c.get('tenant')!.id, url, secret, events, description, isActive: true, createdAt: new Date() }).run();
    return c.json({ success: true, id, secret });
});

// PATCH /webhooks/:id
app.patch('/webhooks/:id', async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const up: any = { updatedAt: new Date() };
    if (body.url !== undefined) up.url = body.url;
    if (body.events !== undefined) up.events = body.events;
    if (body.isActive !== undefined) up.isActive = body.isActive;

    await db.update(schema.webhookEndpoints).set(up).where(and(eq(schema.webhookEndpoints.id, c.req.param('id')), eq(schema.webhookEndpoints.tenantId, c.get('tenant')!.id))).run();
    return c.json({ success: true });
});

// GET /credentials
app.get('/credentials', async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const t = c.get('tenant')!;
    return c.json({
        twilio: { configured: !!(t.twilioCredentials as any)?.accountSid, fromNumber: (t.twilioCredentials as any)?.fromNumber },
        resend: { configured: !!(t.resendCredentials as any)?.apiKey },
        flodesk: { configured: !!(t.flodeskCredentials as any)?.apiKey }
    });
});

// PATCH /credentials
app.patch('/credentials', async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const t = c.get('tenant')!;
    const body = await c.req.json();
    const up: any = {};

    if (body.twilio) up.twilioCredentials = { ...(t.twilioCredentials as any || {}), ...body.twilio };
    if (body.resend) up.resendCredentials = { ...(t.resendCredentials as any || {}), ...body.resend };
    if (body.flodesk) up.flodeskCredentials = { ...(t.flodeskCredentials as any || {}), ...body.flodesk };

    if (Object.keys(up).length) await db.update(schema.tenants).set(up).where(eq(schema.tenants.id, t.id)).run();
    return c.json({ success: true });
});

export default app;
