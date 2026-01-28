import { Hono } from 'hono';
import { createDb } from '../db';
import { platformPlans } from '@studio/db/src/schema'; // Ensure proper export
import { eq } from 'drizzle-orm';

const app = new Hono<{ Bindings: { DB: D1Database } }>();

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
