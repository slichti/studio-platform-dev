
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

// GET /credentials - Get integration status
app.get('/credentials', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);

    return c.json({
        twilio: {
            configured: !!(tenant.twilioCredentials as any)?.accountSid,
            accountSid: (tenant.twilioCredentials as any)?.accountSid ?
                `...${(tenant.twilioCredentials as any).accountSid.slice(-4)}` : null,
            fromNumber: (tenant.twilioCredentials as any)?.fromNumber
        },
        resend: {
            configured: !!(tenant.resendCredentials as any)?.apiKey,
            apiKey: (tenant.resendCredentials as any)?.apiKey ?
                `...${(tenant.resendCredentials as any).apiKey.slice(-4)}` : null
        },
        flodesk: {
            configured: !!(tenant.flodeskCredentials as any)?.apiKey,
            apiKey: (tenant.flodeskCredentials as any)?.apiKey ?
                `...${(tenant.flodeskCredentials as any).apiKey.slice(-4)}` : null
        }
    });
});

// PATCH /credentials - Update credentials
app.patch('/credentials', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) return c.json({ error: "Tenant context required" }, 400);

    const { twilio, resend, flodesk } = await c.req.json();

    const updateData: any = {};

    if (twilio) {
        // Merge with existing logic if partial updates needed, but simpler to replace for security fields
        // But if user sends ONLY fromNumber, we should keep SID? 
        // Let's implement MERGE logic.
        const existing = (tenant.twilioCredentials as any) || {};
        // Filter out empty strings/nulls from input
        const cleanTwilio = Object.fromEntries(
            Object.entries(twilio).filter(([_, v]) => v !== undefined && v !== '')
        );
        updateData.twilioCredentials = { ...existing, ...cleanTwilio };
    }

    if (resend) {
        const existing = (tenant.resendCredentials as any) || {};
        const cleanResend = Object.fromEntries(
            Object.entries(resend).filter(([_, v]) => v !== undefined && v !== '')
        );
        updateData.resendCredentials = { ...existing, ...cleanResend };
    }

    if (flodesk) {
        const existing = (tenant.flodeskCredentials as any) || {};
        const cleanFlodesk = Object.fromEntries(
            Object.entries(flodesk).filter(([_, v]) => v !== undefined && v !== '')
        );
        updateData.flodeskCredentials = { ...existing, ...cleanFlodesk };
    }

    if (Object.keys(updateData).length > 0) {
        await db.update(tenants)
            .set(updateData)
            .where(eq(tenants.id, tenant.id))
            .run();
    }

    return c.json({ success: true });
});

export default app;
