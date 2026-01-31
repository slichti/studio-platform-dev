import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '../db';
import * as schema from '@studio/db/src/schema'; // Import all schema
import { eq, and, desc } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new OpenAPIHono<HonoContext>();

// --- Schemas ---

const WebhookEndpointSchema = z.object({
    id: z.string(),
    url: z.string().url(),
    events: z.array(z.string()),
    description: z.string().optional(),
    isActive: z.boolean(),
    secret: z.string(),
    createdAt: z.string().or(z.date()),
    lastFailureAt: z.string().or(z.date()).optional().nullable()
}).openapi('WebhookEndpoint');

const WebhookLogSchema = z.object({
    id: z.string(),
    event: z.string(),
    statusCode: z.number(),
    payload: z.any(),
    response: z.string().optional().nullable(),
    createdAt: z.string().or(z.date())
}).openapi('WebhookLog');

const CredentialsSchema = z.object({
    twilio: z.object({
        configured: z.boolean(),
        fromNumber: z.string().optional()
    }),
    resend: z.object({ configured: z.boolean() }),
    flodesk: z.object({ configured: z.boolean() })
});

const ErrorResponse = z.object({ error: z.string() });

// --- Routes ---

// GET /webhooks
const listWebhooksRoute = createRoute({
    method: 'get',
    path: '/webhooks',
    tags: ['Integrations'],
    summary: 'List webhook endpoints',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ endpoints: z.array(WebhookEndpointSchema) }) } }, description: 'List of endpoints' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' }
    }
});

app.openapi(listWebhooksRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    const global = await db.query.platformConfig.findFirst({ where: eq(schema.platformConfig.key, 'feature_webhooks') });
    if (!global?.enabled) return c.json({ error: "Disabled globally" }, 403);

    const list = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.tenantId, tenant.id)).all();
    return c.json({
        endpoints: list.map(e => ({
            ...e,
            events: e.events as string[],
            createdAt: e.createdAt || new Date().toISOString(),
            updatedAt: e.updatedAt || null,
            description: e.description || undefined
        }))
    }, 200);
});

// POST /webhooks
const createWebhookRoute = createRoute({
    method: 'post',
    path: '/webhooks',
    tags: ['Integrations'],
    summary: 'Create webhook endpoint',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        url: z.string().url(),
                        events: z.array(z.string()),
                        description: z.string().optional()
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), id: z.string(), secret: z.string() }) } }, description: 'Created' },
        400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Bad Request' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' }
    }
});

app.openapi(createWebhookRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { url, events, description } = c.req.valid('json');

    const id = crypto.randomUUID();
    const secret = crypto.randomUUID().replace(/-/g, '');
    await db.insert(schema.webhookEndpoints).values({ id, tenantId: c.get('tenant')!.id, url, secret, events, description, isActive: true, createdAt: new Date() }).run();
    return c.json({ success: true, id, secret }, 200);
});

// PATCH /webhooks/:id
const updateWebhookRoute = createRoute({
    method: 'patch',
    path: '/webhooks/{id}',
    tags: ['Integrations'],
    summary: 'Update webhook endpoint',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        url: z.string().url().optional(),
                        events: z.array(z.string()).optional(),
                        isActive: z.boolean().optional()
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Updated' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' }
    }
});

app.openapi(updateWebhookRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const body = c.req.valid('json');
    const up: any = { updatedAt: new Date() };
    if (body.url !== undefined) up.url = body.url;
    if (body.events !== undefined) up.events = body.events;
    if (body.isActive !== undefined) up.isActive = body.isActive;

    await db.update(schema.webhookEndpoints).set(up).where(and(eq(schema.webhookEndpoints.id, c.req.valid('param').id), eq(schema.webhookEndpoints.tenantId, c.get('tenant')!.id))).run();
    return c.json({ success: true }, 200);
});

// GET /webhooks/:id/logs
const listWebhookLogsRoute = createRoute({
    method: 'get',
    path: '/webhooks/{id}/logs',
    tags: ['Integrations'],
    summary: 'Get logs for a webhook endpoint',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ logs: z.array(WebhookLogSchema) }) } }, description: 'Logs' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Not found' }
    }
});

