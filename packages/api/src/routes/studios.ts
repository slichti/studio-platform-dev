import { Hono } from 'hono';
import { tenants } from 'db/src/schema'; // Ensure proper export from db/src/index.ts
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { tenantMiddleware } from '../middleware/tenant';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    STRIPE_CLIENT_ID: string;
    ENCRYPTION_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
};

type Variables = {
    auth: { userId: string; claims: any };
};

import { StripeService } from '../services/stripe';
import { EncryptionUtils } from '../utils/encryption';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

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

app.get('/:idOrSlug', async (c) => {
    const db = createDb(c.env.DB);
    const idOrSlug = c.req.param('idOrSlug');

    // 1. Try by ID (UUID format)
    let result = await db.select().from(tenants).where(eq(tenants.id, idOrSlug)).get();

    // 2. Try by Slug (if not found)
    if (!result) {
        result = await db.select().from(tenants).where(eq(tenants.slug, idOrSlug)).get();
    }

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
        zoomClientSecret,
        chatEnabled // Feature flag
    } = body;

    // [SECURITY] VERIFY OWNERSHIP (IDOR Fix)
    const auth = c.get('auth');
    if (!auth || !auth.userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check membership
    const { tenantMembers } = await import('db/src/schema');
    const { and } = await import('drizzle-orm');

    const membership = await db.select()
        .from(tenantMembers)
        .where(and(
            eq(tenantMembers.tenantId, id),
            eq(tenantMembers.userId, auth.userId)
        ))
        .get();

    if (!membership) {
        return c.json({ error: 'Forbidden: You do not have permission to manage this studio.' }, 403);
    }


    const updateData: any = {};
    if (!c.env.ENCRYPTION_SECRET) {
        throw new Error("Server Configuration Error: ENCRYPTION_SECRET is missing");
    }
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);

    // 1. Stripe Configuration
    if (paymentProvider) {
        updateData.paymentProvider = paymentProvider;
    }

    const { marketingProvider } = body;
    if (marketingProvider) {
        updateData.marketingProvider = marketingProvider;
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

    // 5. Mailchimp Configuration
    const { mailchimpApiKey, mailchimpServerPrefix, mailchimpListId } = body;
    if (mailchimpApiKey && mailchimpServerPrefix && mailchimpListId) {
        const encryptedKey = await encryption.encrypt(mailchimpApiKey);
        updateData.mailchimpCredentials = {
            apiKey: encryptedKey,
            serverPrefix: mailchimpServerPrefix,
            listId: mailchimpListId
        };
    }

    // 6. Zapier Configuration
    const { zapierWebhookUrl, zapierApiKey } = body;
    if (zapierWebhookUrl || zapierApiKey) {
        // Encrypt API key if present
        let encryptedKey;
        if (zapierApiKey) encryptedKey = await encryption.encrypt(zapierApiKey);
        updateData.zapierCredentials = {
            webhookUrl: zapierWebhookUrl,
            apiKey: encryptedKey
        };
    }

    // 7. Google Configuration
    const { googleClientId, googleMeasurementId } = body;
    if (googleClientId || googleMeasurementId) {
        updateData.googleCredentials = {
            clientId: googleClientId,
            measurementId: googleMeasurementId
        };

        // [SECURITY] INPUT SANITIZATION (Stored XSS Fix)
        if (googleMeasurementId) {
            // Allow G-XXXXXX (GA4) or UA-XXXXX-Y (Universal Analytics)
            const isValid = /^(G-[A-Z0-9]+|UA-\d+-\d+)$/i.test(googleMeasurementId);
            if (!isValid) {
                return c.json({ error: 'Invalid Google Measurement ID format. Expected G-XXXXXX or UA-XXXX-Y.' }, 400);
            }
        }
    }

    // 8. Flodesk Configuration
    const { flodeskApiKey } = body;
    if (flodeskApiKey) {
        const encryptedKey = await encryption.encrypt(flodeskApiKey);
        updateData.flodeskCredentials = {
            apiKey: encryptedKey
        };
    }

    // 8. Slack Configuration
    const { slackWebhookUrl, slackBotToken } = body;
    if (slackWebhookUrl || slackBotToken) {
        let encryptedToken;
        if (slackBotToken) encryptedToken = await encryption.encrypt(slackBotToken);
        updateData.slackCredentials = {
            webhookUrl: slackWebhookUrl,
            botToken: encryptedToken
        };
    }

    // 9. Chat Feature
    const { chatConfig } = body;
    if (chatEnabled !== undefined || chatConfig !== undefined) {
        // Fetch current settings to merge
        const currentTenant = await db.select().from(tenants).where(eq(tenants.id, id)).get();
        const currentSettings = (currentTenant?.settings as any) || {};

        updateData.settings = {
            ...currentSettings,
            ...(chatEnabled !== undefined && { chatEnabled }),
            ...(chatConfig !== undefined && { chatConfig })
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

app.get('/google/connect', async (c) => {
    const { GoogleCalendarService } = await import('../services/google-calendar');
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;

    // Construct Redirect URI based on request origin
    // NOTE: This must match what is authorized in Google Cloud Console
    const redirectUri = `${new URL(c.req.url).origin}/studios/google/callback`;

    if (!clientId || !clientSecret) return c.json({ error: 'Google credentials not configured' }, 500);

    const service = new GoogleCalendarService(clientId, clientSecret, redirectUri);
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    // [SECURITY] Generate Signed State (CSRF Protection)
    // We expect state to return unchanged. We embed tenantId and userId to verify ownership on return.
    const state = await sign({
        tenantId,
        userId: auth.userId,
        exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes expiry
    }, c.env.ENCRYPTION_SECRET, 'HS256');

    return c.redirect(service.getAuthUrl(state));
});

app.get('/google/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state'); // tenantId
    const error = c.req.query('error');

    if (error) return c.json({ error }, 400);
    if (!code || !state) return c.json({ error: 'Missing code or state' }, 400);

    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    // [SECURITY] Verify State
    let tenantId: string;
    try {
        const payload = await verify(state, c.env.ENCRYPTION_SECRET, 'HS256');
        if (payload.userId !== auth.userId) {
            return c.json({ error: "Security Check Failed: User mismatch" }, 403);
        }
        tenantId = payload.tenantId as string;
    } catch (e) {
        return c.json({ error: "Invalid or expired state token" }, 400);
    }

    const { GoogleCalendarService } = await import('../services/google-calendar');
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${new URL(c.req.url).origin}/studios/google/callback`;

    const service = new GoogleCalendarService(clientId, clientSecret, redirectUri);
    const db = createDb(c.env.DB);
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);

    try {
        const tokens = await service.exchangeCode(code);

        // Encrypt tokens before storage
        const encryptedAccess = await encryption.encrypt(tokens.access_token);
        const encryptedRefresh = tokens.refresh_token ? await encryption.encrypt(tokens.refresh_token) : undefined;

        const credentials: any = {
            accessToken: encryptedAccess,
            expiryDate: Date.now() + (tokens.expires_in * 1000)
        };

        if (encryptedRefresh) {
            credentials.refreshToken = encryptedRefresh;
        } else {
            // If no refresh token, try to keep existing? 
            // Ideally we shouldn't overwrite unless we got a new one or force re-consent.
            // If users revoke access, fetching existing is moot.
            // But if they just re-authed for scope, we might not get refresh token.
        }

        // We need to fetch existing to merge refresh token if not present?
        const existing = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
        if (existing?.googleCalendarCredentials) {
            const existingCreds = existing.googleCalendarCredentials as any;
            if (!credentials.refreshToken && existingCreds.refreshToken) {
                credentials.refreshToken = existingCreds.refreshToken;
            }
        }

        await db.update(tenants)
            .set({ googleCalendarCredentials: credentials })
            .where(eq(tenants.id, tenantId))
            .run();

        return c.text('Google Calendar connected! You can close this window.');
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.delete('/:id/integrations/google', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    // Verify auth?

    await db.update(tenants)
        .set({ googleCalendarCredentials: null })
        .where(eq(tenants.id, id))
        .run();

    return c.json({ success: true });
});

export default app;
