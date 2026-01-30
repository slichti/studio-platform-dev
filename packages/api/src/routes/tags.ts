import { Hono } from 'hono';
import { createDb } from '../db';
import { memberTags } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { Bindings, Variables } from '..';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /tags - List all tags for the tenant
app.get('/', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const tags = await db.select().from(memberTags).where(eq(memberTags.tenantId, tenant.id)).all();
    return c.json(tags);
});

// POST /tags - Create a new tag
app.post('/', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const { name, color, description } = await c.req.json();

    if (!name) return c.json({ error: 'Name is required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(memberTags).values({
        id,
        tenantId: tenant.id,
        name,
        color,
        description
    }).run();

    const tag = await db.select().from(memberTags).where(eq(memberTags.id, id)).get();
    return c.json(tag);
});

// PUT /tags/:id - Update a tag
app.put('/:id', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const { name, color, description } = await c.req.json();

    await db.update(memberTags)
        .set({ name, color, description })
        .where(and(eq(memberTags.id, id), eq(memberTags.tenantId, tenant.id)))
        .run();

    const tag = await db.select().from(memberTags).where(eq(memberTags.id, id)).get();
    return c.json(tag);
});

// DELETE /tags/:id - Delete a tag
app.delete('/:id', async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    await db.delete(memberTags)
        .where(and(eq(memberTags.id, id), eq(memberTags.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
