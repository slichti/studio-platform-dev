import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from 'db/src/schema';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: any; Variables: any }>();

// Require authentication for all routes
// Require authentication for all routes
// app.use('/*', authMiddleware); // REMOVED: We need optional auth for public viewing

// Verify platform admin for write operations
const requirePlatformAdmin = async (c: any, next: any) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = drizzle(c.env.DB, { schema });
    const user = await db.query.users.findFirst({
        where: eq(schema.users.id, auth.userId),
    });

    if (!user?.isPlatformAdmin) {
        return c.json({ error: 'Platform admin access required' }, 403);
    }

    await next();
};

// --- Platform Pages CRUD ---

// List all platform pages
app.get('/pages', optionalAuthMiddleware, async (c) => {
    const db = drizzle(c.env.DB, { schema });

    const pages = await db.query.platformPages.findMany({
        orderBy: (pages: any, { asc }: any) => [asc(pages.slug)],
    });

    return c.json(pages);
});

// Get single page by slug (public for rendering)
app.get('/pages/:slug', optionalAuthMiddleware, async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const slug = c.req.param('slug');

    const page = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.slug, slug),
    });

    if (!page) {
        return c.json({ error: 'Page not found' }, 404);
    }

    // Check publication status
    const auth = c.get('auth');
    if (!page.isPublished && !auth?.userId) {
        return c.json({ error: 'Page not found' }, 404);
    }

    return c.json(page);
});

// Create new page (admin only)
app.post('/pages', authMiddleware, requirePlatformAdmin, async (c) => {
    const db = drizzle(c.env.DB, { schema });
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
    const existing = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.slug, body.slug),
    });

    if (existing) {
        return c.json({ error: 'Page with this slug already exists' }, 409);
    }

    const id = crypto.randomUUID();
    await db.insert(schema.platformPages).values({
        id,
        slug: body.slug,
        title: body.title,
        content: body.content || { root: { props: {} }, content: [] },
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        isPublished: false,
    });

    const created = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.id, id),
    });

    return c.json(created, 201);
});

// Update page (admin only)
app.put('/pages/:id', authMiddleware, requirePlatformAdmin, async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const id = c.req.param('id');
    const body = await c.req.json<{
        title?: string;
        slug?: string;
        content?: any;
        seoTitle?: string;
        seoDescription?: string;
    }>();

    const existing = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.id, id),
    });

    if (!existing) {
        return c.json({ error: 'Page not found' }, 404);
    }

    await db.update(schema.platformPages)
        .set({
            ...body,
            updatedAt: new Date(),
        })
        .where(eq(schema.platformPages.id, id));

    const updated = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.id, id),
    });

    return c.json(updated);
});

// Publish/unpublish page (admin only)
app.post('/pages/:id/publish', authMiddleware, requirePlatformAdmin, async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const id = c.req.param('id');
    const body = await c.req.json<{ isPublished: boolean }>();

    const existing = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.id, id),
    });

    if (!existing) {
        return c.json({ error: 'Page not found' }, 404);
    }

    await db.update(schema.platformPages)
        .set({
            isPublished: body.isPublished,
            updatedAt: new Date(),
        })
        .where(eq(schema.platformPages.id, id));

    return c.json({ success: true, isPublished: body.isPublished });
});

// Delete page (admin only)
app.delete('/pages/:id', authMiddleware, requirePlatformAdmin, async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const id = c.req.param('id');

    const existing = await db.query.platformPages.findFirst({
        where: eq(schema.platformPages.id, id),
    });

    if (!existing) {
        return c.json({ error: 'Page not found' }, 404);
    }

    await db.delete(schema.platformPages).where(eq(schema.platformPages.id, id));

    return c.json({ success: true });
});

export default app;
