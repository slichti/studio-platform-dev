import { Hono } from 'hono';
import { tenants } from 'db/src/schema'; // Ensure proper export from db/src/index.ts
import { createDb } from '../db';
import { eq } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    STRIPE_CLIENT_ID: string;
};

import { StripeService } from '../services/stripe';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/stripe/connect', async (c) => {
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
    const clientId = c.env.STRIPE_CLIENT_ID;
    const redirectUri = `${new URL(c.req.url).origin}/studios/stripe/callback`;

    // Use a random state (in production, store and verify this to prevent CSRF)
    const state = crypto.randomUUID();
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    const url = stripe.getConnectUrl(clientId, redirectUri, tenantId);
    return c.redirect(url);
});

app.get('/stripe/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state'); // tenantId
    const error = c.req.query('error');

    if (error) return c.json({ error }, 400);
    if (!code || !state) return c.json({ error: 'Missing code or state' }, 400);

    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
    const db = createDb(c.env.DB);

    try {
        const stripeAccountId = await stripe.connectAccount(code);

        await db.update(tenants)
            .set({ stripeAccountId })
            .where(eq(tenants.id, state))
            .run();

        return c.text('Stripe account connected! You can close this window and refresh your dashboard.');
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const { name, slug } = body;

    const id = crypto.randomUUID();

    try {
        await db.insert(tenants).values({
            id,
            name,
            slug,
        });
        return c.json({ id, name, slug }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    const result = await db.select().from(tenants).where(eq(tenants.id, id)).get();

    if (!result) return c.json({ error: 'Studio not found' }, 404);
    return c.json(result);
});

export default app;