app.openapi(listWebhookLogsRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const endpointId = c.req.valid('param').id;

    // Verify ownership
    const ep = await db.query.webhookEndpoints.findFirst({
        where: and(eq(schema.webhookEndpoints.id, endpointId), eq(schema.webhookEndpoints.tenantId, c.get('tenant')!.id))
    });
    if (!ep) return c.json({ error: "Not found" }, 404);

    const logs = await db.query.webhookLogs.findMany({
        where: eq(schema.webhookLogs.endpointId, endpointId),
        orderBy: [desc(schema.webhookLogs.createdAt)],
        limit: 50
    });

    return c.json({ logs: logs as any }, 200); // Cast to any or fix Schema mismatch with Drizzle result
});

// POST /webhooks/:id/test
const testWebhookRoute = createRoute({
    method: 'post',
    path: '/webhooks/{id}/test',
    tags: ['Integrations'],
    summary: 'Send test event to webhook',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), statusCode: z.number(), responseBody: z.string().optional() }) } }, description: 'Test sent' },
        400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Failed to send' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' },
        404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Not found' }
    }
});

app.openapi(testWebhookRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const endpointId = c.req.valid('param').id;

    const ep = await db.query.webhookEndpoints.findFirst({
        where: and(eq(schema.webhookEndpoints.id, endpointId), eq(schema.webhookEndpoints.tenantId, c.get('tenant')!.id))
    });
    if (!ep) return c.json({ error: "Not found" }, 404);

    // Send Test Request
    try {
        const payload = {
            id: 'evt_test_' + crypto.randomUUID(),
            type: 'test.ping',
            createdAt: new Date().toISOString(),
            data: { message: "This is a test event from Studio Platform." }
        };

        const signature = "sha256=" + await crypto.subtle.importKey("raw", new TextEncoder().encode(ep.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]).then(key => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(payload)))).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));

        const res = await fetch(ep.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Studio-Signature': signature,
                'X-Studio-Event-Id': payload.id
            },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();

        // Log the test
        await db.insert(schema.webhookLogs).values({
            id: crypto.randomUUID(),
            tenantId: c.get('tenant')!.id,
            endpointId: ep.id,
            eventType: 'test.ping',
            payload: payload,
            statusCode: res.status,
            responseBody: responseText.substring(0, 1000), // Truncate
            createdAt: new Date()
        }).run();

        return c.json({ success: true, statusCode: res.status, responseBody: responseText }, 200);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// GET /credentials
const getCredentialsRoute = createRoute({
    method: 'get',
    path: '/credentials',
    tags: ['Integrations'],
    summary: 'Get integration credentials status',
    responses: {
        200: { content: { 'application/json': { schema: CredentialsSchema } }, description: 'Credentials status' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' }
    }
});

app.openapi(getCredentialsRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const t = c.get('tenant')!;
    return c.json({
        twilio: { configured: !!(t.twilioCredentials as any)?.accountSid, fromNumber: (t.twilioCredentials as any)?.fromNumber },
        resend: { configured: !!(t.resendCredentials as any)?.apiKey },
        flodesk: { configured: !!(t.flodeskCredentials as any)?.apiKey }
    }, 200);
});

// PATCH /credentials
const updateCredentialsRoute = createRoute({
    method: 'patch',
    path: '/credentials',
    tags: ['Integrations'],
    summary: 'Update integration credentials',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        twilio: z.any().optional(),
                        resend: z.any().optional(),
                        flodesk: z.any().optional()
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Updated' },
        403: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unauthorized' }
    }
});

app.openapi(updateCredentialsRoute, async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const t = c.get('tenant')!;
    const body = c.req.valid('json');
    const up: any = {};

    if (body.twilio) up.twilioCredentials = { ...(t.twilioCredentials as any || {}), ...body.twilio };
    if (body.resend) up.resendCredentials = { ...(t.resendCredentials as any || {}), ...body.resend };
    if (body.flodesk) up.flodeskCredentials = { ...(t.flodeskCredentials as any || {}), ...body.flodesk };

    if (Object.keys(up).length) await db.update(schema.tenants).set(up).where(eq(schema.tenants.id, t.id)).run();
    return c.json({ success: true }, 200);
});

export default app;
