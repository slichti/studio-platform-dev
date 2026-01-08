
import { Hono } from 'hono';
import { users, userRelationships, tenantMembers, tenantRoles, subscriptions } from 'db'; // Ensure these are exported from db/src/schema
import { createDb } from '../db';
import { eq, and, inArray } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    CLERK_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
        sessionId: string;
    };
    tenant?: {
        id: string;
    };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /users/me - Get full user profile including tenants
// GET /users/me - Get full user profile including tenants
app.get('/me', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = createDb(c.env.DB);

    // 1. Try to find the user by their Clerk ID
    let user = await db.query.users.findFirst({
        where: eq(users.id, auth.userId),
        with: {
            memberships: {
                with: {
                    tenant: true,
                    roles: true
                }
            }
        }
    });

    // 2. If not found, implement JIT Provisioning & Account Linking
    if (!user) {
        console.log(`User ${auth.userId} not found in DB. Attempting JIT provisioning...`);
        try {
            // A. Fetch User Details from Clerk API
            const clerkRes = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
                headers: {
                    'Authorization': `Bearer ${c.env.CLERK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!clerkRes.ok) {
                console.error("Failed to fetch from Clerk", await clerkRes.text());
                return c.json({ error: 'User provisioning failed' }, 500);
            }

            const clerkUser = await clerkRes.json() as any;
            const email = clerkUser.email_addresses?.[0]?.email_address;
            const firstName = clerkUser.first_name;
            const lastName = clerkUser.last_name;
            const portraitUrl = clerkUser.image_url;

            if (!email) {
                return c.json({ error: 'No email found for user' }, 400);
            }

            // B. Check for "Shadow User" (Created by Admin via email)
            const shadowUser = await db.query.users.findFirst({
                where: eq(users.email, email)
            });

            const profile = { firstName, lastName, portraitUrl };

            if (shadowUser) {
                console.log(`Found Shadow User ${shadowUser.id} for email ${email}. Migrating to Clerk ID ${auth.userId}...`);
                // C. Migrate Records
                // We need to move everything from shadowUser.id to auth.userId
                // Then delete shadowUser.id
                // Then insert auth.userId (or update if we prefer, but ID change is tricky in SQL)
                // SQLite doesn't support changing primary key easily with cascading update unless defined.
                // We will manually reassign FKs.

                // 1. Subscriptions
                // 2. Tenant Members
                // 3. User Relationships (Parent/Child)
                // 4. User Challenges
                // 5. Audit Logs (Actor)

                await db.batch([
                    // Insert new Global User
                    db.insert(users).values({
                        id: auth.userId,
                        email,
                        profile,
                        isSystemAdmin: shadowUser.isSystemAdmin,
                        stripeCustomerId: shadowUser.stripeCustomerId,
                        stripeAccountId: shadowUser.stripeAccountId,
                        createdAt: shadowUser.createdAt
                    }),

                    // Reassign Foreign Keys
                    db.update(tenantMembers).set({ userId: auth.userId }).where(eq(tenantMembers.userId, shadowUser.id)),
                    db.update(subscriptions).set({ userId: auth.userId }).where(eq(subscriptions.userId, shadowUser.id)),
                    db.update(userRelationships).set({ parentUserId: auth.userId }).where(eq(userRelationships.parentUserId, shadowUser.id)),
                    db.update(userRelationships).set({ childUserId: auth.userId }).where(eq(userRelationships.childUserId, shadowUser.id)),
                    // Note: Add other tables if necessary (e.g. Audit Logs if we want to keep history linked)

                    // Delete Shadow User
                    db.delete(users).where(eq(users.id, shadowUser.id))
                ]);

            } else {
                console.log(`Creating new JIT user for ${auth.userId}`);
                // D. Create New User
                await db.insert(users).values({
                    id: auth.userId,
                    email,
                    profile,
                    createdAt: new Date()
                }).run();
            }

            // 3. Re-fetch User
            user = await db.query.users.findFirst({
                where: eq(users.id, auth.userId),
                with: {
                    memberships: {
                        with: {
                            tenant: true,
                            roles: true
                        }
                    }
                }
            });

        } catch (e: any) {
            console.error("JIT Error:", e);
            return c.json({ error: `JIT Provisioning Failed: ${e.message}` }, 500);
        }
    }

    if (!user) {
        return c.json({ error: 'User could not be loaded' }, 500);
    }

    const myTenants = user.memberships.map(m => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        roles: m.roles.map(r => r.role),
        branding: m.tenant.branding
    }));

    return c.json({
        id: user.id,
        email: user.email,
        firstName: (user.profile as any)?.firstName,
        lastName: (user.profile as any)?.lastName,
        portraitUrl: (user.profile as any)?.portraitUrl,
        isSystemAdmin: user.isSystemAdmin,
        tenants: myTenants
    });
});

// GET /users/me/family - List family members for the current tenant
app.get('/me/family', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    // Tenant context is optional but useful for returning the child's memberId for THIS tenant
    const tenant = c.get('tenant');

    const db = createDb(c.env.DB);

    // 1. Find relationships where current user is parent
    const relationships = await db.query.userRelationships.findMany({
        where: eq(userRelationships.parentUserId, auth.userId),
        with: {
            // We can't easily deep join cleanly with Drizzle's query builder for all needs sometimes,
            // but let's try standard relations if they exist. 
            // Attempting manual join logic for clarity if relations aren't perfect.
        }
    });

    // 2. Fetch User profiles for chilren
    const childUserIds = relationships.map(r => r.childUserId);
    if (childUserIds.length === 0) {
        return c.json({ family: [] });
    }

    const children = await db.query.users.findMany({
        where: inArray(users.id, childUserIds)
    });

    // 3. If we are in a tenant context, find their memberIds
    let memberMap = new Map<string, string>(); // userId -> memberId
    if (tenant) {
        const members = await db.query.tenantMembers.findMany({
            where: and(
                eq(tenantMembers.tenantId, tenant.id),
                inArray(tenantMembers.userId, childUserIds)
            )
        });
        members.forEach(m => memberMap.set(m.userId, m.id));
    }

    // Format response
    const family = children.map(child => ({
        userId: child.id,
        firstName: (child.profile as any)?.firstName || 'Unknown',
        lastName: (child.profile as any)?.lastName || '',
        dob: child.dob,
        memberId: memberMap.get(child.id) || null // Null if not joined this studio yet
    }));

    return c.json({ family });
});

// POST /users/me/family - Create a new child
app.post('/me/family', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required to add family member' }, 400);

    const body = await c.req.json();
    const { firstName, lastName, dob } = body;

    if (!firstName) return c.json({ error: 'First Name is required' }, 400);

    const db = createDb(c.env.DB);

    // 1. Create Child User
    const childId = crypto.randomUUID();
    // Placeholder email logic - robust enough for MVP
    const placeholderEmail = `child-${childId}@placeholder.studio`;

    await db.insert(users).values({
        id: childId,
        email: placeholderEmail,
        profile: { firstName, lastName },
        dob: dob ? new Date(dob) : null,
        isMinor: true, // Auto-flag as minor for now
        createdAt: new Date()
    });

    // 2. Create Relationship
    await db.insert(userRelationships).values({
        id: crypto.randomUUID(),
        parentUserId: auth.userId,
        childUserId: childId,
        type: 'parent_child',
        createdAt: new Date()
    });

    // 3. Auto-join Tenant
    const memberId = crypto.randomUUID();
    await db.insert(tenantMembers).values({
        id: memberId,
        tenantId: tenant.id,
        userId: childId,
        profile: { firstName, lastName }, // Sync profile to member
        status: 'active',
        joinedAt: new Date()
    });

    await db.insert(tenantRoles).values({
        memberId,
        role: 'student'
    });

    return c.json({
        success: true,
        child: {
            userId: childId,
            memberId,
            firstName,
            lastName
        }
    }, 201);
});

export default app;
