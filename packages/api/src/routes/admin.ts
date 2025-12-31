import { Hono } from 'hono';
import { createDb } from '../db';
import { users, auditLogs, tenants } from 'db/src/schema'; // Ensure exported
import { eq, desc, and } from 'drizzle-orm';
import { sign } from 'hono/jwt';

type Bindings = {
    DB: D1Database;
    CLERK_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// POST /impersonate: Generate an impersonation token
app.post('/impersonate', async (c) => {
    const auth = c.get('auth');
    // 1. Check if caller is System Admin
    const db = createDb(c.env.DB);
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const { targetUserId } = await c.req.json();

    if (!targetUserId) {
        return c.json({ error: "Target User ID required" }, 400);
    }

    // 2. Verify Target User Exists
    const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId)
    });

    if (!targetUser) {
        return c.json({ error: "Target user not found" }, 404);
    }

    // 3. Generate Token
    // We sign with the Clerk Secret Key (internal shared secret) for simplicity
    // Expire in 1 hour
    const payload = {
        sub: targetUserId,
        impersonatorId: auth.userId,
        impersonatorName: `${JSON.parse(adminUser.profile as string).firstName} ${JSON.parse(adminUser.profile as string).lastName}`, // Simplistic profile parsing
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    };

    const token = await sign(payload, c.env.CLERK_SECRET_KEY);

    return c.json({
        token,
        targetUser: {
            id: targetUser.id,
            email: targetUser.email
        }
    });
});

// GET /users: Link all users
app.get('/users', async (c) => {
    const auth = c.get('auth');
    const db = createDb(c.env.DB);
    const { search, tenantId, limit } = c.req.query();

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    // 2. Build Query
    // Note: Drizzle's query builder is powerful but exact "search" is backend specific.
    // For SQLite, we might fetch more and filter in JS if complex, but simple strict equality or like is supported.
    // However, db.query API does not easily support complex 'ilike' (case insensitive) across relationships without raw SQL.
    // For now we will fetch all (or limit) and filter in memory if necessary, OR use findMany with simple wheres.

    // If tenantId is filtered, we need to filter users who have a membership in that tenant.
    // This is hard to do with just `db.query.users.findMany` top level without `where: (users, { exists })` which is advanced.
    // A simpler approach for MVP is fetching all and filtering, assuming user count < 1000 for now.

    const allUsers = await db.query.users.findMany({
        with: {
            memberships: {
                with: {
                    tenant: true,
                    roles: true
                }
            }
        },
        orderBy: [desc(users.createdAt)],
    });

    let filtered = allUsers;

    if (search) {
        const lowerQ = search.toLowerCase();
        filtered = filtered.filter(u =>
            u.email.toLowerCase().includes(lowerQ) ||
            (u.profile as any)?.firstName?.toLowerCase().includes(lowerQ) ||
            (u.profile as any)?.lastName?.toLowerCase().includes(lowerQ)
        );
    }

    if (tenantId) {
        filtered = filtered.filter(u =>
            u.memberships.some((m: any) => m.tenantId === tenantId)
        );
    }

    return c.json(filtered);
});

// GET /users/:id: Get user details for editing
app.get('/users/:id', async (c) => {
    const auth = c.get('auth');
    const { id: userId } = c.req.param();
    const db = createDb(c.env.DB);

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    // 2. Fetch User with Memberships
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            memberships: {
                with: {
                    tenant: true,
                    roles: true
                }
            }
        }
    });

    if (!user) {
        return c.json({ error: "User Not Found" }, 404);
    }

    return c.json(user);
});

// PUT /users/:id: Update User (e.g. System Admin status)
app.put('/users/:id', async (c) => {
    const auth = c.get('auth');
    const { id: userId } = c.req.param();
    const body = await c.req.json();
    const db = createDb(c.env.DB);

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    // 2. Update User
    await db.update(users)
        .set({ isSystemAdmin: body.isSystemAdmin })
        .where(eq(users.id, userId))
        .run();

    return c.json({ success: true });
});

// POST /users/:id/memberships: Add user to a tenant
app.post('/users/:id/memberships', async (c) => {
    const auth = c.get('auth');
    const { id: userId } = c.req.param();
    const { tenantId, role } = await c.req.json();
    const db = createDb(c.env.DB);

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });
    if (!adminUser || !adminUser.isSystemAdmin) return c.json({ error: "Access Denied" }, 403);

    const { tenantMembers, tenantRoles } = await import('db/src/schema');

    // 2. Check if member exists
    let member = await db.query.tenantMembers.findFirst({
        where: (members, { and, eq }) => and(eq(members.userId, userId), eq(members.tenantId, tenantId))
    });

    if (!member) {
        // Create Member
        const memberId = crypto.randomUUID();
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId,
            userId
        }).run();
        member = { id: memberId } as any;
    }

    // 3. Add Role
    // Check if role exists
    const existingRole = await db.query.tenantRoles.findFirst({
        where: (roles, { and, eq }) => and(eq(roles.memberId, member!.id), eq(roles.role, role))
    });

    if (!existingRole) {
        await db.insert(tenantRoles).values({
            memberId: member!.id,
            role
        }).run();
    }

    return c.json({ success: true });
});

