import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { tags, tagAssignments } from '@studio/db/src/schema';
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
        const returnedTags = await db.select().from(tags).where(eq(tags.tenantId, tenant.id)).all();
        return c.json(returnedTags);
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
        await db.insert(tags).values({
            id,
            tenantId: tenant.id,
            name,
            color: color || null,
            description: description || null
        }).run();

        const tag = await db.select().from(tags).where(eq(tags.id, id)).get();
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

        await db.update(tags)
            .set({
                name,
                color: color || null,
                description: description || null
            })
            .where(and(eq(tags.id, id), eq(tags.tenantId, tenant.id)))
            .run();

        const tag = await db.select().from(tags).where(eq(tags.id, id)).get();
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

        await db.delete(tags)
            .where(and(eq(tags.id, id), eq(tags.tenantId, tenant.id)))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Delete Tag Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

// Assignments
const assignTagRoute = createRoute({
    method: 'post',
    path: '/assign',
    tags: ['Tags'],
    summary: 'Assign a tag to an entity',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        tagId: z.string(),
                        targetId: z.string(),
                        targetType: z.enum(['member', 'lead']).default('member'),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean() }),
                },
            },
            description: 'Tag assigned',
        },
        500: { description: 'Internal Server Error' },
    },
});

app.openapi(assignTagRoute, async (c) => {
    try {
        const db = createDb(c.env.DB);
        const { tagId, targetId, targetType } = c.req.valid('json');

        await db.insert(tagAssignments).values({
            id: crypto.randomUUID(),
            tagId,
            targetId,
            targetType,
        }).run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

const unassignTagRoute = createRoute({
    method: 'post',
    path: '/unassign',
    tags: ['Tags'],
    summary: 'Unassign a tag from an entity',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        tagId: z.string(),
                        targetId: z.string(),
                        targetType: z.enum(['member', 'lead']).default('member'),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean() }),
                },
            },
            description: 'Tag unassigned',
        },
        500: { description: 'Internal Server Error' },
    },
});

app.openapi(unassignTagRoute, async (c) => {
    try {
        const db = createDb(c.env.DB);
        const { tagId, targetId, targetType } = c.req.valid('json');

        await db.delete(tagAssignments)
            .where(and(
                eq(tagAssignments.tagId, tagId),
                eq(tagAssignments.targetId, targetId),
                eq(tagAssignments.targetType, targetType)
            ))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

const listAssignmentsRoute = createRoute({
    method: 'get',
    path: '/assignments/:targetId',
    tags: ['Tags'],
    summary: 'List tags assigned to an entity',
    request: {
        params: z.object({ targetId: z.string() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(TagSchema),
                },
            },
            description: 'List of tags',
        },
    },
});

app.openapi(listAssignmentsRoute, async (c) => {
    const db = createDb(c.env.DB);
    const { targetId } = c.req.valid('param');

    const result = await db.select({
        id: tags.id,
        tenantId: tags.tenantId,
        name: tags.name,
        color: tags.color,
        description: tags.description,
    })
        .from(tags)
        .innerJoin(tagAssignments, eq(tags.id, tagAssignments.tagId))
        .where(eq(tagAssignments.targetId, targetId))
        .all();

    return c.json(result);
});

export default app;
