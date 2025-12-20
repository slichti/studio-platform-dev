import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, desc } from 'drizzle-orm';
import { users, tenants, auditLogs } from 'db/src/schema'; // users might need explicit import if not exported? it was.
import { sign } from 'hono/jwt';

type Bindings = {
    DB: D1Database;
    CLERK_SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Bindings, Variables: any }>();

// Middleware to ensure Super Admin
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    if (!auth) return c.json({ error: 'Unauthorized' }, 401);

    const db = createDb(c.env.DB);
    let user = await db.select().from(users).where(eq(users.id, auth.userId)).get();

    // Bootstrap: Auto-promote specific email if not yet admin
    // This allows the initial owner to get access without manual DB hacks
    if (user && user.email === 'slichti@gmail.com' && !user.isSystemAdmin) {
        console.log(`Bootstrapping system admin for ${user.email}`);
        await db.update(users)
            .set({ isSystemAdmin: true })
            .where(eq(users.id, user.id))
            .run();
        // Refresh user record
        user = await db.select().from(users).where(eq(users.id, auth.userId)).get();
    }

    // Check system admin flag
    if (!user || !user.isSystemAdmin) {
        // Double check via email if user record missing? No, we need a user record.
        return c.json({ error: 'Forbidden: Admins only' }, 403);
    }

    await next();
});

app.get('/tenants', async (c) => {
    const db = createDb(c.env.DB);
    const results = await db.select().from(tenants).all();
    return c.json(results);
});

app.get('/logs', async (c) => {
    const db = createDb(c.env.DB);
    // Need to import auditLogs
    const { auditLogs } = await import('db/src/schema');
    const results = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
    return c.json(results);
});

app.get('/users', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.query('tenantId');

    if (tenantId) {
        // Get members of this tenant
        // We need to join with Users to get email/name
        // But schema.ts imports might need adjustment if we use join
        const { tenantMembers, users } = await import('db/src/schema');
        const members = await db.select({
            user: users,
            member: tenantMembers
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenantId))
            .all();

        return c.json(members);
    }

    // Default: List global users (limit 50)
    // const results = await db.select().from(users).limit(50).all(); 
    // Wait, 'users' variable is shadowed by the update in previous step? 
    // No, 'users' was imported at top level. 
    // But inside middleware I declared 'let user'. 
    // And here I am inside a handler. Usage of 'users' schema object should be fine if imported correctly.
    // However, I should probably re-import or clearer naming.
    const { users: usersSchema } = await import("db/src/schema");
    const results = await db.select().from(usersSchema).limit(50).all();
    return c.json(results);
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
    const { auditLogs } = await import('db/src/schema');
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
