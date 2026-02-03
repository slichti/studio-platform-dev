import { Hono } from 'hono';
import { createDb } from '../db';
import { users, tenants } from '@studio/db/src/schema';
import { eq, or, like, desc, sql } from 'drizzle-orm';
import { Variables, Bindings } from '../types';

const app = new Hono<{ Variables: Variables, Bindings: Bindings }>();

// [SECURITY] Enforce Platform Admin Access
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDb(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, auth.userId)).get();

    if (!user?.isPlatformAdmin && user?.role !== 'admin') {
        return c.json({ error: "Forbidden: Admin Access Required" }, 403);
    }

    await next();
});

// Global Search
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const query = c.req.query('q') || '';

    if (query.length < 2) {
        return c.json({ users: [], tenants: [] });
    }

    const searchPattern = `%${query}%`;

    // Search Users (by email or name)
    // Note: 'name' is stored as simple text or might be missing in 'users' table if it's in profile.
    // Based on schema, 'users' has 'profile' json and 'email'.
    // We'll search email for now as it's reliable.
    const foundUsers = await db.select({
        id: users.id,
        email: users.email,
        profile: users.profile,
        createdAt: users.createdAt
    })
        .from(users)
        .where(like(users.email, searchPattern))
        .limit(5)
        .all();

    // Search Tenants (by name or slug)
    const foundTenants = await db.select()
        .from(tenants)
        .where(or(
            like(tenants.name, searchPattern),
            like(tenants.slug, searchPattern)
        ))
        .limit(5)
        .all();

    return c.json({
        users: foundUsers.map(u => ({
            id: u.id,
            email: u.email,
            name: (u.profile as any)?.firstName ? `${(u.profile as any).firstName} ${(u.profile as any).lastName}` : 'N/A',
            type: 'user'
        })),
        tenants: foundTenants.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            type: 'tenant'
        }))
    });
});

export default app;
