import { Hono } from 'hono';
import { createDb } from '../db';
import { AggregatorService } from '../services/aggregators';
import { HonoContext } from '../types';
import * as schema from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

const app = new Hono<HonoContext>();

/**
 * Common feed endpoint used by both ClassPass and Gympass/Wellhub.
 * Partners can Filter via query params or tenant slug headers.
 */
app.get('/feed', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant'); // Resolved via middleware

    if (!tenant) return c.json({ error: 'Tenant context required' }, 404);

    // Verify feature is enabled
    const features = await db.query.tenantFeatures.findMany({
        where: eq(schema.tenantFeatures.tenantId, tenant.id)
    });

    const hasAnyAggregator = features.some(f => f.enabled && (f.featureKey === 'classpass' || f.featureKey === 'gympass'));
    if (!hasAnyAggregator) return c.json({ error: 'Integration not enabled' }, 403);

    const service = new AggregatorService(db, c.env, tenant.id);
    const schedule = await service.getScheduleFeed();

    return c.json({
        studio_id: tenant.id,
        studio_name: tenant.name,
        classes: schedule
    });
});

/**
 * ClassPass specific endpoint for Partner-specific verification if needed.
 */
app.get('/classpass/verify', async (c) => {
    return c.json({ status: 'connected', timestamp: new Date().toISOString() });
});

export default app;
