import { Hono } from 'hono';
import { users, userRelationships, tenantMembers, tenantRoles, subscriptions } from '@studio/db/src/schema';
import { createDb } from '../db';
import { eq, and, inArray, or } from 'drizzle-orm';
import { HonoContext } from '../types';
import { StripeService } from '../services/stripe';

const app = new Hono<HonoContext>();

// GET /users/me
app.get('/me', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);

    let user = await db.query.users.findFirst({
        where: eq(users.id, auth.userId),
        with: { memberships: { with: { tenant: true, roles: true } } }
    });

    if (!user) {
        try {
            const res = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, { headers: { 'Authorization': `Bearer ${c.env.CLERK_SECRET_KEY as string}` } });
            if (!res.ok) return c.json({ error: 'Provisioning failed' }, 500);
            const clerk = await res.json() as any;
            const email = clerk.email_addresses?.[0]?.email_address;
            if (!email) return c.json({ error: 'No email' }, 400);

            const shadow = await db.query.users.findFirst({ where: eq(users.email, email) });
            const prof = { firstName: clerk.first_name, lastName: clerk.last_name, portraitUrl: clerk.image_url };

            if (shadow) {
                await db.batch([
                    db.insert(users).values({ id: auth.userId, email, profile: prof, isPlatformAdmin: shadow.isPlatformAdmin, stripeCustomerId: shadow.stripeCustomerId, stripeAccountId: shadow.stripeAccountId, createdAt: shadow.createdAt }),
                    db.update(tenantMembers).set({ userId: auth.userId }).where(eq(tenantMembers.userId, shadow.id)),
                    db.update(subscriptions).set({ userId: auth.userId }).where(eq(subscriptions.userId, shadow.id)),
                    db.update(userRelationships).set({ parentUserId: auth.userId }).where(eq(userRelationships.parentUserId, shadow.id)),
                    db.update(userRelationships).set({ childUserId: auth.userId }).where(eq(userRelationships.childUserId, shadow.id)),
                    db.delete(users).where(eq(users.id, shadow.id))
                ]);
            } else {
                await db.insert(users).values({ id: auth.userId, email, profile: prof, createdAt: new Date() }).run();
            }

            user = await db.query.users.findFirst({ where: eq(users.id, auth.userId), with: { memberships: { with: { tenant: true, roles: true } } } });
        } catch (e: any) { return c.json({ error: e.message }, 500); }
    }

    if (!user) return c.json({ error: 'Load failed' }, 500);

    return c.json({
        id: user.id, email: user.email, firstName: (user.profile as any)?.firstName, lastName: (user.profile as any)?.lastName,
        portraitUrl: (user.profile as any)?.portraitUrl, isPlatformAdmin: user.isPlatformAdmin, role: user.role,
        tenants: user.memberships.map(m => ({ id: m.tenant.id, name: m.tenant.name, slug: m.tenant.slug, roles: m.roles.map(r => r.role), branding: m.tenant.branding }))
    });
});

// GET /me/family
app.get('/me/family', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const rels = await db.query.userRelationships.findMany({ where: eq(userRelationships.parentUserId, auth.userId) });
    const ids = rels.map(r => r.childUserId);
    if (ids.length === 0) return c.json({ family: [] });

    const children = await db.query.users.findMany({ where: inArray(users.id, ids) });
    const tenant = c.get('tenant');
    let memMap = new Map<string, string>();
    if (tenant) {
        const mems = await db.query.tenantMembers.findMany({ where: and(eq(tenantMembers.tenantId, tenant.id), inArray(tenantMembers.userId, ids)) });
        mems.forEach(m => memMap.set(m.userId, m.id));
    }

    return c.json({ family: children.map(ch => ({ userId: ch.id, firstName: (ch.profile as any)?.firstName, lastName: (ch.profile as any)?.lastName, dob: ch.dob, memberId: memMap.get(ch.id) || null })) });
});

// POST /me/family
app.post('/me/family', async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    if (!auth?.userId || !tenant) return c.json({ error: 'Unauthorized/No tenant' }, 401);
    const { firstName, lastName, dob } = await c.req.json();
    if (!firstName) return c.json({ error: 'Name required' }, 400);

    const db = createDb(c.env.DB);
    const childId = crypto.randomUUID();
    await db.insert(users).values({ id: childId, email: `child-${childId}@placeholder.studio`, profile: { firstName, lastName }, dob: dob ? new Date(dob) : null, isMinor: true, createdAt: new Date() }).run();
    await db.insert(userRelationships).values({ id: crypto.randomUUID(), parentUserId: auth.userId, childUserId: childId, type: 'parent_child', createdAt: new Date() }).run();
    const mid = crypto.randomUUID();
    await db.insert(tenantMembers).values({ id: mid, tenantId: tenant.id, userId: childId, profile: { firstName, lastName }, status: 'active', joinedAt: new Date() }).run();
    await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: 'student' }).run();

    return c.json({ success: true, child: { userId: childId, memberId: mid, firstName, lastName } }, 201);
});