// DELETE /users/:id/memberships: Remove user from tenant
app.delete('/users/:id/memberships', async (c) => {
    const auth = c.get('auth');
    const { id: userId } = c.req.param();
    const { tenantId } = await c.req.json();
    const db = createDb(c.env.DB);

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });
    if (!adminUser || !adminUser.isSystemAdmin) return c.json({ error: "Access Denied" }, 403);

    const { tenantMembers } = await import('db/src/schema');
    // 2. Delete Tenant Member (Cascade should handle roles if configured, otherwise delete roles first)
    // Assuming Cascade or just deleting member row
    await db.delete(tenantMembers)
        .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
        .run();

    return c.json({ success: true });
});

// GET /tenants: List all tenants (System Admin only)
app.get('/tenants', async (c) => {
    const auth = c.get('auth');
    const db = createDb(c.env.DB);

    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const allTenants = await db.query.tenants.findMany({
        orderBy: [desc(tenants.createdAt)]
    });

    return c.json(allTenants);
});

// POST /tenants: Create a new tenant (System Admin)
app.post('/tenants', async (c) => {
    const auth = c.get('auth');
    const db = createDb(c.env.DB);
    const body = await c.req.json();

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    // 2. Validate Input
    if (!body.name || !body.slug) {
        return c.json({ error: "Name and Slug are required" }, 400);
    }

    // 3. Create Tenant
    const tenantId = crypto.randomUUID();
    const newTenant = {
        id: tenantId,
        name: body.name,
        slug: body.slug,
        tier: body.tier || 'basic',
        status: 'active' as const,
        createdAt: new Date()
    };

    try {
        await db.insert(tenants).values(newTenant).run();

        // 4. Handle Owner (if email provided)
        if (body.ownerEmail) {
            // Find or Invite User (For now, just find)
            const ownerUser = await db.query.users.findFirst({
                where: eq(users.email, body.ownerEmail)
            });

            if (ownerUser) {
                // Add to tenant as owner
                const memberId = crypto.randomUUID();
                const { tenantMembers, tenantRoles } = await import('db/src/schema');

                await db.insert(tenantMembers).values({
                    id: memberId,
                    tenantId: tenantId,
                    userId: ownerUser.id,
                    status: 'active'
                }).run();

                await db.insert(tenantRoles).values({
                    memberId: memberId,
                    role: 'owner'
                }).run();
            }
        }

        return c.json({ tenant: newTenant }, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return c.json({ error: "Slug already taken" }, 409);
        }
        return c.json({ error: e.message }, 500);
    }
});

// GET /logs: Fetch recent audit logs
app.get('/logs', async (c) => {
    const auth = c.get('auth');
    const db = createDb(c.env.DB);

    // 1. Check System Admin
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    // 2. Fetch Logs
    const logs = await db.query.auditLogs.findMany({
        orderBy: [desc(auditLogs.createdAt)],
        limit: 50
    });

    return c.json(logs);
});

// PATCH /tenants/:id/status: Update tenant status (active/paused/suspended)
app.patch('/tenants/:id/status', async (c) => {
    const auth = c.get('auth');
    const tenantId = c.req.param('id');
    const { status } = await c.req.json();

    // 1. Check System Admin
    const db = createDb(c.env.DB);
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, auth.userId)
    });

    if (!adminUser || !adminUser.isSystemAdmin) {
        return c.json({ error: "Access Denied" }, 403);
    }

    // 2. Validate Status
    if (!['active', 'paused', 'suspended'].includes(status)) {
        return c.json({ error: "Invalid status. Must be one of: active, paused, suspended" }, 400);
    }

    // 3. Update Tenant
    const updatedTenant = await db.update(tenants)
        .set({ status })
        .where(eq(tenants.id, tenantId))
        .returning()
        .get();

    if (!updatedTenant) {
        return c.json({ error: "Tenant not found" }, 404);
    }

    // 4. Audit Log
    await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        action: "update_tenant_status",
        targetId: tenantId,
        actorId: auth.userId,
        details: JSON.stringify({ oldStatus: "unknown", newStatus: status }), // Simplified for now
        ipAddress: c.req.header('CF-Connecting-IP') || "unknown"
    });

    return c.json({ success: true, tenant: updatedTenant });
});

export default app;
