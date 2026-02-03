import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { tenants, tenantMembers, tenantRoles } from '@studio/db/src/schema'; // users not used directly in modified code? Check usage.
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { StripeService } from '../services/stripe';
import { EncryptionUtils } from '../utils/encryption';
import { StudioVariables } from '../types';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const StudioSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable().optional(),
    settings: z.record(z.string(), z.any()).optional(),
    branding: z.record(z.string(), z.any()).optional(),
    stripeAccountId: z.string().nullable().optional()
}).openapi('Studio');

const CreateStudioSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(3)
});

const ValidateSlugSchema = z.object({
    slug: z.string()
});

const UpdateIntegrationsSchema = z.object({
    marketingProvider: z.string().optional(),
    resendApiKey: z.string().optional(),
    twilioAccountSid: z.string().optional(),
    twilioAuthToken: z.string().optional(),
    twilioFromNumber: z.string().optional(),
    zoomAccountId: z.string().optional(),
    zoomClientId: z.string().optional(),
    zoomClientSecret: z.string().optional(),
    mailchimpApiKey: z.string().optional(),
    mailchimpServerPrefix: z.string().optional(),
    mailchimpListId: z.string().optional(),
    flodeskApiKey: z.string().optional(),
    slackWebhookUrl: z.string().optional(),
    slackBotToken: z.string().optional(),
    chatEnabled: z.boolean().optional(),
    chatConfig: z.record(z.string(), z.any()).optional()
});

const MobileConfigSchema = z.object({
    enabled: z.boolean(),
    theme: z.object({
        primaryColor: z.string(),
        darkMode: z.boolean()
    }),
    features: z.object({
        booking: z.boolean(),
        shop: z.boolean(),
        vod: z.boolean(),
        profile: z.boolean()
    }),
    links: z.object({
        iosStore: z.string().optional(),
        androidStore: z.string().optional()
    })
});


// --- Routes ---

// GET /stripe/connect (OAuth - kept as standard route)
app.get('/stripe/connect', async (c) => {
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" }, 403);

    const state = await sign({ tenantId, userId: c.get('auth')!.userId, exp: Math.floor(Date.now() / 1000) + 600 }, c.env.ENCRYPTION_SECRET as string, 'HS256');
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
    return c.redirect(stripe.getConnectUrl(c.env.STRIPE_CLIENT_ID as string, `${new URL(c.req.url).origin}/studios/stripe/callback`, state));
});

// GET /stripe/callback (OAuth - kept as standard route)
app.get('/stripe/callback', async (c) => {
    const { code, state, error } = c.req.query();
    if (error) return c.json({ error }, 400);
    if (!code || !state) return c.json({ error: 'Missing code or state' }, 400);

    let tenantId: string;
    try {
        const payload = await verify(state, c.env.ENCRYPTION_SECRET as string, 'HS256');
        tenantId = payload.tenantId as string;
    } catch (e) { return c.json({ error: "Invalid state" }, 400); }

    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
    const db = createDb(c.env.DB);
    try {
        const stripeAccountId = await stripe.connectAccount(code);
        await db.update(tenants).set({ stripeAccountId }).where(eq(tenants.id, tenantId)).run();
        return c.text('Stripe connected! Close this and refresh.');
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// POST / - Create Studio
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Studios'],
    summary: 'Create a new studio',
    request: {
        body: { content: { 'application/json': { schema: CreateStudioSchema } } }
    },
    responses: {
        201: { content: { 'application/json': { schema: StudioSchema } }, description: 'Studio created' },
        400: { description: 'Invalid input' },
        500: { description: 'Server error' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const { name, slug } = c.req.valid('json');
    const id = crypto.randomUUID();

    try {
        await db.insert(tenants).values({ id, name, slug }).run();
        const auth = c.get('auth');
        if (auth?.userId) {
            const memberId = crypto.randomUUID();
            await db.insert(tenantMembers).values({ id: memberId, tenantId: id, userId: auth.userId, status: 'active', joinedAt: new Date() }).run();
            await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId, role: 'owner' }).run();
        }
        return c.json({ id, name, slug }, 201);
    } catch (e: any) { return c.json({ error: e.message } as any, 500); }
});

// GET /:idOrSlug
app.openapi(createRoute({
    method: 'get',
    path: '/{idOrSlug}',
    tags: ['Studios'],
    summary: 'Get studio details',
    request: {
        params: z.object({ idOrSlug: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: StudioSchema } }, description: 'Studio found' },
        404: { description: 'Not found' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const p = c.req.valid('param').idOrSlug;
    let res = await db.select().from(tenants).where(eq(tenants.id, p)).get();
    if (!res) res = await db.select().from(tenants).where(eq(tenants.slug, p)).get();
    if (!res) return c.json({ error: 'Not found' } as any, 404);

    // Ensure all required fields for schema are present (handle nulls if schema requires non-nullable, but schema has lots of optionals)
    return c.json(res as any);
});

// POST /validate-slug
app.openapi(createRoute({
    method: 'post',
    path: '/validate-slug',
    tags: ['Studios'],
    summary: 'Validate studio slug',
    request: {
        body: { content: { 'application/json': { schema: ValidateSlugSchema } } }
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ valid: z.boolean(), error: z.string().optional() }) } },
            description: 'Validation result'
        }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const { slug } = c.req.valid('json');
    if (slug.length < 3) return c.json({ valid: false, error: 'Too short' });
    if (['admin', 'api', 'www', 'studio', 'app'].includes(slug.toLowerCase())) return c.json({ valid: false, error: 'Reserved' });
    const exists = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
    return c.json({ valid: !exists });
});

