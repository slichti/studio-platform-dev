
import { Hono } from 'hono';
import { users, userRelationships, tenantMembers, tenantRoles } from 'db/src/schema'; // Ensure these are exported from db/src/schema
import { createDb } from '../db';
import { eq, and, inArray } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
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
