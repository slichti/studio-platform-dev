import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requireFeature } from '../middleware/tenant';

const app = new Hono<{ Bindings: any; Variables: any }>();

// --- PUBLIC ROUTES (no auth required) ---
// These must be defined BEFORE the auth middleware is applied

// Get single PUBLISHED page by slug (public access for /site/ route)
app.get('/public/pages/:slug', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantSlug = c.req.header('X-Tenant-Slug');

    if (!tenantSlug) {
        return c.json({ error: 'Tenant slug required' }, 400);
    }

    // First get tenant by slug
    const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.slug, tenantSlug),
    });

    if (!tenant) {
        return c.json({ error: 'Tenant not found' }, 404);
    }

    const slug = c.req.param('slug');

    // Only return PUBLISHED pages
    const page = await db.query.websitePages.findFirst({
        where: and(
            eq(schema.websitePages.tenantId, tenant.id),
            eq(schema.websitePages.slug, slug),
            eq(schema.websitePages.isPublished, true)
        ),
    });

    if (!page) {
        return c.json({ error: 'Page not found' }, 404);
    }

    const settings = (tenant.settings as any) || {};

    return c.json({ ...page, tenantSettings: settings });
});

// --- AUTHENTICATED ROUTES ---
// Apply auth & tenant middleware
app.use('/*', authMiddleware);
app.use('/*', tenantMiddleware);
app.use('/*', requireFeature('website_builder'));

// --- Pages CRUD ---

// List all pages for tenant
app.get('/pages', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');

    const pages = await db.query.websitePages.findMany({
        where: eq(schema.websitePages.tenantId, tenantId),
        orderBy: (pages, { asc }) => [asc(pages.slug)],
    });

    return c.json(pages);
});

// Get single page by slug
app.get('/pages/:slug', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const slug = c.req.param('slug');

    const page = await db.query.websitePages.findFirst({
        where: and(
            eq(schema.websitePages.tenantId, tenantId),
            eq(schema.websitePages.slug, slug)
        ),
    });

    if (!page) {
        return c.json({ error: 'Page not found' }, 404);
    }

    const tenant = c.get('tenant');
    const settings = (tenant?.settings as any) || {};

    return c.json({ ...page, tenantSettings: settings });
});

// Create new page
app.post('/pages', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const body = await c.req.json<{
        slug: string;
        title: string;
        content?: any;
        seoTitle?: string;
        seoDescription?: string;
    }>();

    if (!body.slug || !body.title) {
        return c.json({ error: 'slug and title are required' }, 400);
    }

    // Check for existing slug
    const existing = await db.query.websitePages.findFirst({
        where: and(
            eq(schema.websitePages.tenantId, tenantId),
            eq(schema.websitePages.slug, body.slug)
        ),
    });

    if (existing) {
        return c.json({ error: 'Page with this slug already exists' }, 409);
    }

    const id = crypto.randomUUID();
    await db.insert(schema.websitePages).values({
        id,
        tenantId,
        slug: body.slug,
        title: body.title,
        content: body.content || { root: { props: {}, children: [] } },
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        isPublished: false,
    });

    const created = await db.query.websitePages.findFirst({
        where: eq(schema.websitePages.id, id),
    });

    return c.json(created, 201);
});

// Update page (includes saving Puck JSON content)
app.put('/pages/:id', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');
    const body = await c.req.json<{
        title?: string;
        slug?: string;
        content?: any;
        seoTitle?: string;
        seoDescription?: string;
    }>();

    // Verify ownership
    const existing = await db.query.websitePages.findFirst({
        where: and(
            eq(schema.websitePages.id, id),
            eq(schema.websitePages.tenantId, tenantId)
        ),
    });

    if (!existing) {
        return c.json({ error: 'Page not found' }, 404);
    }

    await db.update(schema.websitePages)
        .set({
            ...body,
            updatedAt: new Date(),
        })
        .where(eq(schema.websitePages.id, id));

    const updated = await db.query.websitePages.findFirst({
        where: eq(schema.websitePages.id, id),
    });

    return c.json(updated);
});

// Publish/unpublish page
app.post('/pages/:id/publish', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');
    const body = await c.req.json<{ isPublished: boolean }>();

    // Verify ownership
    const existing = await db.query.websitePages.findFirst({
        where: and(
            eq(schema.websitePages.id, id),
            eq(schema.websitePages.tenantId, tenantId)
        ),
    });

    if (!existing) {
        return c.json({ error: 'Page not found' }, 404);
    }

    await db.update(schema.websitePages)
        .set({
            isPublished: body.isPublished,
            updatedAt: new Date(),
        })
        .where(eq(schema.websitePages.id, id));

    return c.json({ success: true, isPublished: body.isPublished });
});

// Delete page
app.delete('/pages/:id', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');

    // Verify ownership
    const existing = await db.query.websitePages.findFirst({
        where: and(
            eq(schema.websitePages.id, id),
            eq(schema.websitePages.tenantId, tenantId)
        ),
    });

    if (!existing) {
        return c.json({ error: 'Page not found' }, 404);
    }

    await db.delete(schema.websitePages).where(eq(schema.websitePages.id, id));

    return c.json({ success: true });
});

// --- Website Settings ---

// Get settings
app.get('/settings', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');

    let settings = await db.query.websiteSettings.findFirst({
        where: eq(schema.websiteSettings.tenantId, tenantId),
    });

    // Create default if not exists
    if (!settings) {
        const id = crypto.randomUUID();
        await db.insert(schema.websiteSettings).values({
            id,
            tenantId,
            theme: { primaryColor: '#3b82f6', fontFamily: 'Inter' },
            navigation: [],
        });
        settings = await db.query.websiteSettings.findFirst({
            where: eq(schema.websiteSettings.id, id),
        });
    }

    return c.json(settings);
});

// Update settings
app.put('/settings', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const body = await c.req.json<{
        domain?: string;
        theme?: any;
        navigation?: any;
        globalStyles?: any;
    }>();

    // Ensure settings exist
    let settings = await db.query.websiteSettings.findFirst({
        where: eq(schema.websiteSettings.tenantId, tenantId),
    });

    if (!settings) {
        const id = crypto.randomUUID();
        await db.insert(schema.websiteSettings).values({
            id,
            tenantId,
            ...body,
        });
        settings = await db.query.websiteSettings.findFirst({
            where: eq(schema.websiteSettings.id, id),
        });
    } else {
        await db.update(schema.websiteSettings)
            .set({
                ...body,
                updatedAt: new Date(),
            })
            .where(eq(schema.websiteSettings.tenantId, tenantId));

        settings = await db.query.websiteSettings.findFirst({
            where: eq(schema.websiteSettings.tenantId, tenantId),
        });
    }

    return c.json(settings);
});

export default app;
