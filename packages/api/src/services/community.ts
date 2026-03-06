import { eq, sql, and } from 'drizzle-orm';
import { communityPosts, communityReactions, tenantMembers, users } from '@studio/db/src/schema';

export class CommunityService {
    constructor(private db: any) { }

    /**
     * Posts a milestone celebration to the community feed.
     */
    async postMilestone(tenantId: string, memberId: string, count: number) {
        // Fetch member name for the post
        const member = await this.db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId)),
            with: { user: true }
        });

        if (!member || !member.user) return;

        const firstName = (member.user.profile as any)?.firstName || 'A member';
        const content = `🎉 Huge congratulations to ${firstName} for hitting ${count} classes! Keep up the amazing work! #Milestone #Community`;

        const id = crypto.randomUUID();
        await this.db.insert(communityPosts).values({
            id,
            tenantId,
            authorId: memberId, // Posting as the member, but could be a system account
            content,
            type: 'milestone',
            isGenerated: true,
            createdAt: new Date()
        }).run();

        return id;
    }

    /**
     * Updates the cached reactions JSON for a post.
     */
    async updateReactionCounts(postId: string) {
        const reactions = await this.db.select({
            type: communityReactions.type,
            count: sql<number>`count(*)`
        })
            .from(communityReactions)
            .where(eq(communityReactions.postId, postId))
            .groupBy(communityReactions.type)
            .all();

        const reactionsJson = reactions.reduce((acc: any, r: any) => {
            acc[r.type] = r.count;
            return acc;
        }, {});

        await this.db.update(communityPosts)
            .set({ reactionsJson })
            .where(eq(communityPosts.id, postId))
            .run();

        return reactionsJson;
    }
}
