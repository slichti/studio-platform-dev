import { Hono } from 'hono';
import { tenants, tenantMembers, users, tenantRoles } from '@studio/db/src/schema';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { StripeService } from '../services/stripe';
import { EncryptionUtils } from '../utils/encryption';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /stripe/connect
app.get('/stripe/connect', async (c) => {
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" }, 403);

    const state = await sign({ tenantId, userId: c.get('auth')!.userId, exp: Math.floor(Date.now() / 1000) + 600 }, c.env.ENCRYPTION_SECRET, 'HS256');
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
    return c.redirect(stripe.getConnectUrl(c.env.STRIPE_CLIENT_ID, `${new URL(c.req.url).origin}/studios/stripe/callback`, state));
});

// GET /stripe/callback
app.get('/stripe/callback', async (c) => {
    const { code, state, error } = c.req.query();
    if (error) return c.json({ error }, 400);
    if (!code || !state) return c.json({ error: 'Missing code or state' }, 400);

    let tenantId: string;
    try {
        const payload = await verify(state, c.env.ENCRYPTION_SECRET, 'HS256');
        tenantId = payload.tenantId as string;
    } catch (e) { return c.json({ error: "Invalid state" }, 400); }

    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);
    const db = createDb(c.env.DB);
    try {
        const stripeAccountId = await stripe.connectAccount(code);
        await db.update(tenants).set({ stripeAccountId }).where(eq(tenants.id, tenantId)).run();
        return c.text('Stripe connected! Close this and refresh.');
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// POST / - Create Studio
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const { name, slug } = await c.req.json();
    if (!name || !slug) return c.json({ error: 'Missing name or slug' }, 400);
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
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// GET /:idOrSlug
app.get('/:idOrSlug', async (c) => {
    const db = createDb(c.env.DB);
    const p = c.req.param('idOrSlug');
    let res = await db.select().from(tenants).where(eq(tenants.id, p)).get();
    if (!res) res = await db.select().from(tenants).where(eq(tenants.slug, p)).get();
    if (!res) return c.json({ error: 'Not found' }, 404);
    return c.json(res);
});

// POST /validate-slug
app.post('/validate-slug', async (c) => {
    const db = createDb(c.env.DB);
    const { slug } = await c.req.json();
    if (!slug || slug.length < 3) return c.json({ valid: false, error: 'Too short' });
    if (['admin', 'api', 'www', 'studio', 'app'].includes(slug.toLowerCase())) return c.json({ valid: false, error: 'Reserved' });
    const exists = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
    return c.json({ valid: !exists });
});

// PUT /:id/integrations
app.put('/:id/integrations', async (c) => {
    const id = c.req.param('id');
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' }, 403);

    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
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

    if (Object.keys(updateData).length === 0) return c.json({ message: "No change" });
    await db.update(tenants).set(updateData).where(eq(tenants.id, id)).run();
    return c.json({ success: true });
});

// GET /google/connect
app.get('/google/connect', async (c) => {
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" }, 403);

    const { GoogleCalendarService } = await import('../services/google-calendar');
    const service = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, `${new URL(c.req.url).origin}/studios/google/callback`);
    const state = await sign({ tenantId, userId: c.get('auth')!.userId, exp: Math.floor(Date.now() / 1000) + 600 }, c.env.ENCRYPTION_SECRET, 'HS256');
    return c.redirect(service.getAuthUrl(state));
});

// GET /google/callback
app.get('/google/callback', async (c) => {
    const { code, state, error } = c.req.query();
    if (error || !code || !state) return c.json({ error: error || 'Missing params' }, 400);

    let tenantIdStr: string;
    try {
        const payload = await verify(state, c.env.ENCRYPTION_SECRET, 'HS256');
        if (payload.userId !== c.get('auth')?.userId) return c.json({ error: "User mismatch" }, 403);
        tenantIdStr = payload.tenantId as string;
    } catch (e) { return c.json({ error: "Invalid state" }, 400); }

    const { GoogleCalendarService } = await import('../services/google-calendar');
    const service = new GoogleCalendarService(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, `${new URL(c.req.url).origin}/studios/google/callback`);
    const db = createDb(c.env.DB);
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);

    try {
        const tokens = await service.exchangeCode(code);
        const credentials: any = { accessToken: await encryption.encrypt(tokens.access_token), expiryDate: Date.now() + (tokens.expires_in * 1000) };
        if (tokens.refresh_token) credentials.refreshToken = await encryption.encrypt(tokens.refresh_token);
        await db.update(tenants).set({ googleCalendarCredentials: credentials }).where(eq(tenants.id, tenantIdStr)).run();
        return c.text('Google Calendar connected!');
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// DELETE /:id/integrations/google
app.delete('/:id/integrations/google', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' }, 403);
    const db = createDb(c.env.DB);
    await db.update(tenants).set({ googleCalendarCredentials: null }).where(eq(tenants.id, c.req.param('id'))).run();
    return c.json({ success: true });
});

// GET /:id/mobile-config
app.get('/:id/mobile-config', async (c) => {
    const id = c.req.param('id');
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin && !c.get('can')('view_tenant')) return c.json({ error: "Forbidden" }, 403);

    const db = createDb(c.env.DB);
    const t = await db.select().from(tenants).where(eq(tenants.id, id)).get();
    if (!t) return c.json({ error: 'Not found' }, 404);
    const s = (t.settings as any) || {};
    return c.json(s.mobileConfig || { enabled: false, theme: { primaryColor: (t.branding as any)?.primaryColor || '#000000', darkMode: false }, features: { booking: true, shop: true, vod: true, profile: true }, links: { iosStore: '', androidStore: '' } });
});

// PUT /:id/mobile-config
app.put('/:id/mobile-config', async (c) => {
    const id = c.req.param('id');
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' }, 403);

    const db = createDb(c.env.DB);
    const t = await db.select().from(tenants).where(eq(tenants.id, id)).get();
    if (!t) return c.json({ error: 'Not found' }, 404);

    await db.update(tenants).set({ settings: { ...(t.settings as any || {}), mobileConfig: await c.req.json() } }).where(eq(tenants.id, id)).run();
    return c.json({ success: true });
});

export default app;