// POST /me/switch-profile
app.post('/me/switch-profile', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const { targetUserId } = await c.req.json();
    const realId = auth.claims.impersonatorId || auth.userId;

    if (targetUserId === realId) return c.json({ token: null, isSelf: true });

    const db = createDb(c.env.DB);
    const rel = await db.query.userRelationships.findFirst({ where: and(eq(userRelationships.parentUserId, realId), eq(userRelationships.childUserId, targetUserId)) });
    if (!rel) return c.json({ error: 'Forbidden' }, 403);

    const { sign } = await import('hono/jwt');
    const token = await sign({ sub: targetUserId, impersonatorId: realId, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }, c.env.CLERK_SECRET_KEY as string);
    return c.json({ token });
});

// GET /session-info
app.get('/session-info', (c) => c.json({ userId: c.get('auth')?.userId, isImpersonating: !!c.get('isImpersonating'), impersonatorId: c.get('auth')?.claims?.impersonatorId }));

// POST /push-token
app.post('/push-token', async (c) => {
    let token;
    try {
        const body = await c.req.json();
        token = body.token;
    } catch (e) {
        return c.json({ error: 'Invalid JSON' }, 400);
    }
    if (!token) return c.json({ error: 'Token required' }, 400);
    const db = createDb(c.env.DB);
    await db.update(users).set({ pushToken: token }).where(eq(users.id, c.get('auth')!.userId)).run();
    return c.json({ success: true });
});

// PUT /me/settings/notifications
app.put('/me/settings/notifications', async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    if (!auth?.userId || !tenant) return c.json({ error: 'Context required' }, 401);
    const { notifications } = await c.req.json();

    const db = createDb(c.env.DB);
    const mem = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!mem) return c.json({ error: 'Member not found' }, 404);

    const s = { ...(mem.settings as any || {}), notifications: { ...((mem.settings as any)?.notifications || {}), substitutions: { ...((mem.settings as any)?.notifications?.substitutions || {}), ...notifications?.substitutions } } };
    await db.update(tenantMembers).set({ settings: s }).where(eq(tenantMembers.id, mem.id)).run();
    return c.json({ success: true, settings: s });
});

// GET /me/settings/notifications
app.get('/me/settings/notifications', async (c) => {
    const auth = c.get('auth');
    const tenant = c.get('tenant');
    if (!auth?.userId || !tenant) return c.json({ error: 'Context required' }, 401);
    const db = createDb(c.env.DB);
    const mem = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!mem) return c.json({ error: 'Member not found' }, 404);
    return c.json({ settings: mem.settings });
});

// DELETE /me
app.delete('/me', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = createDb(c.env.DB);
    const userId = auth.userId;

    // 1. Fetch User to get Stripe Info
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) return c.json({ error: 'User not found' }, 404);

    // 2. Cancel Stripe Subscriptions
    if (user.stripeCustomerId && c.env.STRIPE_SECRET_KEY) {
        try {
            const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);
            // List all active subscriptions
            const subs = await stripeService.listActiveSubscriptions(user.stripeCustomerId);

            // Cancel each one
            for (const sub of subs.data) {
                console.log(`Cancelling subscription ${sub.id} for user ${userId} (Account Deletion)`);
                await stripeService.cancelSubscription(sub.id, false); // false = immediate cancellation
            }
        } catch (e) {
            console.error("Error cancelling Stripe subscriptions during account deletion", e);
            // We continue with deletion even if Stripe fails, but log it.
            // Ideally we might want to halt, but blocking deletion due to 3rd party error is bad UX.
        }
    }

    // 3. Check if user is the ONLY owner of any tenant
    // This prevents stranding a tenant without an admin.
    // For MVP Beta: We will skip this check or just warn in UI. 
    // Implementing a basic check:
    const userWithRoles = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            memberships: {
                with: {
                    roles: true,
                    tenant: true
                }
            }
        }
    });

    const ownedTenants = userWithRoles?.memberships.filter(m => m.roles.some(r => r.role === 'owner')).map(m => m.tenant) || [];

    // Strategy: If they own tenants, we might want to soft-delete or block.
    // For now, we proceed with deletion of the USER, but usually we'd want to handle the Tenant implications.
    // Apple requires deletion. 

    try {
        await db.batch([
            // Delete Tenant Memberships (Cascades roles usually, but manual here to be safe)
            db.delete(tenantRoles).where(inArray(tenantRoles.memberId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.userId, userId)))),
            db.delete(tenantMembers).where(eq(tenantMembers.userId, userId)),

            // Delete Relationships
            db.delete(userRelationships).where(or(eq(userRelationships.parentUserId, userId), eq(userRelationships.childUserId, userId))),

            // Delete Subscriptions
            db.delete(subscriptions).where(eq(subscriptions.userId, userId)),

            // Delete User Record
            db.delete(users).where(eq(users.id, userId))
        ]);

        // Attempt to delete from Auth Provider (Clerk/etc)
        // This requires a Secret Key and backend API call. 
        if (c.env.CLERK_SECRET_KEY) {
            try {
                await fetch(`https://api.clerk.com/v1/users/${userId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${c.env.CLERK_SECRET_KEY}` }
                });
            } catch (e) {
                console.error("Failed to delete from Clerk", e);
                // Continue, as local data is gone.
            }
        }

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
