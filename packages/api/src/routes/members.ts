import { Hono } from 'hono';
import { tenantMembers, users, tenantRoles } from 'db/src/schema';
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
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /: List members for the current tenant
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // RBAC: Only Instructors or Owners can list students
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        // Query members + join with users to get names/emails
        const results = await db.select({
            id: tenantMembers.id,
            joinedAt: tenantMembers.joinedAt,
            user: {
                id: users.id,
                email: users.email,
                profile: users.profile
            }
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenant.id));

        // Fetch roles for each member? Or usually "Students" implies role filtered?
        // For now, list ALL members in the tenant.

        // Optimization: We could join tenantRoles too, but let's keep it simple.

        return c.json(results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
