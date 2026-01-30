import { Hono } from 'hono';
import { createDb } from '../db';
import { customFieldDefinitions } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { Bindings, Variables } from '..';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /custom-fields - List definitions
app.get('/', async (c) => {
    const tenant = c.get('tenant');
    const entityType = c.req.query('entityType'); // Optional filter
    const db = createDb(c.env.DB);

    let query = db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.tenantId, tenant.id));

    // Need to handle dynamic query building carefully with drizzle
    // Use a simpler approach: get all and filter in memory if drizzle dynamic query is complex, 
    // or construct conditions.
    // Drizzle supports chaining where: .where(and(condition1, condition2))

    if (entityType) {
        // Re-construct query with entityType
        const fields = await db.select().from(customFieldDefinitions).where(
            and(
                eq(customFieldDefinitions.tenantId, tenant.id),
                eq(customFieldDefinitions.entityType, entityType as any)
            )
        ).all();
        return c.json(fields);
    } else {
        const fields = await query.all();
        return c.json(fields);
    }
});

// POST /custom-fields - Create definition
app.post('/', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { entityType, key, label, fieldType, options, isRequired } = await c.req.json();

    if (!entityType || !key || !label || !fieldType) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    const id = crypto.randomUUID();
    await db.insert(customFieldDefinitions).values({
        id,
        tenantId: tenant.id,
        entityType,
        key,
        label,
        fieldType,
        options,
        isRequired: isRequired || false
    }).run();

    const field = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).get();
    return c.json(field);
});

// PUT /custom-fields/:id - Update definition
app.put('/:id', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const { label, options, isRequired, isActive } = await c.req.json();

    // Not allowing key/type update to avoid data inconsistency

    await db.update(customFieldDefinitions)
        .set({ label, options, isRequired, isActive })
        .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, tenant.id)))
        .run();

    const field = await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)).get();
    return c.json(field);
});

// DELETE /custom-fields/:id - Delete definition
app.delete('/:id', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    await db.delete(customFieldDefinitions)
        .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