// PUT /:id/integrations
app.openapi(createRoute({
    method: 'put',
    path: '/{id}/integrations',
    tags: ['Studios'],
    summary: 'Update studio integrations',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: UpdateIntegrationsSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string().optional() }) } }, description: 'Updated' },
        403: { description: 'Forbidden' }
    }
}), async (c) => {
    const id = c.req.valid('param').id;
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' } as any, 403);

    const db = createDb(c.env.DB);
    const body = c.req.valid('json');
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET as string);
    const updateData: any = {};

    if (body.marketingProvider) updateData.marketingProvider = body.marketingProvider;
    if (body.resendApiKey) updateData.resendCredentials = { apiKey: await encryption.encrypt(body.resendApiKey) };
    if (body.twilioAccountSid && body.twilioAuthToken && body.twilioFromNumber) {
        updateData.twilioCredentials = { accountSid: body.twilioAccountSid, authToken: await encryption.encrypt(body.twilioAuthToken), fromNumber: body.twilioFromNumber };
    }
    if (body.zoomAccountId && body.zoomClientId && body.zoomClientSecret) {
        updateData.zoomCredentials = { accountId: body.zoomAccountId, clientId: body.zoomClientId, clientSecret: await encryption.encrypt(body.zoomClientSecret) };
    }
    if (body.mailchimpApiKey && body.mailchimpServerPrefix && body.mailchimpListId) {
        updateData.mailchimpCredentials = { apiKey: await encryption.encrypt(body.mailchimpApiKey), serverPrefix: body.mailchimpServerPrefix, listId: body.mailchimpListId };
    }
    if (body.flodeskApiKey) updateData.flodeskCredentials = { apiKey: await encryption.encrypt(body.flodeskApiKey) };
    if (body.slackWebhookUrl || body.slackBotToken) {
        updateData.slackCredentials = { webhookUrl: body.slackWebhookUrl, botToken: body.slackBotToken ? await encryption.encrypt(body.slackBotToken) : undefined };
    }

    if (body.chatEnabled !== undefined || body.chatConfig !== undefined) {
        const current = await db.select().from(tenants).where(eq(tenants.id, id)).get();
        updateData.settings = { ...(current?.settings as any || {}), ...(body.chatEnabled !== undefined && { chatEnabled: body.chatEnabled }), ...(body.chatConfig !== undefined && { chatConfig: body.chatConfig }) };
    }

    if (Object.keys(updateData).length === 0) return c.json({ success: true, message: "No change" });
    await db.update(tenants).set(updateData).where(eq(tenants.id, id)).run();
    return c.json({ success: true });
});

