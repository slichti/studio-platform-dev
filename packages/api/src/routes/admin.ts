import { Hono } from 'hono';
import { createDb } from '../db';
import { users, auditLogs, tenants } from 'db/src/schema'; // Ensure exported
import { eq, desc } from 'drizzle-orm';
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

export default app;
