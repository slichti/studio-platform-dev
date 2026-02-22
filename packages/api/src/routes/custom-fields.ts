import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { customFieldDefinitions, customFieldValues } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';

const app = createOpenAPIApp<StudioVariables>();

// Schema Definition
const CustomFieldDefSchema = z.object({
    id: z.string().openapi({ example: 'cf_123' }),
    targetType: z.enum(['member', 'lead', 'class']).default('member'),
    key: z.string().min(1).openapi({ example: 'tshirt_size' }),
    label: z.string().min(1).openapi({ example: 'T-Shirt Size' }),
    fieldType: z.enum(['text', 'number', 'date', 'select', 'boolean']).default('text'),
    options: z.array(z.string()).nullable().openapi({ example: ['S', 'M', 'L'] }),
    isRequired: z.boolean().default(false),
    isActive: z.boolean().default(true),
}).openapi('CustomFieldDefinition');

const CustomFieldListSchema = z.array(CustomFieldDefSchema);

const CustomFieldValueSchema = z.object({
    id: z.string().openapi({ example: 'cfv_123' }),
    definitionId: z.string().openapi({ example: 'cf_123' }),
    targetId: z.string().openapi({ example: 'member_123' }),
    value: z.string().nullable().openapi({ example: 'Large' }),
}).openapi('CustomFieldValue');

// GET / - List Definitions for Tenant
app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Custom Fields'],
    summary: 'Get Custom Field Definitions',
    responses: {
        200: {
            description: 'List of field definitions',
            content: { 'application/json': { schema: CustomFieldListSchema } }
        },
        500: { description: 'Internal Server Error' }
    }
}), async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const db = createDb(c.env.DB);
        const defs = await db.select()
            .from(customFieldDefinitions)
            .where(and(
                eq(customFieldDefinitions.tenantId, tenant.id),
                eq(customFieldDefinitions.isActive, true)
            ))
            .all();

        return c.json(defs as any[]);
    } catch (e: any) {
        console.error('List Custom Fields Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

// POST / - Create New Field definition
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Custom Fields'],
    summary: 'Create Custom Field Definition',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CustomFieldDefSchema.omit({ id: true })
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Created field definition',
            content: { 'application/json': { schema: CustomFieldDefSchema } }
        },
        500: { description: 'Internal Server Error' }
    }
}), async (c) => {
    try {
        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');
        if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);

        const body = c.req.valid('json');
        const id = crypto.randomUUID();

        await db.insert(customFieldDefinitions).values({
            id,
            tenantId: tenant.id,
            ...body
        }).run();

        const def = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).get();
        return c.json(def as any, 201);
    } catch (e: any) {
        console.error('Create Custom Field Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

// GET /values/:targetId - Get all values for a member/lead/class
app.openapi(createRoute({
    method: 'get',
    path: '/values/:targetId',
    tags: ['Custom Fields'],
    summary: 'Get Custom Field Values for a Target',
    request: {
        params: z.object({ targetId: z.string() })
    },
    responses: {
        200: {
            description: 'List of field values',
            content: { 'application/json': { schema: z.array(CustomFieldValueSchema) } }
        }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const { targetId } = c.req.valid('param');
    const values = await db.select().from(customFieldValues).where(eq(customFieldValues.targetId, targetId)).all();
    return c.json(values as any[]);
});

// POST /values - Upsert field values
app.openapi(createRoute({
    method: 'post',
    path: '/values',
    tags: ['Custom Fields'],
    summary: 'Upsert Custom Field Values',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.array(z.object({
                        definitionId: z.string(),
                        targetId: z.string(),
                        value: z.string().nullable()
                    }))
                }
            }
        }
    },
    responses: {
        200: { description: 'Success' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) throw new Error('Tenant context missing');
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const body = c.req.valid('json');

    for (const item of body) {
        const existing = await db.select().from(customFieldValues).where(and(
            eq(customFieldValues.definitionId, item.definitionId),
            eq(customFieldValues.targetId, item.targetId)
        )).get();

        if (existing) {
            await db.update(customFieldValues)
                .set({ value: item.value, updatedAt: new Date() })
                .where(eq(customFieldValues.id, existing.id))
                .run();
        } else {
            await db.insert(customFieldValues).values({
                id: crypto.randomUUID(),
                tenantId: tenant.id,
                definitionId: item.definitionId,
                targetId: item.targetId,
                value: item.value
            }).run();
        }
    }

    return c.json({ success: true });
});

export default app;
