import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { membershipPlans, subscriptions, tenantMembers, users } from '@studio/db/src/schema';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/** List active plans for a tenant (public within portal). */
app.get('/plans', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const includeArchived = c.get('can')('manage_commerce') && c.req.query('includeArchived') === 'true';

    const plans = await db.select().from(membershipPlans).where(
        includeArchived
            ? eq(membershipPlans.tenantId, tenant.id)
            : and(eq(membershipPlans.tenantId, tenant.id), eq(membershipPlans.active, true))
    );
    return c.json(plans);
});

/** Create a new plan and its Stripe product/price. */
app.post('/plans', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { name, description, price, interval, currency, imageUrl, overlayTitle, overlaySubtitle, vodEnabled, trialDays } = await c.req.json();
    if (!name || price === undefined) return c.json({ error: 'name and price are required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(membershipPlans).values({
        id,
        tenantId: tenant.id,
        name,
        description,
        price,
        interval: interval || 'month',
        currency: currency || tenant.currency || 'usd',
        imageUrl,
        overlayTitle,
        overlaySubtitle,
        vodEnabled: !!vodEnabled,
        trialDays: trialDays ? Number(trialDays) : 0,
        active: true,
    }).run();

    return c.json({ id, name, price }, 201);
});

/** Update a plan's fields. */
app.patch('/plans/:id', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const planId = c.req.param('id');

    const plan = await db.select().from(membershipPlans)
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)))
        .get();
    if (!plan) return c.json({ error: 'Not found' }, 404);

    const body = await c.req.json();
    const patch: Record<string, any> = { updatedAt: new Date() };
    const allowed = ['name', 'description', 'price', 'interval', 'imageUrl', 'overlayTitle', 'overlaySubtitle', 'vodEnabled', 'trialDays'];
    for (const key of allowed) {
        if (body[key] !== undefined) patch[key] = body[key];
    }

    await db.update(membershipPlans).set(patch)
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)));

    return c.json({ success: true });
});

/**
 * Archive or restore a plan.
 * If active subscribers exist, the plan cannot be hard-deleted — it is soft-archived instead.
 * DELETE archives if subscribers exist, hard-deletes otherwise.
 */
app.delete('/plans/:id', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const planId = c.req.param('id');

    const plan = await db.select().from(membershipPlans)
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)))
        .get();
    if (!plan) return c.json({ error: 'Not found' }, 404);

    const activeSubs = await db.select({ id: subscriptions.id }).from(subscriptions)
        .where(and(
            eq(subscriptions.planId, planId),
            eq(subscriptions.tenantId, tenant.id),
            inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
        ))
        .limit(1);

    if (activeSubs.length > 0) {
        // Soft-archive — cannot destroy a plan with active subscribers
        await db.update(membershipPlans).set({ active: false, updatedAt: new Date() })
            .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)));
        return c.json({ archived: true });
    }

    await db.delete(membershipPlans)
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)));
    return c.json({ deleted: true });
});

/** Toggle a plan's active / archived status without deleting it. */
app.patch('/plans/:id/status', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const planId = c.req.param('id');

    const plan = await db.select().from(membershipPlans)
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)))
        .get();
    if (!plan) return c.json({ error: 'Not found' }, 404);

    const { active } = await c.req.json() as { active: boolean };
    await db.update(membershipPlans).set({ active, updatedAt: new Date() })
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)));

    return c.json({ active });
});

// ---------------------------------------------------------------------------
// Subscriptions — Admin / list
// ---------------------------------------------------------------------------

