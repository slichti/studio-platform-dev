import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, auditLogs } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';
import { UsageService } from '../services/pricing';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /preview - Billing Preview for all tenants
app.get('/preview', async (c) => {
    const db = createDb(c.env.DB);
    const { PricingService, TIERS } = await import('../services/pricing');
    await PricingService.loadTiersFromDb(db);

    try {
        const allTenants = await db.select().from(tenants).all();

        // Fee structure (consistent with pricing service)
        const fees = {
            sms: 0.0075,
            email: 0.0006,
            streaming: 0.05,
            storage: 0.02,
            applicationFeePercent: 0.05
        };

        const tenantsWithBilling = allTenants.map(t => {
            const tierKey = t.tier || 'launch';
            const tierConfig = PricingService.getTierConfig(tierKey);
            const subscription = {
                name: tierConfig.name + ' Plan',
                amount: tierConfig.price / 100 // Convert cents to dollars
            };
            // For now, usage costs are empty (would need UsageService integration)
            const costs: Record<string, { quantity: number, amount: number }> = {};
            const usageTotal = Object.values(costs).reduce((acc, c) => acc + c.amount, 0);

            return {
                tenant: t,
                subscription,
                costs,
                total: subscription.amount + usageTotal
            };
        });

        return c.json({
            tenants: tenantsWithBilling,
            fees
        });
    } catch (e: any) {
        console.error('Billing preview failed:', e);
        return c.json({ error: e.message }, 500);
    }
});

// GET /tenants/:id/details - Get Stripe Sync'd Details
app.get('/tenants/:id/details', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId)
    });
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);
    return c.json({ stripeAccountId: tenant.stripeAccountId, tier: tenant.tier });
});

// POST /tenants/:id/waive - Waive current usage
app.post('/tenants/:id/waive', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const auth = c.get('auth');

    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId)
    });
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        action: 'waive_usage_admin',
        actorId: auth.userId,
        targetId: tenantId,
        details: { waivedAt: new Date() },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true });
});

// PATCH /tenants/:id/subscription - Admin Update Subscription
app.patch('/tenants/:id/subscription', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { status, trialDays } = await c.req.json();

    const updateData: any = {};
    if (status) updateData.status = status;
    if (trialDays) updateData.trialDays = trialDays;

    await db.update(tenants).set(updateData).where(eq(tenants.id, tenantId)).run();
    return c.json({ success: true });
});

// POST /charge - Execute chargebacks
app.post('/charge', async (c) => {
    const db = createDb(c.env.DB);
    const { BillingService } = await import('../services/billing');
    if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Stripe Key Missing" }, 500);

    const allTenants = await db.select().from(tenants).all();
    const results = [];
    for (const tenant of allTenants) {
        try {
            const billing = new BillingService(db, c.env.STRIPE_SECRET_KEY);
            await billing.syncUsageToStripe(tenant.id);
            results.push({ tenantId: tenant.id, success: true });
        } catch (e: any) {
            results.push({ tenantId: tenant.id, error: e.message });
        }
    }
    return c.json({ success: true, charged: results.length, details: results });
});

// POST /projections - Platform Revenue Calculator
app.post('/projections', async (c) => {
    const { PricingService, TIERS } = await import('../services/pricing');
    const { launchCount, growthCount, scaleCount } = await c.req.json();

    // Use actual tier prices from PricingService (in cents, convert to dollars)
    const launchPrice = TIERS.launch.price / 100;
    const growthPrice = TIERS.growth.price / 100;
    const scalePrice = TIERS.scale.price / 100;

    const launchRev = (launchCount || 0) * launchPrice;
    const growthRev = (growthCount || 0) * growthPrice;
    const scaleRev = (scaleCount || 0) * scalePrice;

    const totalRevenue = launchRev + growthRev + scaleRev;
    const totalTenants = (launchCount || 0) + (growthCount || 0) + (scaleCount || 0);

    return c.json({
        totalTenants,
        projectedMonthlyRevenue: totalRevenue,
        avgRevenuePerTenant: totalTenants > 0 ? (totalRevenue / totalTenants) : 0,
        tierPrices: { launch: launchPrice, growth: growthPrice, scale: scalePrice }
    });
});

// POST /sync-stats - Force Recalculate usage
app.post('/sync-stats', async (c) => {
    const db = createDb(c.env.DB);
    const allTenants = await db.select().from(tenants).all();
    let updated = 0;
    for (const tenant of allTenants) {
        const service = new UsageService(db, tenant.id);
        await service.syncTenantStats();
        updated++;
    }
    return c.json({ success: true, updated });
});

export default app;
