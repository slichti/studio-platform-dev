import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema'; // users not used directly in modified code? Check usage.
import { eq } from 'drizzle-orm';
import { HonoContext } from '../types';
import { ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = new OpenAPIHono<HonoContext>();

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

// GET /mobile-config
app.openapi(createRoute({
    method: 'get',
    path: '/mobile-config',
    tags: ['Mobile'],
    summary: 'Get mobile config',
    responses: {
        200: { content: { 'application/json': { schema: MobileConfigSchema } }, description: 'Config found' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Forbidden' }
    }
}), async (c) => {
    // Allow any authenticated user to view mobile config (it's needed for mobile app)
    // if (!c.get('auth')?.userId) return c.json({ error: "Unauthorized" } as any, 401);
    // Tenant middleware ensures we have a tenant

    const tenant = c.get('tenant')!;
    const s = (tenant.settings as any) || {};

    return c.json(s.mobileConfig || {
        enabled: false,
        theme: { primaryColor: (tenant.branding as any)?.primaryColor || '#000000', darkMode: false },
        features: { booking: true, shop: true, vod: true, profile: true },
        links: { iosStore: '', androidStore: '' }
    }, 200);
});

// PUT /mobile-config
app.openapi(createRoute({
    method: 'put',
    path: '/mobile-config',
    tags: ['Mobile'],
    summary: 'Update mobile config',
    request: {
        body: { content: { 'application/json': { schema: MobileConfigSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: SuccessResponseSchema } }, description: 'Updated' },
        403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Forbidden' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' }
    }
}), async (c) => {
    if (!c.get('can')('manage_tenant')) return c.json({ error: 'Forbidden' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    await db.update(tenants).set({ settings: { ...(tenant.settings as any || {}), mobileConfig: c.req.valid('json') } }).where(eq(tenants.id, tenant.id)).run();
    return c.json({ success: true }, 200);
});

export default app;
