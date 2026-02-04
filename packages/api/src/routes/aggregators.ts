import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { AggregatorService } from '../services/aggregators';
import { StudioVariables } from '../types';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../utils/errors';

const app = createOpenAPIApp<StudioVariables>();

const FeedItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    start_time: z.string(),
    duration: z.number(),
    capacity: z.number().nullable(),
    spots_remaining: z.number(),
    instructor_name: z.string(),
    location_name: z.string(),
    price: z.number(),
    currency: z.string()
}).openapi('FeedItem');

const FeedResponseSchema = z.object({
    studio_id: z.string(),
    studio_name: z.string(),
    classes: z.array(FeedItemSchema)
}).openapi('FeedResponse');

// Routes

app.openapi(createRoute({
    method: 'get',
    path: '/feed',
    tags: ['Aggregators'],
    summary: 'Aggregator schedule feed',
    responses: {
        200: { content: { 'application/json': { schema: FeedResponseSchema } }, description: 'Schedule feed' },
        403: { description: 'Integration not enabled' },
        404: { description: 'Tenant not found' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) throw new AppError('Tenant context required', 404, 'TENANT_REQUIRED');

    const features = await db.query.tenantFeatures.findMany({
        where: and(
            eq(schema.tenantFeatures.tenantId, tenant.id),
            eq(schema.tenantFeatures.enabled, true)
        )
    });

    const hasAnyAggregator = features.some(f => f.featureKey === 'classpass' || f.featureKey === 'gympass');
    if (!hasAnyAggregator) throw new AppError('Integration not enabled', 403, 'INTEGRATION_DISABLED');

    const service = new AggregatorService(db, c.env, tenant.id);
    const schedule = await service.getScheduleFeed();

    return c.json({
        studio_id: tenant.id,
        studio_name: tenant.name,
        classes: schedule
    } as any);
});

app.openapi(createRoute({
    method: 'get',
    path: '/classpass/verify',
    tags: ['Aggregators'],
    summary: 'ClassPass partner verification',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ status: z.string(), timestamp: z.string() }) } }, description: 'Verification status' }
    }
}), async (c) => {
    return c.json({ status: 'connected', timestamp: new Date().toISOString() });
});

export default app;
