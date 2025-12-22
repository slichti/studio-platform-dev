import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, desc, and, or, like, sql, inArray } from 'drizzle-orm';
import { users, tenants, auditLogs, tenantMembers, tenantRoles } from 'db/src/schema'; // users might need explicit import if not exported? it was.
import { sign } from 'hono/jwt';

type Bindings = {
    DB: D1Database;
    CLERK_SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Bindings, Variables: any }>();

// Middleware to ensure Super Admin
app.use('*', async (c, next) => {
    try {
        const auth = c.get('auth');
        if (!auth) return c.json({ error: 'Unauthorized' }, 401);

        const db = createDb(c.env.DB);
        let user = await db.select().from(users).where(eq(users.id, auth.userId)).get();
        const claims = auth.sessionClaims as any;
        const email = claims?.email as string || "";

        // Bootstrap: Auto-promote specific email if not yet admin
        // We check either the hardcoded ID OR the email from the token claims
        if (
            (!user && (auth.userId === "user_377aQ2rw6dIQk5k43U71YKUHDMM" || email === 'slichti@gmail.com')) ||
            (user && user.email === 'slichti@gmail.com' && !user.isSystemAdmin)
        ) {
            console.log(`Bootstrapping system admin for ${auth.userId} (${email})`);

            if (!user) {
                await db.insert(users).values({
                    id: auth.userId,
                    email: email || 'slichti@gmail.com',
                    isSystemAdmin: true,
                    profile: { firstName: 'System', lastName: 'Admin' }
                }).run();
            } else {
                await db.update(users)
                    .set({ isSystemAdmin: true })
                    .where(eq(users.id, user.id))
                    .run();
            }

            // Refresh user record
            user = await db.select().from(users).where(eq(users.id, auth.userId)).get();
        }

        // Check system admin flag
        if (!user || !user.isSystemAdmin) {
            return c.json({
                error: 'Forbidden: Admins only',
                debug: {
                    currentUserId: auth.userId,
                    detectedEmail: email,
                    hasUserRecord: !!user,
                    userEmail: user?.email,
                    isAdmin: user?.isSystemAdmin,
                    claims: claims
                }
            }, 403);
        }

        await next();
    } catch (e: any) {
        console.error("Admin Middleware Error:", e);
        return c.json({
            error: "Admin Middleware Error",
            message: e.message,
            stack: e.stack,
            cause: e.cause
        }, 500);
    }
});

app.get('/tenants', async (c) => {
    const db = createDb(c.env.DB);
    const results = await db.select().from(tenants).all();
    return c.json(results);
});

app.post('/tenants', async (c) => {
    try {
        const db = createDb(c.env.DB);
        const { name, slug, ownerEmail } = await c.req.json();
        const auth = c.get('auth');
        const adminId = auth.userId;

        console.log(`[POST /tenants] Request: ${JSON.stringify({ name, slug, ownerEmail, adminId })}`);

        if (!name || !slug || !ownerEmail) {
            return c.json({ error: 'Missing required fields' }, 400);
        }

        // Check slug uniqueness
        const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
        if (existing) {
            return c.json({ error: 'Slug already taken' }, 409);
        }

        // Find or create Owner User
        let owner = await db.select().from(users).where(eq(users.email, ownerEmail)).get();
        if (!owner) {
            console.log(`[POST /tenants] Creating placeholder user for ${ownerEmail}`);
            const PLACEHOLDER_ID = `usr_placeholder_${crypto.randomUUID()}`;

            await db.insert(users).values({
                id: PLACEHOLDER_ID,
                email: ownerEmail,
                profile: { firstName: 'Pending', lastName: 'Owner' }
            }).run();

            owner = await db.select().from(users).where(eq(users.id, PLACEHOLDER_ID)).get();
        }

        if (!owner) return c.json({ error: 'Failed to resolve owner' }, 500);

        // Create Tenant
        console.log(`[POST /tenants] Creating tenant ${name}`);
        const tenantId = `tnt_${crypto.randomUUID()}`;
        await db.insert(tenants).values({
            id: tenantId,
            name,
            slug,
            branding: { primaryColor: '#4f46e5' } // Default branding
        }).run();

        // Add Owner as Member
        const memberId = `mem_${crypto.randomUUID()}`;
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId: tenantId,
            userId: owner.id,
            profile: { bio: 'Studio Owner' }
        }).run();

        await db.insert(tenantRoles).values({
            memberId: memberId,
            role: 'owner'
        }).run();

        // Log Action
        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: adminId,
            action: 'create_tenant',
            targetId: tenantId,
            details: JSON.stringify({ name, slug, ownerEmail }),
            ipAddress: c.req.header('cf-connecting-ip')
        }).run();

        // Fetch created tenant to return
        const newTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();

        return c.json({
            tenant: newTenant,
            status: 'provisioned',
            mockSteps: ['Database initialized', 'Owner linked', 'Cloudflare CNAME (Mock)', 'Stripe Customer (Mock)']
        });
    } catch (e: any) {
        console.error("[POST /tenants] Error:", e);
        return c.json({
            error: "Internal Server Error",
            message: e.message,
            stack: e.stack,
            cause: e.cause
        }, 500);
    }
});

