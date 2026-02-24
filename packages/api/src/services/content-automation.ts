import { eq, and, sql, lt, or } from 'drizzle-orm';
import { tenantSeoContentSettings, platformSeoTopics, tenants, communityPosts, tenantMembers } from '@studio/db/src/schema';
import { GeminiService } from './gemini';

export class ContentAutomationService {
    static async processPendingPosts(db: any, geminiApiKey: string) {
        const now = new Date();

        // 1. Find all active automation settings that are due
        const pending = await db.select({
            settings: tenantSeoContentSettings,
            topic: platformSeoTopics,
            tenant: tenants
        })
            .from(tenantSeoContentSettings)
            .innerJoin(platformSeoTopics, eq(tenantSeoContentSettings.topicId, platformSeoTopics.id))
            .innerJoin(tenants, eq(tenantSeoContentSettings.tenantId, tenants.id))
            .where(
                and(
                    eq(tenantSeoContentSettings.isActive, true),
                    eq(platformSeoTopics.isActive, true),
                    or(
                        lt(tenantSeoContentSettings.nextRunAt, now),
                        sql`${tenantSeoContentSettings.nextRunAt} IS NULL`
                    )
                )
            )
            .all();

        if (pending.length === 0) return { processed: 0 };

        const gemini = new GeminiService(geminiApiKey);
        let processedCount = 0;

        for (const item of pending) {
            try {
                // 2. Aggregate locale info
                const localeInfo = {
                    studioName: item.tenant.name,
                    city: item.tenant.branding?.location || 'Unknown City', // Fallback
                    businessType: item.tenant.branding?.businessType || 'Fitness Studio'
                };

                // 3. Generate content
                const { title, content } = await gemini.generateBlogPost(
                    item.topic.name,
                    item.topic.description || '',
                    localeInfo
                );

                // 4. Find an author (usually the owner)
                // We'll pick the first member we find for now, or a system account if we had one
                const author = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, item.tenant.id)).limit(1).get();
                if (!author) continue;

                // 5. Publish post
                const postId = crypto.randomUUID();
                await db.insert(communityPosts).values({
                    id: postId,
                    tenantId: item.tenant.id,
                    authorId: author.id,
                    content: `## ${title}\n\n${content}`,
                    type: 'blog',
                    topicId: item.topic.id,
                    isGenerated: true,
                    createdAt: new Date()
                }).run();

                // 6. Update nextRunAt based on frequency
                const nextRun = this.calculateNextRun(item.settings.frequency);
                await db.update(tenantSeoContentSettings)
                    .set({ nextRunAt: nextRun, updatedAt: new Date() })
                    .where(eq(tenantSeoContentSettings.id, item.settings.id))
                    .run();

                processedCount++;
            } catch (err) {
                console.error(`Failed to process crypto-blog for tenant ${item.tenant.slug}:`, err);
            }
        }

        return { processed: processedCount };
    }

    private static calculateNextRun(frequency: string): Date {
        const date = new Date();
        switch (frequency) {
            case 'daily': date.setDate(date.getDate() + 1); break;
            case 'weekly': date.setDate(date.getDate() + 7); break;
            case 'bi-weekly': date.setDate(date.getDate() + 14); break;
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            default: date.setDate(date.getDate() + 7);
        }
        return date;
    }
}
