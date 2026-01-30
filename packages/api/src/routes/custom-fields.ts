import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '../db';
import { customFieldDefinitions } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { Bindings, Variables } from '..';

const app = new OpenAPIHono<{ Bindings: Bindings, Variables: Variables }>();

// Schemas
const CustomFieldSchema = z.object({
    id: z.string().openapi({ example: 'field_123' }),
    tenantId: z.string().openapi({ example: 'tenant_123' }),
    entityType: z.enum(['member', 'lead', 'class']).openapi({ example: 'member' }),
    key: z.string().openapi({ example: 't_shirt_size' }),
    label: z.string().openapi({ example: 'T-Shirt Size' }),
    fieldType: z.enum(['text', 'number', 'boolean', 'date', 'select']).openapi({ example: 'select' }),
    options: z.array(z.string()).nullable().openapi({ example: ['S', 'M', 'L'] }),
    isRequired: z.boolean().default(false),
    isActive: z.boolean().default(true),
});

const CreateCustomFieldSchema = z.object({
    entityType: z.enum(['member', 'lead', 'class']),
    key: z.string().min(1).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1),
    fieldType: z.enum(['text', 'number', 'boolean', 'date', 'select']),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().optional(),
});

const UpdateCustomFieldSchema = z.object({
    label: z.string().min(1).optional(),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().optional(),
    isActive: z.boolean().optional(),
});

// Routes
const listFieldsRoute = createRoute({
    method: 'get',
    path: '/',
    request: {
        query: z.object({
            entityType: z.enum(['member', 'lead', 'class']).optional(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(CustomFieldSchema),
                },
            },
            description: 'List custom fields',
        },
    },
});

app.openapi(listFieldsRoute, async (c) => {
    const tenant = c.get('tenant');
    const { entityType } = c.req.valid('query');
    const db = createDb(c.env.DB);

    let conditions = [eq(customFieldDefinitions.tenantId, tenant.id)];
    if (entityType) {
        conditions.push(eq(customFieldDefinitions.entityType, entityType));
    }

    const fields = await db.select()
        .from(customFieldDefinitions)
        .where(and(...conditions))
        .all();

    // Cast options from JSON string if necessary (Drizzle handles this usually)
    // But strict Zod might complain if DB returns null for options and we expect array
    // Let's ensure types match
    return c.json(fields as any);
});

const createFieldRoute = createRoute({
    method: 'post',
    path: '/',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateCustomFieldSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CustomFieldSchema,
                },
            },
            description: 'Create a custom field',
        },
    },
});

app.openapi(createFieldRoute, async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const body = c.req.valid('json');

    const id = crypto.randomUUID();
    const newField = {
        id,
        tenantId: tenant.id,
        entityType: body.entityType,
        key: body.key,
        label: body.label,
        fieldType: body.fieldType,
        options: body.options ? JSON.stringify(body.options) : null,
        isRequired: body.isRequired || false,
        isActive: true,
        createdAt: new Date()
    };

    await db.insert(customFieldDefinitions).values(newField).run();

    const field = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).get();
    if (!field) throw new Error("Failed to create field");
    return c.json(field as any);
});

const updateFieldRoute = createRoute({
    method: 'put',
    path: '/:id',
    request: {
        params: z.object({
            id: z.string(),
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateCustomFieldSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CustomFieldSchema,
                },
            },
            description: 'Update a custom field',
        },
        404: {
            description: 'Custom field not found',
        },
    },
});

app.openapi(updateFieldRoute, async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    await db.update(customFieldDefinitions)
        .set(body)
        .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, tenant.id)))
        .run();

    const field = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).get();
    if (!field) return c.json({ error: 'Field not found' } as any, 404);
    return c.json(field as any);
});

const deleteFieldRoute = createRoute({
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
            description: 'Delete a custom field',
        },
    },
});

app.openapi(deleteFieldRoute, async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { id } = c.req.valid('param');

    await db.delete(customFieldDefinitions)
        .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
