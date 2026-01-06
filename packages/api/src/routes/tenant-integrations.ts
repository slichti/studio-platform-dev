
import { Hono } from 'hono';
import { createDb } from '../db';
import { webhookEndpoints, tenants } from 'db/src/schema'; // Ensure imports
import { eq, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    auth: { userId: string };
    roles: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /webhooks - List endpoints
app.get('/webhooks', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) return c.json({ error: "Tenant context required" }, 400);

    const endpoints = await db.select().from(webhookEndpoints).where(
        and(eq(webhookEndpoints.tenantId, tenant.id))
    ).all();

    return c.json({ endpoints });
});

// POST /webhooks - Create endpoint
app.post('/webhooks', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { url, events, description } = await c.req.json();

    if (!tenant) return c.json({ error: "Tenant context required" }, 400);
    if (!url || !events) return c.json({ error: "URL and Events required" }, 400);

    const secret = crypto.randomUUID().replace(/-/g, ''); // Simple 32-char hex-like
    const id = crypto.randomUUID();

    await db.insert(webhookEndpoints).values({
        id,
        tenantId: tenant.id,
        url,
        secret,
        events: events, // DB schema handles json mode
        description,
        isActive: true,
        createdAt: new Date()
    } as any).run();

    return c.json({ success: true, id, secret, endpoint: { id, url, events, description, secret } });
});

// DELETE /webhooks/:id
app.delete('/webhooks/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

    if (!tenant) return c.json({ error: "Tenant context required" }, 400);

    await db.delete(webhookEndpoints).where(
        and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenant.id))
    ).run();

    return c.json({ success: true });
});

export default app;