// GET /google/connect (OAuth - kept as standard route)
app.get('/google/connect', async (c) => {
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" }, 403);

    const { GoogleCalendarService } = await import('../services/google-calendar');
    const service = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID as string, c.env.GOOGLE_CLIENT_SECRET as string, `${new URL(c.req.url).origin}/studios/google/callback`);
    const state = await sign({ tenantId, userId: c.get('auth')!.userId, exp: Math.floor(Date.now() / 1000) + 600 }, c.env.ENCRYPTION_SECRET as string, 'HS256');
    return c.redirect(service.getAuthUrl(state));
});

// GET /google/callback (OAuth - kept as standard route)
app.get('/google/callback', async (c) => {
    const { code, state, error } = c.req.query();
    if (error || !code || !state) return c.json({ error: error || 'Missing params' }, 400);

    let tenantIdStr: string;
    try {
        const payload = await verify(state, c.env.ENCRYPTION_SECRET as string, 'HS256');
        if (payload.userId !== c.get('auth')?.userId) return c.json({ error: "User mismatch" }, 403);
        tenantIdStr = payload.tenantId as string;
    } catch (e) { return c.json({ error: "Invalid state" }, 400); }

    const { GoogleCalendarService } = await import('../services/google-calendar');
    const service = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID as string, c.env.GOOGLE_CLIENT_SECRET as string, `${new URL(c.req.url).origin}/studios/google/callback`);
    const db = createDb(c.env.DB);
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET as string);

    try {
        const tokens = await service.exchangeCode(code);
        const credentials: any = { accessToken: await encryption.encrypt(tokens.access_token), expiryDate: Date.now() + (tokens.expires_in * 1000) };
        if (tokens.refresh_token) credentials.refreshToken = await encryption.encrypt(tokens.refresh_token);
        await db.update(tenants).set({ googleCalendarCredentials: credentials }).where(eq(tenants.id, tenantIdStr)).run();
        return c.text('Google Calendar connected!');
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// DELETE /:id/integrations/google
app.openapi(createRoute({
    method: 'delete',
    path: '/{id}/integrations/google',
    tags: ['Studios'],
    summary: 'Disconnect Google Calendar',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Disconnected' },
        403: { description: 'Forbidden' }
    }
}), async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' } as any, 403);
    const db = createDb(c.env.DB);
    await db.update(tenants).set({ googleCalendarCredentials: null }).where(eq(tenants.id, c.req.valid('param').id)).run();
    return c.json({ success: true });
});

// GET /:id/mobile-config
app.openapi(createRoute({
    method: 'get',
    path: '/{id}/mobile-config',
    tags: ['Studios'],
    summary: 'Get mobile config',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: MobileConfigSchema } }, description: 'Config found' },
        404: { description: 'Not found' },
        403: { description: 'Forbidden' }
    }
}), async (c) => {
    const id = c.req.valid('param').id;
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('view_tenant')) return c.json({ error: "Forbidden" } as any, 403);

    const db = createDb(c.env.DB);
    const t = await db.select().from(tenants).where(eq(tenants.id, id)).get();
    if (!t) return c.json({ error: 'Not found' } as any, 404);
    const s = (t.settings as any) || {};
    return c.json(s.mobileConfig || { enabled: false, theme: { primaryColor: (t.branding as any)?.primaryColor || '#000000', darkMode: false }, features: { booking: true, shop: true, vod: true, profile: true }, links: { iosStore: '', androidStore: '' } });
});

// PUT /:id/mobile-config
app.openapi(createRoute({
    method: 'put',
    path: '/{id}/mobile-config',
    tags: ['Studios'],
    summary: 'Update mobile config',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: MobileConfigSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Updated' },
        403: { description: 'Forbidden' },
        404: { description: 'Not found' }
    }
}), async (c) => {
    const id = c.req.valid('param').id;
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' } as any, 403);

    const db = createDb(c.env.DB);
    const t = await db.select().from(tenants).where(eq(tenants.id, id)).get();
    if (!t) return c.json({ error: 'Not found' } as any, 404);

    await db.update(tenants).set({ settings: { ...(t.settings as any || {}), mobileConfig: c.req.valid('json') } }).where(eq(tenants.id, id)).run();
    return c.json({ success: true });
});

export default app;
