import { Hono } from 'hono';
import { createDb } from '../db';
import { substitutions, classes, tenantMembers, users } from 'db/src/schema'; // Ensure these match schema exports
import { eq, and, desc } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: { userId: string };
    tenant: any;
    member: any;
    roles: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET / - List all substitution requests for the tenant
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const subs = await db.query.substitutions.findMany({
        where: eq(substitutions.tenantId, tenant.id),
        with: {
            class: true,
            requestingInstructor: { with: { user: true } },
            coveringInstructor: { with: { user: true } }
        },
        orderBy: desc(substitutions.createdAt)
    });

    return c.json({ substitutions: subs });
});

// POST /request - Create a substitution request
app.post('/request', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized: Member context missing" }, 401);

    const { classId, notes } = await c.req.json();

    if (!classId) return c.json({ error: "Class ID required" }, 400);

    // Verify class belongs to tenant and instructor
    const cls = await db.query.classes.findFirst({
        where: and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))
    });

    if (!cls) return c.json({ error: "Class not found" }, 404);

    // Check if the requester is the instructor of the class OR an owner (owners can request on behalf)
    const roles = c.get('roles') || [];
    const isOwner = roles.includes('owner');
    if (cls.instructorId !== member.id && !isOwner) {
        return c.json({ error: "You can only request subs for your own classes" }, 403);
    }

    const subId = crypto.randomUUID();
    await db.insert(substitutions).values({
        id: subId,
        tenantId: tenant.id,
        classId,
        requestingInstructorId: cls.instructorId, // The person who NEEDS the sub
        status: 'pending',
        notes
    }).run();

    return c.json({ id: subId, status: 'pending' }, 201);
});

// POST /:id/claim - Claim a substitution request
app.post('/:id/claim', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const subId = c.req.param('id');
    const sub = await db.query.substitutions.findFirst({
        where: and(eq(substitutions.id, subId), eq(substitutions.tenantId, tenant.id))
    });

    if (!sub) return c.json({ error: "Request not found" }, 404);
    if (sub.status !== 'pending') return c.json({ error: "Request is no longer pending" }, 400);
    if (sub.requestingInstructorId === member.id) {
        return c.json({ error: "You cannot claim your own sub request" }, 400);
    }

    // Update Status to Claimed
    await db.update(substitutions)
        .set({
            status: 'claimed',
            coveringInstructorId: member.id,
            updatedAt: new Date()
        })
        .where(eq(substitutions.id, subId))
        .run();

    return c.json({ success: true, status: 'claimed' });
});

// POST /:id/approve - Approve a substitution
app.post('/:id/approve', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!roles.includes('owner')) {
        return c.json({ error: "Only owners can approve substitutions" }, 403);
    }

    const subId = c.req.param('id');
    const sub = await db.query.substitutions.findFirst({
        where: and(eq(substitutions.id, subId), eq(substitutions.tenantId, tenant.id))
    });

    if (!sub || !sub.coveringInstructorId) {
        return c.json({ error: "Request not found or not claimed yet" }, 400);
    }

    // 1. Update Sub Status
    await db.update(substitutions)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(substitutions.id, subId))
        .run();

    // 2. SWAP Instructor on Class
    await db.update(classes)
        .set({ instructorId: sub.coveringInstructorId })
        .where(eq(classes.id, sub.classId))
        .run();

    return c.json({ success: true, status: 'approved' });
});

// POST /:id/decline - Decline/Cancel a request
app.post('/:id/decline', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const member = c.get('member');

    const subId = c.req.param('id');
    const sub = await db.query.substitutions.findFirst({
        where: and(eq(substitutions.id, subId), eq(substitutions.tenantId, tenant.id))
    });

    if (!sub) return c.json({ error: "Not found" }, 404);

    // Only owner or the requesting instructor can cancel/decline
    const isOwner = roles.includes('owner');
    if (!isOwner && sub.requestingInstructorId !== member?.id) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    await db.update(substitutions)
        .set({ status: 'declined', updatedAt: new Date() })
        .where(eq(substitutions.id, subId))
        .run();

    return c.json({ success: true, status: 'declined' });
});

export default app;
