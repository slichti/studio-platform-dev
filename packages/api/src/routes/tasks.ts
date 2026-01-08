import { Hono } from 'hono';
import { eq, and, desc, asc } from 'drizzle-orm';
import { createDb } from '../db';
import { tasks, tenantMembers, leads, users } from 'db'; // Ensure correct import path matching leads.ts

// Manual types for request body
type TaskCreate = {
    title: string;
    description?: string;
    status?: 'todo' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string;
    assignedToId?: string;
    relatedLeadId?: string;
    relatedMemberId?: string;
};

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: { userId: string };
    tenant: any;
    user?: any; // global user
    member?: any; // tenant member
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /tasks - List tasks
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { status, assignee, leadId, memberId, mine } = c.req.query();

    // Base Select
    let query = db.select({
        task: tasks,
        assigneeMember: tenantMembers,
        assigneeUser: users
    })
        .from(tasks)
        .leftJoin(tenantMembers, eq(tasks.assignedToId, tenantMembers.id))
        .leftJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tasks.tenantId, tenant.id));

    const conditions = [eq(tasks.tenantId, tenant.id)];

    if (status) {
        conditions.push(eq(tasks.status, status as any));
    }
    if (assignee) {
        conditions.push(eq(tasks.assignedToId, assignee));
    }
    if (leadId) {
        conditions.push(eq(tasks.relatedLeadId, leadId));
    }
    if (memberId) {
        conditions.push(eq(tasks.relatedMemberId, memberId));
    }

    // "Mine" filter
    if (mine === 'true') {
        const user = c.get('user'); // from auth middleware? leads.ts uses c.get('auth').userId or similar?
        // Note: leads.ts doesn't seem to use user object directly, but index.ts sets it.
        // Let's rely on looking up member by auth.userId if needed, or assume c.get('member') is set if authorized?
        // index.ts: member is set by tenantMiddleware.
        const member = c.get('member');
        if (member) {
            conditions.push(eq(tasks.assignedToId, member.id));
        }
    }

    // Apply conditions
    if (conditions.length > 1) {
        // @ts-ignore
        query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(tasks.createdAt), asc(tasks.status)).all();

    // Map results to cleaner structure
    const mapped = results.map(r => ({
        ...r.task,
        assignee: r.assigneeMember ? {
            id: r.assigneeMember.id,
            firstName: (r.assigneeUser?.profile as any)?.firstName || 'Unknown',
            // users.profile is defined as { mode: 'json' } in schema.
            // drizzle should parse it.
            // Let's assume parsed.
            profile: r.assigneeMember.profile,
            userProfile: r.assigneeUser?.profile
        } : null
    }));

    return c.json(mapped);
});

// POST /tasks - Create
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const data = await c.req.json<TaskCreate>();

    if (!data.title) return c.json({ error: 'Title is required' }, 400);

    const [newTask] = await db.insert(tasks).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        title: data.title,
        description: data.description,
        status: data.status ?? 'todo',
        priority: data.priority ?? 'medium',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        assignedToId: data.assignedToId,
        relatedLeadId: data.relatedLeadId,
        relatedMemberId: data.relatedMemberId,
    }).returning();

    return c.json(newTask, 201);
});

// PATCH /tasks/:id - Update
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const data = await c.req.json<Partial<TaskCreate>>();

    const updateData: any = {
        updatedAt: new Date(),
    };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;

    // Note: reassigning relations might be allowed

    const [updated] = await db.update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenant.id)))
        .returning();

    if (!updated) return c.json({ error: 'Task not found' }, 404);

    return c.json(updated);
});

// DELETE /tasks/:id
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.tenantId, tenant.id))).run();

    return c.json({ success: true });
});

export default app;
