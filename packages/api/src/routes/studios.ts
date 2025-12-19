import { Hono } from 'hono';
import { tenants } from 'db/src/schema'; // Ensure proper export from db/src/index.ts
import { createDb } from '../db';
import { eq } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const { name, slug } = body;

    const id = crypto.randomUUID();

    try {
        await db.insert(tenants).values({
            id,
            name,
            slug,
        });
        return c.json({ id, name, slug }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    const result = await db.select().from(tenants).where(eq(tenants.id, id)).get();

    if (!result) return c.json({ error: 'Studio not found' }, 404);
    return c.json(result);
});

export default app;
