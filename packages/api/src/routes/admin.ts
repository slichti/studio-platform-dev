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

    // For MVP, we can trust a hardcoded email OR the isSuperAdmin flag if it was populated.
    // Let's use the DB flag since we added it.
    const db = createDb(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, auth.userId)).get();

    // Fallback for bootstrap: if no users are super admin, allow if email matches a specific env var?
    // Or just manually update the DB row for the first user.
    if (!user || !user.isSuperAdmin) {
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
        role: targetUser.role, // Propagate role
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
