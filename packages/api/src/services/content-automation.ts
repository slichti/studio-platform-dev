import { eq, and, sql, lt, or, isNotNull } from 'drizzle-orm';
import { tenantSeoContentSettings, platformSeoTopics, tenants, communityPosts, tenantMembers, users, locations } from '@studio/db/src/schema';
import { GeminiService } from './gemini';
import { PushService } from './push';

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
                // Fetch primary location for accurate city fallback
                const primaryLoc = await db.select({ address: locations.address })
                    .from(locations)
                    .where(and(eq(locations.tenantId, item.tenant.id), eq(locations.isPrimary, true)))
                    .get();

                let city = item.tenant.branding?.location?.split(',')[0];
                if (!city && primaryLoc?.address) {
                    const parts = primaryLoc.address.split(',');
                    city = parts.length >= 2 ? parts[parts.length - 2].trim() : parts[parts.length - 1].trim();
                }

                // 2. Aggregate locale info
                const localeInfo = {
                    studioName: item.tenant.name,
                    city: city || 'Your City', // Fallback to a generic term instead of a hardcoded city
                    businessType: item.tenant.branding?.businessType || 'Fitness Studio'
                };

                // 3. Generate content
                const { title, content, imagePrompt } = await gemini.generateBlogPost(
                    item.topic.name,
                    item.topic.description || '',
                    localeInfo
                ) as any;

                // 4. Find an author (usually the owner)
                const author = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, item.tenant.id)).limit(1).get();
                if (!author) continue;

                // 5. Generate AI image URL (Pollinations.ai demo)
                // In production, this might be saved to R2 first
                const imageUrl = imagePrompt
                    ? `https://pollinations.ai/p/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true`
                    : null;

                // 6. Publish post
                const postId = crypto.randomUUID();
                await db.insert(communityPosts).values({
                    id: postId,
                    tenantId: item.tenant.id,
                    authorId: author.id,
                    content: `## ${title}\n\n${content}`,
                    type: 'blog',
                    imageUrl,
                    topicId: item.topic.id,
                    isGenerated: true,
                    createdAt: new Date()
                }).run();

                // 7. Push Notifications to all students
                try {
                    const tokens = await db.select({ token: users.pushToken })
                        .from(tenantMembers)
                        .innerJoin(users, eq(tenantMembers.userId, users.id))
                        .where(
                            and(
                                eq(tenantMembers.tenantId, item.tenant.id),
                                eq(tenantMembers.status, 'active'),
                                isNotNull(users.pushToken)
                            )
                        )
                        .all();

                    const pushTokens = tokens.map((t: any) => t.token);
                    if (pushTokens.length > 0) {
                        const pushService = new PushService(db, item.tenant.id);
                        await pushService.sendPush(
                            pushTokens,
                            `New Blog: ${title}`,
                            `Check out our latest insights on ${item.topic.name}. Now available in the community feed!`,
                            { postId, type: 'blog' }
                        );
                    }
                } catch (pushErr) {
                    console.error(`Failed to send push for tenant ${item.tenant.slug}:`, pushErr);
                }

                // 8. Update nextRunAt based on frequency
                const nextRun = this.calculateNextRun(item.settings.frequency);
                await db.update(tenantSeoContentSettings)
                    .set({ nextRunAt: nextRun, updatedAt: new Date() })
                    .where(eq(tenantSeoContentSettings.id, item.settings.id))
                    .run();

                processedCount++;
            } catch (err) {
                console.error(`Failed to process blog for tenant ${item.tenant.slug}:`, err);
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