app.get('/logs', async (c) => {
    try {
        const db = createDb(c.env.DB);

        // DEBUG: Verify DB connection with a known table
        try {
            const userCount = await db.select().from(users).limit(1).all();
            console.log("DEBUG: Users query success", userCount);
        } catch (dbErr: any) {
            console.error("DEBUG: Users query failed", dbErr);
            throw new Error(`DB Connection Check Failed: ${dbErr.message}`);
        }

        const results = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
        return c.json(results);
    } catch (error: any) {
        console.error("Failed to fetch audit logs:", error);
        return c.json({
            error: "Database Error",
            message: error.message,
            stack: error.stack,
            cause: error.cause
        }, 500);
    }
});

app.post('/users', async (c) => {
    const db = createDb(c.env.DB);
    const { email, firstName, lastName, isSystemAdmin, initialTenantId, initialRole } = await c.req.json();
    const adminId = c.get('auth').userId;
    // Schema imported at top level

    if (!email || !firstName || !lastName) {
        return c.json({ error: "Missing required fields (email, firstName, lastName)" }, 400);
    }

    // Check if user exists
    let user = await db.select().from(users).where(eq(users.email, email)).get();
    if (user) {
        return c.json({ error: "User with this email already exists" }, 409);
    }

    // Create User (Invited/Placeholder)
    const userId = `inv_${crypto.randomUUID()}`; // "inv" prefix for invited users not yet claimed via Clerk
    await db.insert(users).values({
        id: userId,
        email,
        isSystemAdmin: !!isSystemAdmin,
        profile: { firstName, lastName }
    }).run();

    // Assign to Tenant if requested
    if (initialTenantId) {
        const memberId = `mem_${crypto.randomUUID()}`;
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId: initialTenantId,
            userId: userId,
            profile: {}
        }).run();

        await db.insert(tenantRoles).values({
            memberId: memberId,
            role: initialRole || 'student'
        }).run();
    }

    // Log
    await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: adminId,
        action: 'create_user',
        targetId: userId,
        details: JSON.stringify({ email, isSystemAdmin, initialTenantId }),
        ipAddress: c.req.header('cf-connecting-ip')
    }).run();

    return c.json({ success: true, userId });
});

