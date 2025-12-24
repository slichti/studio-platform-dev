import { Hono } from 'hono';
import { tenantMembers, tenantRoles } from 'db/src/schema';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: any;
    roles?: string[];
    isImpersonating?: boolean;
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /members: List all members (Owner only)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Fetch members with roles
    const members = await db.query.tenantMembers.findMany({
        where: eq(tenantMembers.tenantId, tenant.id),
        with: {
            roles: true,
            user: true // assuming relation exists
        }
    });

    return c.json({ members });
});

// PATCH /members/:id/role: Update member role (Owner only)
app.patch('/:id/role', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const memberId = c.req.param('id');
    const { role } = await c.req.json(); // 'instructor' or 'student'

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied: Only Owners can manage roles' }, 403);
    }

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    if (member.userId === c.get('auth').userId) {
        return c.json({ error: 'Cannot change your own role' }, 400);
    }

    // Replace roles logic: simple swap for now. 
    // Remove existing roles
    await db.delete(tenantRoles).where(eq(tenantRoles.memberId, memberId)).run();

    // Add new role
    if (role === 'instructor') {
        await db.insert(tenantRoles).values({
            id: crypto.randomUUID(),
            memberId,
            role: 'instructor'
        }).run();
    }
    // If student, we just leave them with no specific extra role (or add 'student' if we treat it as explicit role)
    // Assuming 'student' is default/implicit if no other role.
    // Or if we need explicit 'student' role:
    // await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId, role: 'student' }).run();

    return c.json({ success: true });
});

export default app;
