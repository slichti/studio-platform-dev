import { Hono } from 'hono';
import { createDb } from '../db';
import { leads, tenants, tasks } from 'db/src/schema';
import { eq, desc, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: { userId: string };
    tenant: any;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /leads - List
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const list = await db.select().from(leads)
        .where(eq(leads.tenantId, tenant.id))
        .orderBy(desc(leads.createdAt))
        .all();

    return c.json({ leads: list });
});

// POST /leads - Create
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const { email, firstName, lastName, phone, source, notes } = await c.req.json();

    if (!email) return c.json({ error: "Email is required" }, 400);

    try {
        const id = crypto.randomUUID();
        await db.insert(leads).values({
            id,
            tenantId: tenant.id,
            email,
            firstName,
            lastName,
            phone,
            source,
            notes,
            status: 'new'
        }).run();

        // Auto-create Follow-up Task
        await db.insert(tasks).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            title: `Follow up with ${firstName || 'New Lead'}`,
            description: `Generated automatically for new lead: ${email}`,
            status: 'todo',
            priority: 'medium',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
            relatedLeadId: id,
        }).run();

        return c.json({ success: true, id }, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
            return c.json({ error: "Lead already exists with this email" }, 409);
        }
        return c.json({ error: e.message }, 500);
    }
});

// PATCH /leads/:id - Update status/notes
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const id = c.req.param('id');
    const body = await c.req.json();

    const allowedFields = ['status', 'notes', 'firstName', 'lastName', 'phone'];
    const updateData: any = {};
    for (const key of allowedFields) {
        if (body[key] !== undefined) updateData[key] = body[key];
    }

    updateData.updatedAt = new Date();

    await db.update(leads)
        .set(updateData)
        .where(and(eq(leads.id, id), eq(leads.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