app.get('/users', async (c) => {
    const db = createDb(c.env.DB);
    // Schema and operators imported at top level

    const search = c.req.query('search');
    const tenantId = c.req.query('tenantId');
    const sort = c.req.query('sort') || 'joined_desc';

    // Approach: Fetch Users matching filters, then optionally fetch their membership details.

    // Sort Mapping
    let orderBy: any = desc(users.createdAt);
    if (sort === 'joined_asc') orderBy = users.createdAt;
    else if (sort === 'joined_desc') orderBy = desc(users.createdAt);
    else if (sort === 'name_asc') orderBy = sql`UPPER(json_extract(${users.profile}, '$.firstName'))`;
    else if (sort === 'name_desc') orderBy = desc(sql`UPPER(json_extract(${users.profile}, '$.firstName'))`);

    // Approach: Build filters array and apply once
    const filters = [];

    if (search) {
        const searchLike = `%${search}%`;
        filters.push(
            or(
                like(users.email, searchLike),
                sql`json_extract(${users.profile}, '$.firstName') LIKE ${searchLike}`,
                sql`json_extract(${users.profile}, '$.lastName') LIKE ${searchLike}`
            )
        );
    }

    // Construct query
    let matchedUsers;
    if (filters.length > 0) {
        matchedUsers = await db.select().from(users).where(filters[0]).orderBy(orderBy).limit(100).all();
    } else {
        matchedUsers = await db.select().from(users).orderBy(orderBy).limit(100).all();
    }

    // If tenantId filter is provided, we must strictly filter.
    // The above query didn't filter by tenant. 
    // If tenantId is present, the query should have been a join.
    let finalUsers = matchedUsers;

    if (tenantId) {
        // Filter in memory for now OR refactor to join if list is huge. 
        // Better: Join.
        // Let's re-write the query strategy to be generic. 
        const members = await db.select({
            user: users,
            member: tenantMembers
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenantId))
            .all();

        // If search was also present, filter the results
        if (search) {
            const lowerSearch = search.toLowerCase();
            finalUsers = members
                .map(m => m.user)
                .filter(u =>
                    u.email.toLowerCase().includes(lowerSearch) ||
                    JSON.stringify(u.profile).toLowerCase().includes(lowerSearch)
                );
        } else {
            finalUsers = members.map(m => m.user);
        }

        // Manual Sort for Tenant filtered list (since we lost DB sort)
        finalUsers.sort((a, b) => {
            if (sort.includes('joined')) {
                const dA = new Date(a.createdAt || 0).getTime();
                const dB = new Date(b.createdAt || 0).getTime();
                return sort.includes('asc') ? dA - dB : dB - dA;
            } else if (sort.includes('name')) {
                const nA = (a.profile as any)?.firstName || '';
                const nB = (b.profile as any)?.firstName || '';
                return sort.includes('asc') ? nA.localeCompare(nB) : nB.localeCompare(nA);
            }
            return 0;
        });
    }

    // Now, for the "Group By Tenant" view, the frontend needs to know WHICH tenants a user belongs to.
    // We should attach `memberships` to each user.
    // 1. Get all user IDs
    const userIds = finalUsers.map(u => u.id);

    if (userIds.length > 0) {
        const allMemberships = await db.select({
            userId: tenantMembers.userId,
            tenant: tenants,
            role: tenantRoles.role
        })
            .from(tenantMembers)
            .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
            .leftJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
            .where(sql`${tenantMembers.userId} IN ${userIds}`)
            .all();

        // Attach to users
        const usersWithMemberships = finalUsers.map(u => {
            const memberships = allMemberships.filter(m => m.userId === u.id);
            return {
                ...u,
                memberships: memberships.map(m => ({
                    tenant: m.tenant,
                    role: m.role
                }))
            };
        });

        return c.json(usersWithMemberships);
    }

    return c.json(finalUsers);
});

app.patch('/users/bulk', async (c) => {
    const db = createDb(c.env.DB);
    const { userIds, action, value } = await c.req.json();
    // Schema imported at top level

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return c.json({ error: "No users specified" }, 400);
    }

    const adminId = c.get('auth').userId;

    if (action === 'set_system_admin') {
        // Security check: cannot unset self
        if (value === false && userIds.includes(adminId)) {
            return c.json({ error: "Cannot remove your own admin privileges" }, 400);
        }

        await db.update(users)
            .set({ isSystemAdmin: value })
            .where(inArray(users.id, userIds))
            .run();
    } else {
        return c.json({ error: "Invalid action" }, 400);
    }

    return c.json({ success: true, count: userIds.length });
});

