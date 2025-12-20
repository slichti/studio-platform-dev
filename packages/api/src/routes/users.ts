import { Hono } from 'hono';
import { users } from 'db/src/schema';
import { createDb } from '../db';
import { eq } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get('/me', async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get('auth').userId;

    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const user = await db.select().from(users).where(eq(users.id, userId)).get();

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
});

app.put('/me/profile', async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get('auth').userId;

    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();

    // Validate body? For now trust client/allow flexible json
    const { phoneNumber, address, contactPreferences } = body;

    // Fetch existing user to merge profile
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return c.json({ error: 'User not found' }, 404);

    const existingProfile = (user.profile as Record<string, any>) || {};

    const newProfile = {
        ...existingProfile,
        phoneNumber,
        address,
        contactPreferences
    };

    await db.update(users)
        .set({ profile: newProfile })
        .where(eq(users.id, userId))
        .run();

    return c.json({ success: true, profile: newProfile });
});

export default app;
