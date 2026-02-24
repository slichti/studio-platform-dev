import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';
import { eq, sql } from 'drizzle-orm';

export class SitemapService {
    /**
     * Reaches out to the edge-rendered sitemap URL for a tenant and verifies it returns 200 OK.
     */
    static async validateSitemap(tenantSlug: string, baseUrl: string): Promise<boolean> {
        try {
            const url = `${baseUrl}/${tenantSlug}/sitemap.xml`;
            const response = await fetch(url, { method: 'HEAD' });
            return response.status === 200;
        } catch (err) {
            console.error(`Sitemap validation failed for ${tenantSlug}:`, err);
            return false;
        }
    }

    /**
     * Triggers a 'global rebuild' flag. In this edge architecture, since sitemaps are 
     * dynamic and rendered via HTMLRewriter/Streaming, 'rebuilding' usually means 
     * clearing any edge cache (e.g. KV or R2 cache) or updating a versioning key.
     */
    static async triggerGlobalRebuild(db: any): Promise<{ success: boolean; count: number }> {
        // Here we could update a 'last_global_rebuild' key in platformConfig
        // For now, we'll touch all tenants to clear any potential persistent cache indicators
        const result = await db.update(tenants)
            .set({ updatedAt: new Date() })
            .run();

        return { success: true, count: result?.changes || 0 };
    }
}
