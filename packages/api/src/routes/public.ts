import { Hono } from 'hono';
import { createDb } from '../db';
import { platformPlans, tenants } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

const app = new Hono<{ Bindings: { DB: D1Database } }>();

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

export default app;
