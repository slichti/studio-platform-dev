import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { AggregatorService } from '../services/aggregators';
import { StudioVariables } from '../types';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { AppError, NotFoundError, UnauthorizedError } from '../utils/errors';

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

// LLM / GEO Snapshot schema – lightweight, machine-readable profile per studio
const LLMSnapshotSchema = z.object({
    studio: z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        business_type: z.string(),
        city: z.string().nullable(),
        region: z.string().nullable(),
        country: z.string().nullable(),
    }),
    classes: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        start_time: z.string(),
        duration_minutes: z.number(),
        instructor_name: z.string(),
        location_name: z.string(),
        booking_url: z.string().url(),
    }))
}).openapi('LLMSnapshot');

// Routes

app.openapi(createRoute({
    method: 'get',
    path: '/feed',
    tags: ['Aggregators'],
    summary: 'Aggregator schedule feed',
    responses: {
        200: { content: { 'application/json': { schema: FeedResponseSchema } }, description: 'Schedule feed' },
        403: { content: { 'application/json': { schema: z.object({ error: z.string(), code: z.string() }) } }, description: 'Integration not enabled' },
        404: { content: { 'application/json': { schema: z.object({ error: z.string(), code: z.string() }) } }, description: 'Tenant not found' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) throw new NotFoundError('Tenant context required');

    const features = await db.query.tenantFeatures.findMany({
        where: and(
            eq(schema.tenantFeatures.tenantId, tenant.id),
            eq(schema.tenantFeatures.enabled, true)
        )
    });

    const hasAnyAggregator = features.some(f => f.featureKey === 'classpass' || f.featureKey === 'gympass');
    if (!hasAnyAggregator) throw new UnauthorizedError('Integration not enabled');

    const service = new AggregatorService(db, c.env, tenant.id);
    const schedule = await service.getScheduleFeed();

    return c.json({
        studio_id: tenant.id,
        studio_name: tenant.name,
        classes: schedule
    } as any);
});

// LLM Snapshot – lightweight JSON feed for GEO / external LLMs
app.openapi(createRoute({
    method: 'get',
    path: '/llm-snapshot',
    tags: ['Aggregators'],
    summary: 'LLM snapshot of studio data (classes + location)',
    responses: {
        200: { content: { 'application/json': { schema: LLMSnapshotSchema } }, description: 'LLM snapshot JSON' },
        404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Tenant not found' }
    }
}), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) throw new NotFoundError('Tenant context required');

    const primaryLocation = await db.query.locations.findFirst({
        where: and(
            eq(schema.locations.tenantId, tenant.id),
            eq(schema.locations.isActive, true)
        )
    });

    // City/region/country: locations table has only `address`; use tenant SEO location or parse address
    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;
    const seoLocation = (tenant.settings as { seo?: { location?: string } } | null)?.seo?.location;
    if (seoLocation && typeof seoLocation === 'string') {
        const parts = seoLocation.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 1) city = parts[0];
        if (parts.length >= 2) region = parts[1];
        if (parts.length >= 3) country = parts[2];
        else if (parts.length >= 1) country = 'US';
    } else if (primaryLocation?.address) {
        const parts = primaryLocation.address.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            city = parts[parts.length - 2] ?? null;
            region = parts[parts.length - 1] ?? null;
            country = 'US';
        } else if (parts.length >= 1) {
            city = parts[0] ?? null;
        }
    }

    const service = new AggregatorService(db, c.env, tenant.id);
    const schedule = await service.getScheduleFeed();

    const classes = (schedule || []).slice(0, 25).map((cls: any) => ({
        id: String(cls.id),
        title: cls.title,
        description: cls.description ?? null,
        start_time: cls.start_time,
        duration_minutes: cls.duration,
        instructor_name: cls.instructor_name,
        location_name: cls.location_name,
        booking_url: `https://studio-platform.com/studios/${tenant.slug}/classes/${cls.id}`
    }));

    return c.json({
        studio: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            business_type: (tenant.seoConfig as any)?.businessType || 'fitness studio',
            city,
            region,
            country
        },
        classes
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
