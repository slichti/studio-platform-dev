import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';

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

    // TODO: Implement actual sync logic based on provider
    // For now, just return success
    console.log(`[Integrations] Manual sync triggered for ${provider}`);

    return c.json({
        success: true,
        message: `Sync initiated for ${provider}. This feature is coming soon.`
    });
});

// POST /mailchimp/sync-members - Sync members to Mailchimp list
app.post('/mailchimp/sync-members', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const settings = tenant.settings as any || {};
    const mailchimpConfig = settings.integrations?.mailchimp;

    if (!mailchimpConfig?.isActive) {
        return c.json({ error: 'Mailchimp integration not configured' }, 400);
    }

    // TODO: Implement Mailchimp API sync
    // This would fetch all active members and sync to Mailchimp list
    console.log('[Mailchimp] Member sync initiated');

    return c.json({
        success: true,
        message: 'Mailchimp sync queued. Implementation coming soon.'
    });
});

// POST /google-calendar/export - Export class schedule to Google Calendar
app.post('/google-calendar/export', async (c) => {
    if (!c.get('can')('manage_settings')) return c.json({ error: 'Unauthorized' }, 403);

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const settings = tenant.settings as any || {};
    const googleConfig = settings.integrations?.google_calendar;

    if (!googleConfig?.isActive) {
        return c.json({ error: 'Google Calendar integration not configured' }, 400);
    }

    // TODO: Implement Google Calendar API export
    // This would export all upcoming classes to a Google Calendar
    console.log('[Google Calendar] Export initiated');

    return c.json({
        success: true,
        message: 'Google Calendar export queued. Implementation coming soon.'
    });
});

export default app;
