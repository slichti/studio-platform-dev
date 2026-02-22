
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { ApiKeyService } from '../services/api-keys';

const app = createOpenAPIApp<StudioVariables>();

const ApiKeySchema = z.object({
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    lastUsedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string()
}).openapi('ApiKey');

const CreateKeyInputSchema = z.object({
    name: z.string().min(1).max(50),
    expiresAt: z.string().datetime().optional()
}).openapi('CreateKeyInput');

const ErrorSchema = z.object({ error: z.string() });

// GET / - List keys
app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin API Keys'],
    summary: 'List API Keys',
    responses: {
        200: { content: { 'application/json': { schema: z.array(ApiKeySchema) } }, description: 'List of keys' },
        403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const service = new ApiKeyService(db, tenant.id);
    const keys = await service.listKeys();

    return c.json(keys.map(k => ({
        ...k,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
        createdAt: k.createdAt ? k.createdAt.toISOString() : new Date().toISOString()
    })), 200);
});

// POST / - Create key
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin API Keys'],
    summary: 'Create API Key',
    request: {
        body: { content: { 'application/json': { schema: CreateKeyInputSchema } } }
    },
    responses: {
        201: { content: { 'application/json': { schema: z.object({ id: z.string(), key: z.string() }) } }, description: 'Key created' },
        403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { name, expiresAt } = c.req.valid('json');
    const service = new ApiKeyService(db, tenant.id);
    const result = await service.createKey(name, expiresAt ? new Date(expiresAt) : undefined);
    return c.json(result, 201);
});

// DELETE /:id - Revoke key
app.openapi(createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Admin API Keys'],
    summary: 'Revoke API Key',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Key revoked' },
        403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const service = new ApiKeyService(db, tenant.id);
    await service.revokeKey(id);
    return c.json({ success: true }, 200);
});

export default app;
