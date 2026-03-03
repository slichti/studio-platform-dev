import { Hono } from 'hono';
import { createDb } from '../db';
import { aiUsageLogs, tenants } from '@studio/db/src/schema';
import { sql, eq, gte, desc } from 'drizzle-orm';
import type { HonoContext } from '../types';

const ai = new Hono<HonoContext>();

const PRICING: Record<string, { prompt: number, completion: number }> = {
    'gemini-1.5-flash': { prompt: 0.00000035, completion: 0.00000105 },
    'gemini-1.5-flash-latest': { prompt: 0.00000035, completion: 0.00000105 },
    'gemini-1.5-pro': { prompt: 0.0000035, completion: 0.0000105 },
    'gemini-2.0-flash-exp': { prompt: 0, completion: 0 },
    'gemini-2.0-flash': { prompt: 0.00000035, completion: 0.00000105 },
};

ai.get('/usage', async (c) => {
    const db = createDb(c.env.DB);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
        const [summary, byFeature, byModel, byTenant, recentLogs] = await Promise.all([
            // Total Summary
            db.select({
                totalTokens: sql<number>`SUM(total_tokens)`,
                promptTokens: sql<number>`SUM(prompt_tokens)`,
                completionTokens: sql<number>`SUM(completion_tokens)`,
                count: sql<number>`COUNT(*)`
            }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, thirtyDaysAgo)).get(),

            // By Feature
            db.select({
                feature: aiUsageLogs.feature,
                totalTokens: sql<number>`SUM(total_tokens)`,
                count: sql<number>`COUNT(*)`
            }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, thirtyDaysAgo)).groupBy(aiUsageLogs.feature).all(),

            // By Model
            db.select({
                model: aiUsageLogs.model,
                promptTokens: sql<number>`SUM(prompt_tokens)`,
                completionTokens: sql<number>`SUM(completion_tokens)`,
                count: sql<number>`COUNT(*)`
            }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, thirtyDaysAgo)).groupBy(aiUsageLogs.model).all(),

            // By Tenant
            db.select({
                tenantId: aiUsageLogs.tenantId,
                tenantName: tenants.name,
                promptTokens: sql<number>`SUM(prompt_tokens)`,
                completionTokens: sql<number>`SUM(completion_tokens)`,
                totalTokens: sql<number>`SUM(total_tokens)`,
                count: sql<number>`COUNT(*)`
            })
                .from(aiUsageLogs)
                .leftJoin(tenants, eq(aiUsageLogs.tenantId, tenants.id))
                .where(gte(aiUsageLogs.createdAt, thirtyDaysAgo))
                .groupBy(aiUsageLogs.tenantId)
                .orderBy(desc(sql`SUM(total_tokens)`))
                .all(),

            // Recent Logs
            db.select({
                id: aiUsageLogs.id,
                feature: aiUsageLogs.feature,
                model: aiUsageLogs.model,
                totalTokens: aiUsageLogs.totalTokens,
                createdAt: aiUsageLogs.createdAt,
                tenantName: tenants.name
            })
                .from(aiUsageLogs)
                .leftJoin(tenants, eq(aiUsageLogs.tenantId, tenants.id))
                .orderBy(desc(aiUsageLogs.createdAt))
                .limit(10)
                .all()
        ]);

        // Calculate Costs
        let totalCost = 0;
        const modelBreakdown = byModel.map(m => {
            const price = PRICING[m.model] || PRICING['gemini-1.5-flash'];
            const cost = (m.promptTokens * price.prompt) + (m.completionTokens * price.completion);
            totalCost += cost;
            return { ...m, estimatedCost: cost };
        });

        const tenantBreakdown = byTenant.map(t => {
            // Logic: Assume the default model for simplification in grouping if multiple models used, 
            // but for accuracy we'd need a sub-query. For now, estimate based on flash as it's the 99% case.
            const price = PRICING['gemini-2.0-flash'];
            const cost = (t.promptTokens * price.prompt) + (t.completionTokens * price.completion);
            return { ...t, estimatedCost: cost };
        });

        return c.json({
            period: '30d',
            summary: { ...summary, totalCost },
            byFeature,
            byModel: modelBreakdown,
            byTenant: tenantBreakdown,
            recentLogs
        });
    } catch (e: any) {
        console.error("Fetch AI Usage Failed:", e);
        return c.json({ error: "Failed to fetch AI usage: " + e.message }, 500);
    }
});

export default ai;
