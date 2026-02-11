
import { createMiddleware } from 'hono/factory';
import { createDb } from '../db';
import { UsageService } from '../services/pricing';
import { StudioVariables } from '../types';

export type QuotaType = 'students' | 'instructors' | 'locations' | 'smsUsage' | 'emailUsage' | 'streamingUsage' | 'storageGB';

export const quotaMiddleware = (type: QuotaType) => createMiddleware<{ Bindings: { DB: D1Database }, Variables: StudioVariables }>(async (c, next) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant not found in context" }, 500);

    // Exempt billing?
    if (tenant.billingExempt) return await next();

    try {
        const db = createDb(c.env.DB);
        const usageService = new UsageService(db, tenant.id);

        console.log(`[QUOTA DEBUG] Checking limit for ${type} on tier ${tenant.tier || 'launch'}`);
        const canProceed = await usageService.checkLimit(type, tenant.tier || 'launch');
        console.log(`[QUOTA DEBUG] Result for ${type}: ${canProceed}`);

        if (!canProceed) {
            return c.json({
                error: `Quota Exceeded: Your plan limit for ${type} has been reached.`,
                code: 'QUOTA_EXCEEDED',
                tier: tenant.tier || 'launch'
            }, 402);
        }
    } catch (e: any) {
        console.error(`[QUOTA ERROR] ${e.message}`, e.stack);
        return c.json({ error: "Internal Server Error in Quota Middleware", details: e.message }, 500);
    }

    await next();
});
