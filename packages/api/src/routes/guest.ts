import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const app = new Hono<{ Bindings: any }>();

app.post('/token', async (c) => {
    const { name, email } = await c.req.json<{ name: string; email: string }>();

    if (!email) return c.json({ error: "Email required" }, 400);

    const guestId = `guest_${crypto.randomUUID()}`;

    // Sign with CLERK_SECRET_KEY (Symmetric)
    // This allows authMiddleware to verify it using the same secret
    const token = await sign({
        sub: guestId,
        email,
        name: name || 'Guest',
        role: 'guest',
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
    }, c.env.CLERK_SECRET_KEY);

    return c.json({ token, user: { id: guestId, email, name, role: 'guest' } });
});

export default app;
