import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '../db';
import { memberTags } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { Bindings, Variables } from '..';

const app = new OpenAPIHono<{ Bindings: Bindings, Variables: Variables }>();

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
    },
});

app.openapi(listTagsRoute, async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const tags = await db.select().from(memberTags).where(eq(memberTags.tenantId, tenant.id)).all();
    return c.json(tags);
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
    },
});

app.openapi(createTagRoute, async (c) => {
    const tenant = c.get('tenant');
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
    },
});

app.openapi(updateTagRoute, async (c) => {
    const tenant = c.get('tenant');
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
    },
});

app.openapi(deleteTagRoute, async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { id } = c.req.valid('param');

    await db.delete(memberTags)
        .where(and(eq(memberTags.id, id), eq(memberTags.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
