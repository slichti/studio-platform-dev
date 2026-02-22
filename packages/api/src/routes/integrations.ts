import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, gte } from 'drizzle-orm';
import { HonoContext } from '../types';
import { EncryptionUtils } from '../utils/encryption';

const app = new Hono<HonoContext>();

// Integration schema will be stored in tenant settings for now
// Future: Create dedicated integrations table

// GET / - List all integrations
app.get('/', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // Read integrations from tenant settings
    const settings = tenant.settings as any || {};
    const integrations = settings.integrations || {};

    return c.json({
        integrations: Object.entries(integrations).map(([provider, config]: [string, any]) => ({
            provider,
            isActive: config.isActive || false,
            lastSyncAt: config.lastSyncAt || null,
        }))
    });
});

// POST /:provider - Create/update integration
app.post('/:provider', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const provider = c.req.param('provider');
    const { config, isActive } = await c.req.json();

    // Validate provider
    const validProviders = ['mindbody', 'mailchimp', 'google_calendar', 'stripe_connect'];
    if (!validProviders.includes(provider)) {
        return c.json({ error: 'Invalid provider' }, 400);
    }

    // Update tenant settings with integration config
    const { tenants } = await import('@studio/db/src/schema');
    const currentSettings = tenant.settings as any || {};
    const integrations = currentSettings.integrations || {};

    integrations[provider] = {
        ...config,
        isActive: !!isActive,
        updatedAt: new Date().toISOString(),
    };

    await db.update(tenants)
        .set({
            settings: {
                ...currentSettings,
                integrations,
            }
        })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ success: true, provider });
});

// DELETE /:provider - Remove integration
app.delete('/:provider', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const provider = c.req.param('provider');

    const { tenants } = await import('@studio/db/src/schema');
    const currentSettings = tenant.settings as any || {};
    const integrations = currentSettings.integrations || {};

    delete integrations[provider];

    await db.update(tenants)
        .set({
            settings: {
                ...currentSettings,
                integrations,
            }
        })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ success: true });
});

// POST /:provider/sync - Trigger manual sync
app.post('/:provider/sync', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const provider = c.req.param('provider');
    const settings = tenant.settings as any || {};
    const integrations = settings.integrations || {};
    const integration = integrations[provider];

    if (!integration || !integration.isActive) {
        return c.json({ error: 'Integration not active' }, 400);
    }

    // Route to provider-specific sync handlers
    if (provider === 'mailchimp') {
        return c.redirect('/integrations/mailchimp/sync-members', 307);
    }
    if (provider === 'google_calendar') {
        return c.redirect('/integrations/google-calendar/export', 307);
    }

    return c.json({ success: true, message: `Sync for ${provider} is not yet implemented.` });
});

