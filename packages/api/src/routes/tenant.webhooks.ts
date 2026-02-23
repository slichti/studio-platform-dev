
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { webhookLogs, webhookEndpoints, tenants } from '@studio/db/src/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { WebhookService } from '../services/webhooks';
import { Svix } from 'svix';

const app = createOpenAPIApp<StudioVariables>();

// Schemas
const WebhookLogSchema = z.object({
    id: z.string(),
    eventType: z.string(),
    statusCode: z.number().nullable(),
    durationMs: z.number().nullable(),
    createdAt: z.string(),
    payload: z.any().nullable(),
    responseBody: z.string().nullable(),
    error: z.string().nullable()
}).openapi('WebhookLog');

const WebhookEndpointSchema = z.object({
    id: z.string(),
    url: z.string(),
    description: z.string().nullable(),
    events: z.array(z.string()), // JSON array
    isActive: z.boolean(),
    createdAt: z.string()
}).openapi('WebhookEndpoint');

const ErrorSchema = z.object({ error: z.string() });

// Routes

// GET /logs - List Logs (optional ?endpointId= for recent attempts per endpoint)
app.openapi(createRoute({
    method: 'get',
    path: '/logs',
    tags: ['Admin Webhooks'],
    summary: 'List Webhook Logs',
    request: {
        query: z.object({
            limit: z.string().optional().default('50'),
            offset: z.string().optional().default('0'),
            endpointId: z.string().optional()
        })
    },
    responses: {
        200: {
            description: 'Webhook Logs',
            content: { 'application/json': { schema: z.array(WebhookLogSchema) } }
        },
        403: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    if (!c.get('can')('view_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenantId = c.get('tenant').id;
    const db = createDb(c.env.DB);
    const { limit, offset, endpointId } = c.req.valid('query');

    const conditions = endpointId
        ? and(eq(webhookLogs.tenantId, tenantId), eq(webhookLogs.endpointId, endpointId))
        : eq(webhookLogs.tenantId, tenantId);

    const logs = await db.select()
        .from(webhookLogs)
        .where(conditions)
        .orderBy(desc(webhookLogs.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset))
        .all();

    return c.json(logs.map(l => ({
        ...l,
        createdAt: l.createdAt ? l.createdAt.toISOString() : new Date().toISOString()
    })), 200);
});

// POST /test - Trigger Test Event
app.openapi(createRoute({
    method: 'post',
    path: '/test',
    tags: ['Admin Webhooks'],
    summary: 'Trigger Test Webhook',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        eventType: z.string().default('ping'),
                        payload: z.record(z.string(), z.any()).optional()
                    })
                }
            }
        }
    },
    responses: {
        200: { description: 'Test Event Triggered', content: { 'application/json': { schema: z.object({ success: z.boolean() }) } } },
        403: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenantId = c.get('tenant').id;
    const db = createDb(c.env.DB);
    const { eventType, payload } = c.req.valid('json');

    const service = new WebhookService(db, c.env.SVIX_AUTH_TOKEN as string);

    const testPayload = payload || { message: 'Hello World', timestamp: new Date().toISOString() };
    await service.dispatch(tenantId, eventType, testPayload);

    // Log test attempt so it appears in "recent attempts" (GET /logs)
    const endpoints = await db.select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.isActive, true)))
        .all();
    const targets = endpoints.filter(ep => {
        const events = ep.events as unknown as string[];
        return Array.isArray(events) && (events.includes(eventType) || events.includes('*'));
    });
    for (const ep of targets) {
        await db.insert(webhookLogs).values({
            id: crypto.randomUUID(),
            tenantId,
            endpointId: ep.id,
            eventType,
            payload: testPayload,
            statusCode: null,
            responseBody: 'Test event dispatched (Svix or platform)',
            error: null,
            createdAt: new Date()
        }).run();
    }

    return c.json({ success: true }, 200);
});

// GET /portal - Svix Consumer Portal SSO
app.openapi(createRoute({
    method: 'get',
    path: '/portal',
    tags: ['Admin Webhooks'],
    summary: 'Get Svix Portal SSO URL',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ url: z.string() }) } }, description: 'SSO URL' },
        403: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
        500: { description: 'Error', content: { 'application/json': { schema: ErrorSchema } } }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenantId = c.get('tenant').id;
    const svixToken = c.env.SVIX_AUTH_TOKEN as string;

    if (!svixToken) return c.json({ error: 'Webhooks not configured' }, 500);

    try {
        const svix = new Svix(svixToken);
        const portalResponse = await svix.authentication.appPortalAccess(tenantId, {});
        return c.json({ url: portalResponse.url }, 200);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /endpoints - List Endpoints
app.openapi(createRoute({
    method: 'get',
    path: '/endpoints',
    tags: ['Admin Webhooks'],
    summary: 'List Webhook Endpoints',
    responses: {
        200: { content: { 'application/json': { schema: z.array(WebhookEndpointSchema) } }, description: 'Endpoints' },
        403: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    if (!c.get('can')('view_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenantId = c.get('tenant').id;
    const db = createDb(c.env.DB);

    const eps = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.tenantId, tenantId)).all();
    return c.json(eps.map(e => ({
        ...e,
        createdAt: e.createdAt ? e.createdAt.toISOString() : '',
        events: Array.isArray(e.events) ? e.events : []
    })), 200);
});

// POST /endpoints - Create Endpoint
app.openapi(createRoute({
    method: 'post',
    path: '/endpoints',
    tags: ['Admin Webhooks'],
    summary: 'Create Webhook Endpoint',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        url: z.string().url(),
                        description: z.string().optional(),
                        events: z.array(z.string()).min(1),
                        secret: z.string().optional() // Auto-generate if missing
                    })
                }
            }
        }
    },
    responses: {
        200: { description: 'Created', content: { 'application/json': { schema: z.object({ id: z.string() }) } } },
        403: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenantId = c.get('tenant').id;
    const db = createDb(c.env.DB);
    const body = c.req.valid('json');

    const id = crypto.randomUUID();
    const secret = body.secret || crypto.randomUUID().replace(/-/g, '');

    await db.insert(webhookEndpoints).values({
        id,
        tenantId,
        url: body.url,
        description: body.description,
        events: body.events,
        secret,
        isActive: true,
        createdAt: new Date()
    }).run();

    return c.json({ id }, 200);
});

// DELETE /endpoints/:id
app.openapi(createRoute({
    method: 'delete',
    path: '/endpoints/:id',
    tags: ['Admin Webhooks'],
    summary: 'Delete Webhook Endpoint',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { description: 'Deleted', content: { 'application/json': { schema: z.object({ success: z.boolean() }) } } },
        403: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenantId = c.get('tenant').id;
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    await db.delete(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)))
        .run();

    return c.json({ success: true }, 200);
});

export default app;