app.get('/users/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    // Schema imported at top level

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) return c.json({ error: 'User not found' }, 404);

    // Fetch memberships
    const memberships = await db.select({
        memberId: tenantMembers.id,
        tenant: tenants,
        role: tenantRoles.role
    })
        .from(tenantMembers)
        .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
        .leftJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
        .where(eq(tenantMembers.userId, id))
        .all();

    return c.json({
        ...user,
        memberships: memberships.map(m => ({
            id: m.memberId,
            tenant: m.tenant,
            role: m.role || 'member' // Default fallback
        }))
    });
});

app.post('/users/:id/memberships', async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.req.param('id');
    const { tenantId, role } = await c.req.json();
    const adminId = c.get('auth').userId;

    if (!tenantId || !role) return c.json({ error: "Missing tenantId or role" }, 400);

    // Check if member exists
    let member = await db.select().from(tenantMembers)
        .where(and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantMembers.userId, userId)
        ))
        .get();

    let memberId = member?.id;

    if (!member) {
        memberId = `mem_${crypto.randomUUID()}`;
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId,
            userId,
            profile: {}
        }).run();
    }

    // Upsert Role (Delete existing, insert new for simplicity, since we only support 1 role per user per tenant for now in this UI)
    // Schema allows multiple roles (PK is memberId + role), but UI likely enforces single primary role.
    // Let's wipe existing roles for this member and add the new one.

    await db.delete(tenantRoles).where(eq(tenantRoles.memberId, memberId!)).run();
    await db.insert(tenantRoles).values({
        memberId: memberId!,
        role: role
    }).run();

    // Log
    // Schema imported at top level
    await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: adminId,
        action: 'assign_role',
        targetId: userId,
        details: JSON.stringify({ tenantId, role }),
        ipAddress: c.req.header('cf-connecting-ip')
    }).run();

    return c.json({ success: true });
});

app.delete('/users/:id/memberships', async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.req.param('id');
    const { tenantId } = await c.req.json();
    // Schema imported at top level
    const adminId = c.get('auth').userId;

    // Find member
    const member = await db.select().from(tenantMembers)
        .where(and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantMembers.userId, userId)
        ))
        .get();

    if (member) {
        // Delete roles first (FK constraint)
        await db.delete(tenantRoles).where(eq(tenantRoles.memberId, member.id)).run();
        // Delete member
        await db.delete(tenantMembers).where(eq(tenantMembers.id, member.id)).run();

        // Log
        const { auditLogs } = await import('db/src/schema');
        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: adminId,
            action: 'remove_access',
            targetId: userId,
            details: JSON.stringify({ tenantId }),
            ipAddress: c.req.header('cf-connecting-ip')
        }).run();
    }

    return c.json({ success: true });
});

app.put('/users/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const { isSystemAdmin } = await c.req.json();
    // Schema imported at top level

    // Prevent removing self as admin
    const auth = c.get('auth');
    if (auth.userId === id && isSystemAdmin === false) {
        return c.json({ error: "Cannot remove your own admin privileges" }, 400);
    }

    await db.update(users)
        .set({ isSystemAdmin })
        .where(eq(users.id, id))
        .run();

    return c.json({ success: true });
});

app.post('/impersonate', async (c) => {
    const db = createDb(c.env.DB);
    const { targetUserId } = await c.req.json();
    const adminId = c.get('auth').userId;

    // Verify target exists
    const targetUser = await db.select().from(users).where(eq(users.id, targetUserId)).get();
    if (!targetUser) return c.json({ error: 'User not found' }, 404);

    // Generate Custom JWT
    // Payload should look enough like Clerk's or our Auth middleware's expectation
    // We add 'impersonatorId' so middleware knows it's a fake session
    const payload = {
        sub: targetUser.id,
        impersonatorId: adminId,
        // role: targetUser.role, // Property does not exist on User, and not needed for simple auth middleware check
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    };

    const token = await sign(payload, c.env.CLERK_SECRET_KEY); // Reusing key

    // Log it
    // Schema imported at top level
    await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: adminId,
        action: 'impersonate',
        targetId: targetUser.id,
        details: JSON.stringify({ reason: 'Support troubleshooting' }),
        ipAddress: c.req.header('cf-connecting-ip')
    });

    return c.json({ token });
});

export default app;