app.get('/subscriptions', async (c) => {
    if (!c.get('auth')?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const canManage = c.get('can')('manage_commerce');
    const planId = c.req.query('planId');

    const results = await db.select({
        id: subscriptions.id,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
        planName: membershipPlans.name,
        user: {
            id: users.id,
            email: users.email,
            profile: users.profile,
        },
    })
        .from(subscriptions)
        .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
        .innerJoin(tenantMembers, eq(subscriptions.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(membershipPlans.tenantId, tenant.id),
            planId ? eq(subscriptions.planId, planId) : undefined,
            !canManage ? eq(users.id, c.get('auth')!.userId) : undefined
        ));

    return c.json(results);
});

// ---------------------------------------------------------------------------
// Subscriptions — Student self-service
// ---------------------------------------------------------------------------

/**
 * Current user's active/trialing/past_due subscriptions with full plan detail.
 * Used by the student portal profile page.
 */
app.get('/my-active', async (c) => {
    if (!c.get('auth')?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const userId = c.get('auth')!.userId;

    const results = await db.select({
        id: subscriptions.id,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        canceledAt: subscriptions.canceledAt,
        pausedUntil: subscriptions.pausedUntil,
        createdAt: subscriptions.createdAt,
        plan: {
            id: membershipPlans.id,
            name: membershipPlans.name,
            price: membershipPlans.price,
            interval: membershipPlans.interval,
            imageUrl: membershipPlans.imageUrl,
            vodEnabled: membershipPlans.vodEnabled,
        },
    })
        .from(subscriptions)
        .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
        .innerJoin(tenantMembers, eq(subscriptions.memberId, tenantMembers.id))
        .where(and(
            eq(subscriptions.tenantId, tenant.id),
            eq(subscriptions.userId, userId),
            inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
        ));

    return c.json(results.map(r => ({
        id: r.id,
        status: r.status,
        nextBillingDate: r.currentPeriodEnd,
        stripeSubscriptionId: r.stripeSubscriptionId,
        canceledAt: r.canceledAt,
        pausedUntil: r.pausedUntil,
        isPaused: r.pausedUntil ? new Date(r.pausedUntil) > new Date() : false,
        createdAt: r.createdAt,
        plan: r.plan,
    })));
});

/**
 * Cancel a subscription at period end (students can cancel their own;
 * admins can cancel any within the tenant).
 * Optional body: { reason?: string } — churn reason for analytics (price, schedule, moved, other, etc.)
 */
app.post('/subscriptions/:id/cancel', async (c) => {
    if (!c.get('auth')?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const userId = c.get('auth')!.userId;
    const subscriptionId = c.req.param('id');
    const canManage = c.get('can')('manage_commerce');

    let reason: string | undefined;
    try {
        const body = await c.req.json().catch(() => ({}));
        reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : undefined;
    } catch { /* no body */ }

    const sub = await db.select().from(subscriptions)
        .where(and(
            eq(subscriptions.id, subscriptionId),
            eq(subscriptions.tenantId, tenant.id),
            !canManage ? eq(subscriptions.userId, userId) : undefined
        ))
        .get();

    if (!sub) return c.json({ error: 'Subscription not found' }, 404);
    if (sub.status === 'canceled') return c.json({ error: 'Already canceled' }, 400);

    // Cancel in Stripe (at period end — respects the billing cycle)
    if (sub.stripeSubscriptionId && tenant.stripeAccountId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        await stripe.cancelSubscription(sub.stripeSubscriptionId, true, tenant.stripeAccountId);
    }

    // Mark as canceled in DB with optional churn reason for retention reports
    await db.update(subscriptions)
        .set({ status: 'canceled', canceledAt: new Date(), churnReason: reason ?? null })
        .where(eq(subscriptions.id, subscriptionId));

    return c.json({ success: true });
});

/**
 * Pause a subscription for a set duration (vacation freeze).
 * Tells Stripe to stop collecting payment; access is still granted until period end.
 * Students can pause their own; admins can pause any.
 */
app.post('/subscriptions/:id/pause', async (c) => {
    if (!c.get('auth')?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const userId = c.get('auth')!.userId;
    const subscriptionId = c.req.param('id');
    const canManage = c.get('can')('manage_commerce');

    const body = await c.req.json().catch(() => ({ months: 1 })) as { months?: number };
    const months = Math.min(Math.max(Number(body?.months ?? 1), 1), 6); // 1–6 months

    const sub = await db.select().from(subscriptions)
        .where(and(
            eq(subscriptions.id, subscriptionId),
            eq(subscriptions.tenantId, tenant.id),
            !canManage ? eq(subscriptions.userId, userId) : undefined
        ))
        .get();

    if (!sub) return c.json({ error: 'Subscription not found' }, 404);
    if (sub.status === 'canceled') return c.json({ error: 'Canceled subscriptions cannot be paused' }, 400);
    if (sub.pausedUntil && sub.pausedUntil > new Date()) return c.json({ error: 'Subscription is already paused' }, 400);

    const resumeAt = new Date();
    resumeAt.setMonth(resumeAt.getMonth() + months);
    const resumeAtEpoch = Math.floor(resumeAt.getTime() / 1000);

    // Pause in Stripe — void invoices during pause window
    if (sub.stripeSubscriptionId && tenant.stripeAccountId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        await stripe.pauseSubscription(sub.stripeSubscriptionId, resumeAtEpoch, tenant.stripeAccountId);
    }

    await db.update(subscriptions)
        .set({ pausedUntil: resumeAt })
        .where(eq(subscriptions.id, subscriptionId))
        .run();

    return c.json({ success: true, resumesAt: resumeAt.toISOString() });
});

/**
 * Resume a paused subscription immediately.
 */
app.post('/subscriptions/:id/resume', async (c) => {
    if (!c.get('auth')?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const userId = c.get('auth')!.userId;
    const subscriptionId = c.req.param('id');
    const canManage = c.get('can')('manage_commerce');

    const sub = await db.select().from(subscriptions)
        .where(and(
            eq(subscriptions.id, subscriptionId),
            eq(subscriptions.tenantId, tenant.id),
            !canManage ? eq(subscriptions.userId, userId) : undefined
        ))
        .get();

    if (!sub) return c.json({ error: 'Subscription not found' }, 404);
    if (!sub.pausedUntil) return c.json({ error: 'Subscription is not paused' }, 400);

    // Resume in Stripe — remove pause_collection
    if (sub.stripeSubscriptionId && tenant.stripeAccountId) {
        const { StripeService } = await import('../services/stripe');
        const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);
        await stripe.resumeSubscription(sub.stripeSubscriptionId, tenant.stripeAccountId);
    }

    await db.update(subscriptions)
        .set({ pausedUntil: null })
        .where(eq(subscriptions.id, subscriptionId))
        .run();

    return c.json({ success: true });
});

export default app;
