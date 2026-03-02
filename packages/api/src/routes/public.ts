import { Hono } from 'hono';
import { createDb } from '../db';
import { platformPlans, tenants } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';
import { ResendManagementService } from '../services/resend';

const app = new Hono<{ Bindings: { DB: D1Database, RESEND_API_KEY: string } }>();

const ROBOTS_BASE_URL = 'https://studio-platform.com';

// GET /public/robots.txt — Platform defaults + per-tenant disallow overlay
app.get('/robots.txt', async (c) => {
    const db = createDb(c.env.DB);

    const lines: string[] = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /studio',
        'Disallow: /sign-in',
        'Disallow: /documentation',
        'Disallow: /create-studio',
        'Disallow: /accept-invite',
        '',
        `Sitemap: ${ROBOTS_BASE_URL}/sitemap.xml`,
    ];

    const activeTenants = await db.select({ slug: tenants.slug, settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.status, 'active'))
        .all();

    for (const t of activeTenants) {
        const seo = (t.settings as any)?.seo || {};
        const disallow = seo.robotsDisallow;
        if (Array.isArray(disallow) && disallow.length > 0) {
            const paths = disallow
                .map((p: string) => (typeof p === 'string' ? p.trim() : ''))
                .filter(Boolean)
                .map((p: string) => p.startsWith('/') ? p : `/${p}`);
            if (paths.length > 0) {
                lines.push('');
                lines.push(`# Tenant: ${t.slug}`);
                for (const path of paths) {
                    lines.push(`Disallow: /studios/${t.slug}${path}`);
                }
            }
        }
    }

    const body = lines.join('\n');
    return new Response(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
});

// GET /public/plans - List all active plans for public display
app.get('/plans', async (c) => {
    const db = createDb(c.env.DB);

    // Fetch only active plans
    // Optionally sort by price or a 'sortOrder' field if we add one later
    const plans = await db.select()
        .from(platformPlans)
        .where(eq(platformPlans.active, true))
        .all();

    // Transform if needed to hide internal IDs, but usually safe for public plans
    const publicPlans = plans.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        prices: {
            monthly: p.monthlyPriceCents,
            annual: p.annualPriceCents,
        },
        trialDays: p.trialDays,
        features: p.features,
        highlight: p.highlight
    }));

    return c.json(publicPlans);
});

// POST /public/newsletter/subscribe - Subscribe to a studio's newsletter
app.post('/newsletter/subscribe', async (c) => {
    try {
        const body = await c.req.json();
        const { email, slug } = body;

        if (!email || !slug) {
            return c.json({ success: false, error: 'Email and studio slug are required' }, 400);
        }

        const db = createDb(c.env.DB);

        // Find tenant by slug
        const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.slug, slug)
        });

        if (!tenant) {
            return c.json({ success: false, error: 'Studio not found' }, 404);
        }

        if (!tenant.resendNewsletterSegmentId) {
            return c.json({ success: false, error: 'This studio does not have a newsletter configured yet.' }, 400);
        }

        // Add to Resend audience
        const resendService = new ResendManagementService(c.env.RESEND_API_KEY, db as any);
        await resendService.addContactToAudience(tenant.id, email);

        return c.json({ success: true, message: 'Successfully subscribed' });
    } catch (error: any) {
        console.error('Newsletter subscription error:', error);
        return c.json({ success: false, error: error.message || 'Failed to subscribe to newsletter' }, 500);
    }
});

export default app;