// POST /mailchimp/sync-members - Sync active members to Mailchimp audience list
app.post('/mailchimp/sync-members', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const creds = tenant.mailchimpCredentials as any;
    if (!creds?.apiKey || !creds?.listId) {
        return c.json({ error: 'Mailchimp API key and List ID are required. Configure them in Settings → Integrations.' }, 400);
    }

    const { apiKey, listId, serverPrefix } = creds;
    // Derive DC from api key suffix (e.g. "abc123-us10" → "us10")
    const dc = serverPrefix || apiKey.split('-').pop() || 'us1';

    const db = createDb(c.env.DB);
    const { tenantMembers, users } = await import('@studio/db/src/schema');

    const members = await db.select({
        email: users.email, profile: users.profile, status: tenantMembers.status
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.status, 'active')))
        .all();

    if (members.length === 0) return c.json({ success: true, synced: 0, message: 'No active members to sync.' });

    const operations = members.map((m: any) => {
        const profile = (m.profile as any) || {};
        return {
            method: 'PUT',
            path: `/lists/${listId}/members/${btoa(m.email.toLowerCase()).replace(/=/g, '')}`,
            body: JSON.stringify({
                email_address: m.email,
                status_if_new: 'subscribed',
                merge_fields: {
                    FNAME: profile.firstName || '',
                    LNAME: profile.lastName || '',
                },
            }),
        };
    });

    const batchRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/batches`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa(`anystring:${apiKey}`)}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operations }),
    });

    if (!batchRes.ok) {
        const err = await batchRes.json() as any;
        return c.json({ error: err.detail || 'Mailchimp API error' }, 500);
    }

    const batch = await batchRes.json() as any;

    // Update lastSyncAt in tenant settings
    const { tenants } = await import('@studio/db/src/schema');
    const currentSettings = tenant.settings as any || {};
    const integrations = currentSettings.integrations || {};
    integrations.mailchimp = { ...(integrations.mailchimp || {}), lastSyncAt: new Date().toISOString() };
    await db.update(tenants).set({ settings: { ...currentSettings, integrations } }).where(eq(tenants.id, tenant.id)).run();

    return c.json({ success: true, synced: members.length, batchId: batch.id });
});

// POST /google-calendar/export - Export upcoming class schedule to Google Calendar
app.post('/google-calendar/export', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const rawCreds = tenant.googleCalendarCredentials;
    if (!rawCreds) {
        return c.json({ error: 'Google Calendar not connected. Authenticate via Settings → Integrations → Google Calendar.' }, 400);
    }

    const encryptionSecret = (c.env.ENCRYPTION_SECRET as string) || '';
    if (!encryptionSecret) return c.json({ error: 'Encryption not configured' }, 500);

    let creds: any;
    try {
        creds = JSON.parse(rawCreds);
    } catch {
        return c.json({ error: 'Invalid Google Calendar credentials' }, 500);
    }

    const encryption = new EncryptionUtils(encryptionSecret);
    const { GoogleCalendarService } = await import('../services/google-calendar');
    const gcal = new GoogleCalendarService(
        c.env.GOOGLE_CLIENT_ID as string,
        c.env.GOOGLE_CLIENT_SECRET as string,
        `https://app.studiohq.io/api/integrations/google-calendar/callback`
    );

    // Refresh access token if expired
    let accessToken = await encryption.decrypt(creds.accessToken);
    if (!creds.expiryDate || Date.now() > creds.expiryDate - 60_000) {
        const refreshed = await gcal.refreshAccessToken(await encryption.decrypt(creds.refreshToken));
        accessToken = refreshed.access_token;
        // Persist updated token
        const { tenants } = await import('@studio/db/src/schema');
        const db = createDb(c.env.DB);
        const newCreds = { ...creds, accessToken: await encryption.encrypt(accessToken), expiryDate: refreshed.expiry_date };
        await db.update(tenants).set({ googleCalendarCredentials: JSON.stringify(newCreds) }).where(eq(tenants.id, tenant.id)).run();
    }

    // Fetch upcoming classes (next 30 days)
    const db = createDb(c.env.DB);
    const { classes, locations } = await import('@studio/db/src/schema');
    const now = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const upcomingClasses = await db.select({
        id: classes.id, title: classes.title, startTime: classes.startTime,
        durationMinutes: classes.durationMinutes, description: classes.description,
        locationId: classes.locationId,
    })
        .from(classes)
        .where(and(
            eq(classes.tenantId, tenant.id),
            gte(classes.startTime, now),
            // Drizzle uses JS Date for timestamp columns; cast for SQLite
        ))
        .limit(100)
        .all();

    let exported = 0;
    const calendarId = creds.calendarId || 'primary';

    for (const cls of upcomingClasses) {
        const startTime = cls.startTime as unknown as Date;
        const endMs = startTime.getTime() + ((cls.durationMinutes || 60) * 60 * 1000);
        const event = {
            summary: cls.title,
            description: cls.description || '',
            start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(endMs).toISOString(), timeZone: 'UTC' },
        };
        try {
            await gcal.createEvent(accessToken, calendarId, event);
            exported++;
        } catch {
            // Skip individual failures; best-effort export
        }
    }

    // Update lastExportAt in tenant settings
    const { tenants } = await import('@studio/db/src/schema');
    const currentSettings = tenant.settings as any || {};
    const integrations = currentSettings.integrations || {};
    integrations.google_calendar = { ...(integrations.google_calendar || {}), lastExportAt: new Date().toISOString() };
    await db.update(tenants).set({ settings: { ...currentSettings, integrations } }).where(eq(tenants.id, tenant.id)).run();

    return c.json({ success: true, exported, total: upcomingClasses.length });
});

export default app;
