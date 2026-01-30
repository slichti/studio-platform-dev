import { Hono } from 'hono';
import { createDb } from '../db';
import { leads, tasks } from '@studio/db/src/schema';
import { eq, desc, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /leads - List
app.get('/', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const list = await db.select().from(leads)
        .where(eq(leads.tenantId, tenant.id))
        .orderBy(desc(leads.createdAt)).all();

    return c.json({ leads: list });
});

// POST /leads - Create
app.post('/', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { email, firstName, lastName, phone, source, notes } = await c.req.json();
    if (!email) return c.json({ error: "Email is required" }, 400);

    try {
        const id = crypto.randomUUID();
        await db.insert(leads).values({
            id, tenantId: tenant.id, email, firstName, lastName, phone, source, notes, status: 'new'
        }).run();

        await db.insert(tasks).values({
            id: crypto.randomUUID(), tenantId: tenant.id, title: `Follow up with ${firstName || 'New Lead'}`,
            description: `Auto-lead: ${email}`, status: 'todo', priority: 'medium',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), relatedLeadId: id,
        }).run();

        return c.json({ success: true, id }, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) return c.json({ error: "Lead exists" }, 409);
        return c.json({ error: e.message }, 500);
    }
});

// PATCH /leads/:id
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');
    const body = await c.req.json();

    const updateData: any = {};
    ['status', 'notes', 'firstName', 'lastName', 'phone'].forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });
    updateData.updatedAt = new Date();

    await db.update(leads).set(updateData).where(and(eq(leads.id, id), eq(leads.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

export default app;
