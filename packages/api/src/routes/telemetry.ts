import { Hono } from 'hono';
import { createDb } from '../db';
import { auditLogs, users } from 'db/src/schema'; // Reuse audit logs for now
import { eq } from 'drizzle-orm';
import type { HonoContext } from '../types';
import { optionalAuthMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: HonoContext['Bindings'], Variables: HonoContext['Variables'] }>();

// Use optional auth middleware to catch userId if logged in, but allow guests (login page errors)
app.use('*', optionalAuthMiddleware);

app.post('/client-error', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth'); // Optional context if logged in

    try {
        const { message, stack, url, userAgent } = await c.req.json();

        // Basic validation
        if (!message) return c.json({ error: "Message required" }, 400);

        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            action: 'client_error',
            actorId: auth?.userId || 'anonymous',
            targetId: 'system',
            details: {
                message,
                stack: stack ? stack.substring(0, 1000) : undefined, // Truncate
                url,
                userAgent
            },
            ipAddress: c.req.header('CF-Connecting-IP')
        }).run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
