import { Hono } from 'hono';
import { createDb } from '../db';
import { platformPlans, users } from '@studio/db/src/schema'; // Ensure proper export
import { eq } from 'drizzle-orm';
import { StripeService } from '../services/stripe';

const app = new Hono<{ Bindings: { DB: D1Database, STRIPE_SECRET_KEY: string }, Variables: { auth: { userId: string } } }>();

// Middleware: Admin Only
app.use('*', async (c, next) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDb(c.env.DB);
    const user = await db.select().from(users).where(eq(users.id, auth.userId)).get();

    if (!user?.isPlatformAdmin) {
        return c.json({ error: "Forbidden: Platform Admin only" }, 403);
    }
    await next();
});

// GET /admin/plans - List all plans
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const plans = await db.select().from(platformPlans).all();
    return c.json(plans);
});

// POST /admin/plans - Create a new plan (Manual)
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const { name, slug, trialDays, features } = body;

    const id = crypto.randomUUID();
    await db.insert(platformPlans).values({
        id,
        name,
        slug,
        trialDays: trialDays || 14,
        features: features || [],
        highlight: false,
        active: true
    }).run();

    return c.json({ success: true, id });
});

// PUT /admin/plans/:id - Update plan details
app.put('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();

    // Whitelist updatable fields
    const { name, description, trialDays, features, highlight, active } = body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (trialDays !== undefined) updateData.trialDays = trialDays;
    if (features !== undefined) updateData.features = features;
    if (highlight !== undefined) updateData.highlight = highlight;
    if (active !== undefined) updateData.active = active;

    await db.update(platformPlans)
        .set(updateData)
        .where(eq(platformPlans.id, id))
        .run();

    return c.json({ success: true });
});

// POST /admin/plans/sync - Sync prices from Stripe
app.post('/sync', async (c) => {
    const db = createDb(c.env.DB);
    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);

    // 1. Fetch all active products from Stripe
    // NOTE: In a real implementation, you'd use the Stripe SDK to list products/prices
    // For now, we will verify the Stripe IDs stored in our DB are valid and update prices.

    const plans = await db.select().from(platformPlans).all();
    const updates = [];

    for (const plan of plans) {
        if (plan.stripePriceIdMonthly) {
            try {
                const price = await stripe.retrievePrice(plan.stripePriceIdMonthly);
                if (price && price.unit_amount !== null) {
                    updates.push(db.update(platformPlans)
                        .set({ monthlyPriceCents: price.unit_amount })
                        .where(eq(platformPlans.id, plan.id))
                    );
                }
            } catch (e) {
                console.error(`Failed to sync monthly price for ${plan.slug}:`, e);
            }
        }

        if (plan.stripePriceIdAnnual) {
            try {
                const price = await stripe.retrievePrice(plan.stripePriceIdAnnual);
                if (price && price.unit_amount !== null) {
                    updates.push(db.update(platformPlans)
                        .set({ annualPriceCents: price.unit_amount })
                        .where(eq(platformPlans.id, plan.id))
                    );
                }
            } catch (e) {
                console.error(`Failed to sync annual price for ${plan.slug}:`, e);
            }
        }
    }

    if (updates.length > 0) {
        await (db as any).batch(updates);
    }

    return c.json({ success: true, synced: updates.length });
});


export default app;
