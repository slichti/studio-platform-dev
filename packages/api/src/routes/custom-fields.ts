import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

const app = createOpenAPIApp<StudioVariables>();

// Schema Definition with ID
const CustomFieldDefSchema = z.object({
    id: z.string().optional(), // ID is optional on creation, required on retrieval
    key: z.string().min(1),
    label: z.string().min(1),
    entityType: z.enum(['member', 'lead', 'class']).default('member'),
    type: z.enum(['text', 'number', 'date', 'select', 'boolean']).default('text'), // Deprecated/Legacy support
    fieldType: z.enum(['text', 'number', 'date', 'select', 'boolean']).default('text'), // Use fieldType to match frontend
    options: z.array(z.string()).optional(), // For 'select'
    required: z.boolean().default(false),
    isRequired: z.boolean().default(false), // Alias for frontend compatibility
    placeholder: z.string().optional()
}).openapi('CustomFieldDefinition');

const CustomFieldListSchema = z.array(CustomFieldDefSchema);

// Helper to normalized fields
const normalizeField = (field: any) => ({
    id: field.id || crypto.randomUUID(),
    key: field.key,
    label: field.label,
    entityType: field.entityType || 'member',
    fieldType: field.fieldType || field.type || 'text',
    options: field.options || [],
    isRequired: field.isRequired ?? field.required ?? false,
    placeholder: field.placeholder
});

// GET / - List Definitions
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
        403: { description: 'Unauthorized' },
        500: { description: 'Internal Server Error' }
    }
}), async (c) => {
    try {
        if (!c.get('can')('view_settings')) return c.json({ error: 'Unauthorized' }, 403);

        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        // Defensive check for customFieldDefinitions
        const rawDefs = Array.isArray(tenant.customFieldDefinitions)
            ? tenant.customFieldDefinitions
            : [];

        // Ensure all fields have IDs and normalized structure
        const defs = rawDefs.map(normalizeField);
        return c.json(defs);
    } catch (e: any) {
        console.error('List Custom Fields Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

// POST / - Create New Field
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Custom Fields'],
    summary: 'Create Custom Field Definition',
    request: {
        body: {
            content: {
                'application/json': { schema: CustomFieldDefSchema }
            }
        }
    },
    responses: {
        200: {
            description: 'Created field definition',
            content: { 'application/json': { schema: CustomFieldDefSchema } }
        },
        403: { description: 'Unauthorized' },
        500: { description: 'Internal Server Error' }
    }
}), async (c) => {
    try {
        if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const body = c.req.valid('json');

        const newField = normalizeField(body);
        const currentFields = (Array.isArray(tenant.customFieldDefinitions) ? tenant.customFieldDefinitions : []).map(normalizeField);

        // Check for duplicate keys
        if (currentFields.some((f: any) => f.key === newField.key)) {
            return c.json({ error: 'Field with this key already exists' } as any, 400);
        }

        const updatedFields = [...currentFields, newField];

        await db.update(tenants)
            .set({ customFieldDefinitions: updatedFields })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json(newField);
    } catch (e: any) {
        console.error('Create Custom Field Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

// PUT /:id - Update Field
app.openapi(createRoute({
    method: 'put',
    path: '/:id',
    tags: ['Custom Fields'],
    summary: 'Update Custom Field Definition',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': { schema: CustomFieldDefSchema.partial() }
            }
        }
    },
    responses: {
        200: {
            description: 'Updated field definition',
            content: { 'application/json': { schema: CustomFieldDefSchema } }
        },
        404: { description: 'Field not found' },
        403: { description: 'Unauthorized' },
        500: { description: 'Internal Server Error' }
    }
}), async (c) => {
    try {
        if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const { id } = c.req.valid('param');
        const body = c.req.valid('json');

        const currentFields = (Array.isArray(tenant.customFieldDefinitions) ? tenant.customFieldDefinitions : []).map(normalizeField);
        const fieldIndex = currentFields.findIndex((f: any) => f.id === id);

        if (fieldIndex === -1) {
            return c.json({ error: 'Field not found' } as any, 404);
        }

        const updatedField = { ...currentFields[fieldIndex], ...body, id }; // Ensure ID doesn't change
        currentFields[fieldIndex] = updatedField;

        await db.update(tenants)
            .set({ customFieldDefinitions: currentFields })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json(updatedField);
    } catch (e: any) {
        console.error('Update Custom Field Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

// DELETE /:id - Delete Field
app.openapi(createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Custom Fields'],
    summary: 'Delete Custom Field Definition',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: {
            description: 'Field deleted',
            content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }
        },
        403: { description: 'Unauthorized' },
        500: { description: 'Internal Server Error' }
    }
}), async (c) => {
    try {
        if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');
        if (!tenant) throw new Error('Tenant context missing');

        const { id } = c.req.valid('param');

        const currentFields = (Array.isArray(tenant.customFieldDefinitions) ? tenant.customFieldDefinitions : []).map(normalizeField);
        const filteredFields = currentFields.filter((f: any) => f.id !== id);

        await db.update(tenants)
            .set({ customFieldDefinitions: filteredFields })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Delete Custom Field Error:', e);
        return c.json({ error: e.message } as any, 500);
    }
});

export default app;
