import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

const app = createOpenAPIApp<StudioVariables>();

const CustomFieldDefSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'number', 'date', 'select', 'boolean']),
    options: z.array(z.string()).optional(), // For 'select'
    required: z.boolean().default(false),
    placeholder: z.string().optional()
}).openapi('CustomFieldDefinition');

const CustomFieldListSchema = z.array(CustomFieldDefSchema);

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
        403: { description: 'Unauthorized' }
    }
}), async (c) => {
    // Anyone auth'd can read? Or just staff? Assuming staff/admin.
    if (!c.get('can')('view_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    // tenant.customFieldDefinitions is parsed JSON via Drizzle mode:'json'
    // But type might be unknown/any.
    const defs = (tenant.customFieldDefinitions as any) || [];
    return c.json(defs);
});

// PUT / - Update Definitions
app.openapi(createRoute({
    method: 'put',
    path: '/',
    tags: ['Custom Fields'],
    summary: 'Update Custom Field Definitions',
    request: {
        body: {
            content: {
                'application/json': { schema: CustomFieldListSchema }
            }
        }
    },
    responses: {
        200: {
            description: 'Updated definitions',
            content: { 'application/json': { schema: CustomFieldListSchema } }
        },
        403: { description: 'Unauthorized' }
    }
}), async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = c.req.valid('json');

    // Validation logic (e.g. check for duplicate keys) could go here

    await db.update(tenants)
        .set({ customFieldDefinitions: body })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json(body);
});

export default app;
