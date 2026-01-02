import { Hono } from 'hono';
import { tenants } from 'db/src/schema'; // Ensure proper export from db/src/index.ts
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { tenantMiddleware } from '../middleware/tenant';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    STRIPE_CLIENT_ID: string;
    ENCRYPTION_SECRET: string;
};

import { StripeService } from '../services/stripe';
import { EncryptionUtils } from '../utils/encryption';

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

    const { z } = await import('zod');
    const createStudioSchema = z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric"),
    });

    const parseResult = createStudioSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }
    const { name, slug } = parseResult.data;

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

app.put('/:id/integrations', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();
    // Support partial updates
    const {
        paymentProvider,
        stripePublishableKey,
        stripeSecretKey,
        resendApiKey,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber,
        zoomAccountId,
        zoomClientId,
        zoomClientSecret
    } = body;

    // TODO: Verify ownership/permissions

    const updateData: any = {};
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET || 'default-secret-change-me-in-prod-at-least-32-chars');

    // 1. Stripe Configuration
    if (paymentProvider) {
        updateData.paymentProvider = paymentProvider;
    }

    if (stripePublishableKey && stripeSecretKey) {
        // Only update if both provided, or handle partial? 
        // Let's assume frontend sends both for now on update.
        // In real app, might want to allow updating just one but that's rare for keys.
        const encryptedSecret = await encryption.encrypt(stripeSecretKey);
        updateData.stripeCredentials = {
            publishableKey: stripePublishableKey,
            secretKey: encryptedSecret // Encrypt Secret Key!
        };
    }

    // 2. Resend Configuration (Email)
    if (resendApiKey) {
        const encryptedKey = await encryption.encrypt(resendApiKey);
        updateData.resendCredentials = {
            apiKey: encryptedKey
        };
    }

    // 3. Twilio Configuration (SMS)
    if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
        const encryptedToken = await encryption.encrypt(twilioAuthToken);
        updateData.twilioCredentials = {
            accountSid: twilioAccountSid,
            authToken: encryptedToken,
            fromNumber: twilioFromNumber
        };
    }

    // 4. Zoom Configuration
    if (zoomAccountId && zoomClientId && zoomClientSecret) {
        const encryptedSecret = await encryption.encrypt(zoomClientSecret);
        updateData.zoomCredentials = {
            accountId: zoomAccountId,
            clientId: zoomClientId,
            clientSecret: encryptedSecret
        };
    }

    if (Object.keys(updateData).length === 0) {
        return c.json({ message: "No changes detected" });
    }

    await db.update(tenants)
        .set(updateData)
        .where(eq(tenants.id, id))
        .run();

    return c.json({ success: true });
});

export default app;
