
import { Hono } from 'hono';
import { users, userRelationships, tenantMembers, tenantRoles, subscriptions } from '@studio/db/src/schema'; // Ensure these are exported from db/src/schema
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
        claims?: any;
    };
    tenant?: {
        id: string;
    };
    isImpersonating?: boolean;
    validated_json?: any;
};

import { zValidator } from '../middleware/validator';
import { z } from 'zod';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const FamilyMemberSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    dob: z.string().optional() // Could tighten to date string regex
});

const SwitchProfileSchema = z.object({
    targetUserId: z.string().min(1)
});

const PushTokenSchema = z.object({
    token: z.string().min(1)
});

type PushTokenInput = z.infer<typeof PushTokenSchema>;

// GET /users/me - Get full user profile including tenants
// GET /users/me - Get full user profile including tenants
app.get('/me', async (c) => {
    try {
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
                    await db.batch([
                        // Insert new Global User
                        db.insert(users).values({
                            id: auth.userId,
                            email,
                            profile,
                            isPlatformAdmin: shadowUser.isPlatformAdmin,
                            stripeCustomerId: shadowUser.stripeCustomerId,
                            stripeAccountId: shadowUser.stripeAccountId,
                            createdAt: shadowUser.createdAt
                        }),

                        // Reassign Foreign Keys
                        db.update(tenantMembers).set({ userId: auth.userId }).where(eq(tenantMembers.userId, shadowUser.id)),
                        db.update(subscriptions).set({ userId: auth.userId }).where(eq(subscriptions.userId, shadowUser.id)),
                        db.update(userRelationships).set({ parentUserId: auth.userId }).where(eq(userRelationships.parentUserId, shadowUser.id)),
                        db.update(userRelationships).set({ childUserId: auth.userId }).where(eq(userRelationships.childUserId, shadowUser.id)),

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
            isPlatformAdmin: user.isPlatformAdmin,
            role: user.role,
            tenants: myTenants
        });
    } catch (e: any) {
        console.error("GET /me Failed:", e);
        return c.json({ error: "Failed to fetch user profile: " + e.message }, 500);
    }
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
app.post('/me/family', zValidator('json', FamilyMemberSchema), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required to add family member' }, 400);

    const { firstName, lastName, dob } = c.get('validated_json') as z.infer<typeof FamilyMemberSchema>;

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

// POST /users/me/switch-profile - Switch context to a family member
app.post('/me/switch-profile', zValidator('json', SwitchProfileSchema), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    const { targetUserId } = c.get('validated_json') as z.infer<typeof SwitchProfileSchema>;

    const realUserId = auth.claims.impersonatorId || auth.userId;

    // If switching back to self/parent (the real authenticated user)
    if (targetUserId === realUserId || targetUserId === auth.userId) {
        // Just return a success, frontend should clear cookies
        return c.json({ token: null, isSelf: true });
    }

    const db = createDb(c.env.DB);

    // Verify Relationship: Current User must be Parent of Target User
    // OR Current User is System Admin
    // OR Current User is impersonating a Parent? (Nested? No let's keep it simple: Real User -> Child)

    // We need the REAL underlying user ID if we are already impersonating? 
    // Actually authMiddleware sets `userId` to the *effective* user.
    // But `claims.impersonatorId` has the real one.
    // But `claims.impersonatorId` has the real one.
    // const realUserId = auth.claims.impersonatorId || auth.userId; (Already defined above)

    const relationship = await db.query.userRelationships.findFirst({
        where: and(
            eq(userRelationships.parentUserId, realUserId),
            eq(userRelationships.childUserId, targetUserId)
        )
    });

    if (!relationship) {
        // Allow System Admin override?
        // const user = await db.query.users.findFirst({ where: eq(users.id, realUserId) });
        // if (!user?.isSystemAdmin) ...
        return c.json({ error: 'Unauthorized: Not a managed family member' }, 403);
    }

    // Generate Custom Token
    const payload = {
        sub: targetUserId, // The effective user is now the child
        impersonatorId: realUserId, // The real user is the parent
        role: 'member', // or inherited
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    };

    // Use dynamic import for hono/jwt if needed, or standard import
    // We imported verify, let's import sign at top if not present, or use dynamic
    const { sign } = await import('hono/jwt');
    const secret = (c.env as any).IMPERSONATION_SECRET || (c.env as any).CLERK_SECRET_KEY;
    const token = await sign(payload, secret);

    return c.json({ token });
});

// GET /session-info - Debug/UI check for current session state
app.get('/session-info', (c) => {
    const auth = c.get('auth');
    const isImpersonating = c.get('isImpersonating');
    return c.json({
        userId: auth?.userId,
        isImpersonating: !!isImpersonating,
        impersonatorId: auth?.claims?.impersonatorId
    });
});

// POST /push-token - Register Device Token
app.post('/push-token', zValidator('json', PushTokenSchema), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    const { token } = c.get('validated_json') as z.infer<typeof PushTokenSchema>;

    const db = createDb(c.env.DB);
    await db.update(users)
        .set({ pushToken: token })
        .where(eq(users.id, auth.userId))
        .run();

    return c.json({ success: true });
});

const NotificationSettingsSchema = z.object({
    notifications: z.object({
        substitutions: z.object({
            email: z.boolean().optional(),
            sms: z.boolean().optional(),
            push: z.boolean().optional()
        }).optional()
    })
});

// PUT /me/settings/notifications - Update notification preferences for current tenant
app.put('/me/settings/notifications', zValidator('json', NotificationSettingsSchema), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    // @ts-ignore
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { notifications } = c.get('validated_json') as z.infer<typeof NotificationSettingsSchema>;

    const db = createDb(c.env.DB);

    // Get current member to read existing settings
    const member = await db.query.tenantMembers.findFirst({
        where: and(
            eq(tenantMembers.userId, auth.userId),
            eq(tenantMembers.tenantId, tenant.id)
        )
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    const currentSettings = (member.settings as any) || {};
    const currentNotifications = currentSettings.notifications || {};
    const currentSubs = currentNotifications.substitutions || {};

    // Merge updates
    const newSettings = {
        ...currentSettings,
        notifications: {
            ...currentNotifications,
            substitutions: {
                ...currentSubs,
                ...notifications.substitutions
            }
        }
    };

    await db.update(tenantMembers)
        .set({ settings: newSettings })
        .where(eq(tenantMembers.id, member.id));

    return c.json({ success: true, settings: newSettings });
});

// GET /me/settings/notifications - Get notification preferences for current tenant
app.get('/me/settings/notifications', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    // @ts-ignore
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const db = createDb(c.env.DB);

    const member = await db.query.tenantMembers.findFirst({
        where: and(
            eq(tenantMembers.userId, auth.userId),
            eq(tenantMembers.tenantId, tenant.id)
        )
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    const settings = (member.settings as any) || {};
    return c.json({ settings });
});

export default app;
