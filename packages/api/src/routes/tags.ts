import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { memberTags } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { Bindings, Variables } from '../types';

const app = createOpenAPIApp();

// Schemas
const TagSchema = z.object({
    id: z.string().openapi({ example: 'tag_123' }),
    tenantId: z.string().openapi({ example: 'tenant_123' }),
    name: z.string().min(1).openapi({ example: 'VIP' }),
    color: z.string().nullable().openapi({ example: '#ff0000' }),
    description: z.string().nullable().openapi({ example: 'Very Important Person' }),
});

const CreateTagSchema = z.object({
    name: z.string().min(1),
    color: z.string().optional(),
    description: z.string().optional(),
});

const UpdateTagSchema = CreateTagSchema.partial();

// Routes
const listTagsRoute = createRoute({
    method: 'get',
    path: '/',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(TagSchema),
                },
            },
            description: 'List all tags',
        },
        500: {
            description: 'Internal Server Error',
        },
    },
});

app.openapi(listTagsRoute, async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const db = createDb(c.env.DB);
        const tags = await db.select().from(memberTags).where(eq(memberTags.tenantId, tenant.id)).all();
        return c.json(tags);
    } catch (e: any) {
        console.error('List Tags Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

const createTagRoute = createRoute({
    method: 'post',
    path: '/',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateTagSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: TagSchema,
                },
            },
            description: 'Create a tag',
        },
        500: {
            description: 'Internal Server Error',
        },
    },
});

app.openapi(createTagRoute, async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const db = createDb(c.env.DB);
        const { name, color, description } = c.req.valid('json');

        const id = crypto.randomUUID();
        await db.insert(memberTags).values({
            id,
            tenantId: tenant.id,
            name,
            color: color || null,
            description: description || null
        }).run();

        const tag = await db.select().from(memberTags).where(eq(memberTags.id, id)).get();
        if (!tag) throw new Error('Failed to create tag');
        return c.json(tag);
    } catch (e: any) {
        console.error('Create Tag Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

const updateTagRoute = createRoute({
    method: 'put',
    path: '/:id',
    request: {
        params: z.object({
            id: z.string(),
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateTagSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: TagSchema,
                },
            },
            description: 'Update a tag',
        },
        404: {
            description: 'Tag not found',
        },
        500: {
            description: 'Internal Server Error',
        },
    },
});

app.openapi(updateTagRoute, async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const db = createDb(c.env.DB);
        const { id } = c.req.valid('param');
        const { name, color, description } = c.req.valid('json');

        await db.update(memberTags)
            .set({
                name,
                color: color || null,
                description: description || null
            })
            .where(and(eq(memberTags.id, id), eq(memberTags.tenantId, tenant.id)))
            .run();

        const tag = await db.select().from(memberTags).where(eq(memberTags.id, id)).get();
        if (!tag) return c.json({ error: 'Tag not found' } as any, 404);
        return c.json(tag);
    } catch (e: any) {
        console.error('Update Tag Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

const deleteTagRoute = createRoute({
    method: 'delete',
    path: '/:id',
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean() }),
                },
            },
            description: 'Delete a tag',
        },
        500: {
            description: 'Internal Server Error',
        },
    },
});

app.openapi(deleteTagRoute, async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const db = createDb(c.env.DB);
        const { id } = c.req.valid('param');

        await db.delete(memberTags)
            .where(and(eq(memberTags.id, id), eq(memberTags.tenantId, tenant.id)))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Delete Tag Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

export default app;
