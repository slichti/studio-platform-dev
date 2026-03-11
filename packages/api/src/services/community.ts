import { eq, sql, and, inArray } from 'drizzle-orm';
import { communityPosts, communityReactions, tenantMembers, users, communityTopics, communityTopicMemberships, communityTopicAccessRules, courseEnrollments, subscriptions } from '@studio/db/src/schema';

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

        const totalLikes = reactions.reduce((sum: number, r: any) => sum + r.count, 0);

        await this.db.update(communityPosts)
            .set({
                reactionsJson,
                likesCount: totalLikes
            })
            .where(eq(communityPosts.id, postId))
            .run();

        return reactionsJson;
    }

    /**
     * Checks if a member has access to a topic.
     */
    async hasTopicAccess(tenantId: string, memberId: string, topicId: string, isAdmin: boolean = false): Promise<boolean> {
        if (isAdmin) return true;

        const topic = await this.db.query.communityTopics.findFirst({
            where: and(eq(communityTopics.id, topicId), eq(communityTopics.tenantId, tenantId))
        });

        if (!topic) return false;
        if (topic.visibility === 'public') return true;

        const member = await this.db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId))
        });
        if (!member) return false;

        // Check explicit membership
        const membership = await this.db.query.communityTopicMemberships.findFirst({
            where: and(eq(communityTopicMemberships.topicId, topicId), eq(communityTopicMemberships.memberId, memberId))
        });
        if (membership) return true;

        // Check access rules
        const rules = await this.db.query.communityTopicAccessRules.findMany({
            where: eq(communityTopicAccessRules.topicId, topicId)
        });

        if (rules.length === 0) return false;

        for (const rule of rules) {
            if (rule.type === 'course') {
                const enrollment = await this.db.query.courseEnrollments.findFirst({
                    where: and(
                        eq(courseEnrollments.userId, member.userId),
                        eq(courseEnrollments.courseId, rule.targetId),
                        sql`${courseEnrollments.status} IN ('active', 'completed')`
                    )
                });
                if (enrollment) return true;
            } else if (rule.type === 'membership_plan') {
                const sub = await this.db.query.subscriptions.findFirst({
                    where: and(
                        eq(subscriptions.memberId, memberId),
                        eq(subscriptions.planId, rule.targetId),
                        eq(subscriptions.status, 'active')
                    )
                });
                if (sub) return true;
            }
        }

        return false;
    }

    /**
     * Gets all topics a member can see.
     */
    async getVisibleTopics(tenantId: string, memberId: string, isAdmin: boolean = false) {
        const allTopics = await this.db.select().from(communityTopics)
            .where(and(eq(communityTopics.tenantId, tenantId), sql`${communityTopics.isArchived} IS NOT TRUE`))
            .all();

        if (isAdmin) return allTopics;

        const results = [];
        for (const topic of allTopics) {
            if (topic.visibility === 'public') {
                results.push(topic);
                continue;
            }

            // Small set of topics usually, so loop is fine for v1
            const hasAccess = await this.hasTopicAccess(tenantId, memberId, topic.id, isAdmin);
            if (hasAccess) {
                results.push(topic);
            }
        }
        return results;
    }

    /**
     * Gets a list of members to notify for a new post.
     */
    async getNotificationRecipients(tenantId: string, topicId: string | null, authorId: string) {
        let memberIds: string[] = [];

        if (topicId) {
            // Topic-specific: notify members of the topic
            const memberships = await this.db.select({ memberId: communityTopicMemberships.memberId })
                .from(communityTopicMemberships)
                .where(eq(communityTopicMemberships.topicId, topicId))
                .all();
            memberIds = memberships.map((m: any) => m.memberId);
        } else {
            // General post: notify all active studio members
            const activeMembers = await this.db.select({ id: tenantMembers.id })
                .from(tenantMembers)
                .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.status, 'active')))
                .all();
            memberIds = activeMembers.map((m: any) => m.id);
        }

        // Filter out author
        const recipientMemberIds = memberIds.filter(id => id !== authorId);
        if (recipientMemberIds.length === 0) return [];

        // Fetch emails and names
        return await this.db.select({
            email: users.email,
            firstName: sql`json_extract(${users.profile}, '$.firstName')`,
            lastName: sql`json_extract(${users.profile}, '$.lastName')`
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                inArray(tenantMembers.id, recipientMemberIds)
            ))
            .all();
    }
}
