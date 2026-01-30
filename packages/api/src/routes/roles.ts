import { Hono } from 'hono';
import { createDb } from '../db';
import { customRoles, memberCustomRoles } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { HonoContext, PERMISSIONS } from '../types';

const app = new Hono<HonoContext>();

// GET /roles
app.get('/', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    return c.json(await db.select().from(customRoles).where(eq(customRoles.tenantId, c.get('tenant')!.id)).all());
});

// POST /roles
app.post('/', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const { name, description, permissions } = await c.req.json();
    const safe = (permissions || []).filter((p: string) => Object.values(PERMISSIONS).includes(p as any));
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();
    await db.insert(customRoles).values({ id, tenantId: c.get('tenant')!.id, name, description, permissions: safe }).run();
    return c.json({ success: true, id });
});

// PUT /roles/:id
app.put('/:id', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const { name, description, permissions } = await c.req.json();
    const db = createDb(c.env.DB);
    const role = await db.select().from(customRoles).where(and(eq(customRoles.id, c.req.param('id')), eq(customRoles.tenantId, c.get('tenant')!.id))).get();
    if (!role) return c.json({ error: 'Not found' }, 404);

    const up: any = {};
    if (name) up.name = name;
    if (description !== undefined) up.description = description;
    if (permissions) up.permissions = permissions.filter((p: string) => Object.values(PERMISSIONS).includes(p as any));

    await db.update(customRoles).set(up).where(eq(customRoles.id, role.id)).run();
    return c.json({ success: true });
});

// DELETE /roles/:id
app.delete('/:id', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const role = await db.select().from(customRoles).where(and(eq(customRoles.id, c.req.param('id')), eq(customRoles.tenantId, c.get('tenant')!.id))).get();
    if (!role) return c.json({ error: 'Not found' }, 404);

    await db.delete(memberCustomRoles).where(eq(memberCustomRoles.customRoleId, role.id)).run();
    await db.delete(customRoles).where(eq(customRoles.id, role.id)).run();
    return c.json({ success: true });
});

export default app;
