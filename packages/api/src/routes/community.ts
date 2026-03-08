import { Hono } from 'hono';
import { createDb } from '../db';
import { communityPosts, communityComments, communityReactions, tenantMembers, users, tenants, bookings, platformConfig, aiUsageLogs, communityTopics, communityTopicMemberships, communityTopicAccessRules } from '@studio/db/src/schema';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';
import { HonoContext } from '../types';
import { CommunityService } from '../services/community';

const app = new Hono<HonoContext>();

// GET / community - List posts (supports ?type=announcement|event|post|photo and ?limit=)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const typeFilter = c.req.query('type') as 'post' | 'announcement' | 'event' | 'photo' | 'blog' | 'milestone' | undefined;
    const topicId = c.req.query('topicId');
    const limit = Math.min(Number(c.req.query('limit') || 50), 100);

    let whereClause: any = eq(communityPosts.tenantId, tenant.id);
    if (typeFilter) {
        whereClause = and(whereClause, eq(communityPosts.type, typeFilter));
    }
    if (topicId) {
        whereClause = and(whereClause, eq(communityPosts.topicId, topicId));
    } else {
        // "Everyone" view - only show general posts (no topic)
        whereClause = and(whereClause, sql`${communityPosts.topicId} IS NULL`);
    }

    const posts = await db.select({
        id: communityPosts.id, content: communityPosts.content, type: communityPosts.type, imageUrl: communityPosts.imageUrl,
        likesCount: communityPosts.likesCount, commentsCount: communityPosts.commentsCount,
        reactions: communityPosts.reactionsJson,
        isPinned: communityPosts.isPinned,
        topicId: communityPosts.topicId,
        mediaJson: communityPosts.mediaJson,
        createdAt: communityPosts.createdAt,
        authorId: tenantMembers.id, authorEmail: users.email, authorProfile: users.profile,
        topic: {
            id: communityTopics.id,
            name: communityTopics.name,
            color: communityTopics.color,
            icon: communityTopics.icon
        }
    })
        .from(communityPosts)
        .innerJoin(tenantMembers, eq(communityPosts.authorId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .leftJoin(communityTopics, eq(communityPosts.topicId, communityTopics.id))
        .where(whereClause).orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt)).limit(limit).all();

    let userReactions = new Map<string, string>(); // postId -> reactionType
    if (member) {
        const reactions = await db.select({ postId: communityReactions.postId, type: communityReactions.type })
            .from(communityReactions).where(eq(communityReactions.memberId, member.id)).all();
        userReactions = new Map(reactions.map(r => [r.postId, r.type]));
    }

    return c.json(posts.map(p => ({
        ...p,
        author: { id: p.authorId, user: { email: p.authorEmail, profile: p.authorProfile } },
        userReaction: userReactions.get(p.id) || null,
        isLiked: userReactions.has(p.id) // keep for backward compatibility
    })));
});

// GET /community/settings - Get tenant community settings
app.get('/settings', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const settings = (tenant.settings as any)?.community || {
        emailEnabled: false,
        smsEnabled: false,
        reactionsEnabled: true,
        milestonesEnabled: true,
        profilePreviewsEnabled: true
    };

    return c.json(settings);
});

// PATCH /community/settings - Update tenant community settings
app.patch('/settings', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { emailEnabled, smsEnabled, reactionsEnabled, milestonesEnabled, profilePreviewsEnabled } = await c.req.json();

    const currentSettings = (tenant.settings as any) || {};
    const newSettings = {
        ...currentSettings,
        community: {
            ...(currentSettings.community || {}),
            ...(emailEnabled !== undefined ? { emailEnabled } : {}),
            ...(smsEnabled !== undefined ? { smsEnabled } : {}),
            ...(reactionsEnabled !== undefined ? { reactionsEnabled } : {}),
            ...(milestonesEnabled !== undefined ? { milestonesEnabled } : {}),
            ...(profilePreviewsEnabled !== undefined ? { profilePreviewsEnabled } : {})
        }
    };

    await db.update(tenants)
        .set({ settings: newSettings })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ success: true });
});

// GET /community/topics - List community topics
app.get('/topics', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const canManage = c.get('can')('manage_marketing');
    const includeArchived = c.req.query('includeArchived') === 'true';

    const isAdmin = c.get('isPlatformAdmin') || c.get('roles')?.includes('owner') || false;

    // Filter out archived topics for everyone unless explicitly requested by admin
    let topics;
    if (canManage) {
        topics = await db.query.communityTopics.findMany({
            where: and(
                eq(communityTopics.tenantId, tenant.id),
                includeArchived ? sql`1=1` : sql`${communityTopics.isArchived} IS NOT TRUE`
            ),
            orderBy: communityTopics.name,
            with: {
                rules: true,
                memberships: {
                    with: {
                        member: {
                            with: {
                                user: true
                            }
                        }
                    }
                }
            }
        });
    } else if (!member) {
        topics = await db.select().from(communityTopics)
            .where(and(
                eq(communityTopics.tenantId, tenant.id),
                eq(communityTopics.visibility, 'public'),
                sql`${communityTopics.isArchived} IS NOT TRUE`
            ))
            .all();
    } else {
        const communityService = new CommunityService(db);
        topics = await communityService.getVisibleTopics(tenant.id, member!.id, isAdmin);
    }

    return c.json(topics);
});

// GET /community/topics/:id - Get topic details (including rules/members for admins)
app.get('/topics/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const topic = await db.query.communityTopics.findFirst({
        where: and(eq(communityTopics.id, id), eq(communityTopics.tenantId, tenant.id))
    });

    if (!topic) return c.json({ error: 'Topic not found' }, 404);

    if (c.get('can')('manage_marketing')) {
        const rules = await db.query.communityTopicAccessRules.findMany({
            where: eq(communityTopicAccessRules.topicId, id)
        });
        const memberships = await db.query.communityTopicMemberships.findMany({
            where: eq(communityTopicMemberships.topicId, id),
            with: { member: { with: { user: true } } }
        });
        return c.json({ ...topic, rules, memberships });
    }

    return c.json(topic);
});

// POST /community/topics - Create community topic
app.post('/topics', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { name, description, icon, color, visibility } = await c.req.json();
    if (!name?.trim()) return c.json({ error: 'Name required' }, 400);

    // Sanity check: Check for duplicate name in same tenant
    const existing = await db.query.communityTopics.findFirst({
        where: and(
            eq(communityTopics.tenantId, tenant.id),
            sql`lower(${communityTopics.name}) = ${name.trim().toLowerCase()}`,
            eq(communityTopics.isArchived, false)
        )
    });

    if (existing) {
        return c.json({ error: `A topic named "${name}" already exists.` }, 409);
    }

    const id = crypto.randomUUID();
    await db.insert(communityTopics).values({
        id,
        tenantId: tenant.id,
        name: name.trim(),
        description,
        icon,
        color,
        visibility: visibility || 'public'
    }).run();

    return c.json({ id }, 201);
});

// PATCH /community/topics/:id - Update topic
app.patch('/topics/:id', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { name, description, icon, color, visibility, isArchived } = await c.req.json();

    const topic = await db.query.communityTopics.findFirst({
        where: and(eq(communityTopics.id, id), eq(communityTopics.tenantId, tenant.id))
    });

    if (!topic) return c.json({ error: 'Topic not found' }, 404);

    if (name && name.trim() !== topic.name) {
        // Check for duplicate if renaming
        const existing = await db.query.communityTopics.findFirst({
            where: and(
                eq(communityTopics.tenantId, tenant.id),
                sql`lower(${communityTopics.name}) = ${name.trim().toLowerCase()}`,
                eq(communityTopics.isArchived, false),
                sql`${communityTopics.id} != ${topic.id}`
            )
        });
        if (existing) return c.json({ error: `A topic named "${name}" already exists.` }, 409);
    }

    await db.update(communityTopics).set({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(isArchived !== undefined ? { isArchived } : {}),
    }).where(eq(communityTopics.id, id)).run();

    return c.json({ success: true });
});

// POST /community/topics/:id/rules - Add access rule
app.post('/topics/:id/rules', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const topicId = c.req.param('id');
    const { type, targetId } = await c.req.json();

    const id = crypto.randomUUID();
    await db.insert(communityTopicAccessRules).values({
        id,
        topicId,
        type,
        targetId
    }).run();

    return c.json({ id }, 201);
});

// DELETE /community/topics/rules/:ruleId - Remove access rule
app.delete('/topics/rules/:ruleId', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    await db.delete(communityTopicAccessRules).where(eq(communityTopicAccessRules.id, c.req.param('ruleId'))).run();
    return c.json({ success: true });
});

// POST /community/topics/:id/members - Add manual member
app.post('/topics/:id/members', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const topicId = c.req.param('id');
    const { memberId, role } = await c.req.json();

    const id = crypto.randomUUID();
    await db.insert(communityTopicMemberships).values({
        id,
        topicId,
        memberId,
        role: role || 'member'
    }).run();

    return c.json({ id }, 201);
});

// DELETE /community/topics/members/:membershipId - Remove manual member
app.delete('/topics/members/:membershipId', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    await db.delete(communityTopicMemberships).where(eq(communityTopicMemberships.id, c.req.param('membershipId'))).run();
    return c.json({ success: true });
});

// DELETE /community/topics/:id - Delete community topic
app.delete('/topics/:id', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // Nullify topicId on posts before deleting topic to avoid dangling references
    await db.update(communityPosts)
        .set({ topicId: null })
        .where(eq(communityPosts.topicId, id))
        .run();

    await db.delete(communityTopics)
        .where(and(eq(communityTopics.id, id), eq(communityTopics.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// GET / community/:id - Get single post
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const post = await db.select({
        id: communityPosts.id, content: communityPosts.content, type: communityPosts.type, imageUrl: communityPosts.imageUrl,
        likesCount: communityPosts.likesCount, commentsCount: communityPosts.commentsCount, isPinned: communityPosts.isPinned,
        media: communityPosts.mediaJson,
        createdAt: communityPosts.createdAt, authorId: tenantMembers.id, authorEmail: users.email, authorProfile: users.profile
    })
        .from(communityPosts).innerJoin(tenantMembers, eq(communityPosts.authorId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(eq(communityPosts.id, c.req.param('id')), eq(communityPosts.tenantId, tenant.id))).get();

    if (!post) return c.json({ error: 'Post not found' }, 404);

    return c.json({
        ...post, author: { id: post.authorId, user: { email: post.authorEmail, profile: post.authorProfile } }
    });
});

// POST / community - Create post
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 400);

    const { content, type, imageUrl, media, topicId } = await c.req.json();
    if (!content) return c.json({ error: 'Content required' }, 400);

    const id = crypto.randomUUID();

    if (topicId) {
        const isAdmin = c.get('isPlatformAdmin') || c.get('roles')?.includes('owner') || false;
        const communityService = new CommunityService(db);
        const hasAccess = await communityService.hasTopicAccess(tenant.id, member!.id, topicId, isAdmin);
        if (!hasAccess) return c.json({ error: 'You do not have access to this topic' }, 403);
    }

    await db.insert(communityPosts).values({
        id,
        tenantId: tenant.id,
        authorId: member.id,
        content,
        type: type || 'post',
        imageUrl,
        topicId: topicId || null,
        mediaJson: media || null
    }).run();

    // Notification Logic (Background)
    const communitySettings = (tenant.settings as any)?.community;
    if (communitySettings?.emailEnabled || communitySettings?.smsEnabled) {
        console.log(`[Community Notification] Checking global flags for tenant: ${tenant.slug}`);
        // In a real scenario, we'd fetch platformConfig here or pass it in context
        // and then trigger the actual email/sms dispatch.
        // For now, we log the intent.
        console.log(`[Community Notification] Notification flags detected: Email=${communitySettings.emailEnabled}, SMS=${communitySettings.smsEnabled}`);
    }

    return c.json({ id }, 201);
});

// POST / community/ai-generate - AI Assist for posts
import { GeminiService } from '../services/gemini';

app.post('/ai-generate', async (c) => {
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { prompt } = await c.req.json();
    if (!prompt) return c.json({ error: 'Prompt required' }, 400);

    const db = createDb(c.env.DB);
    const aiConfigRow = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'config_ai')
    });
    const configAi = aiConfigRow?.value as any;

    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey && !configAi?.apiKey) {
        return c.json({ error: 'AI features not configured (missing GEMINI_API_KEY)' }, 503);
    }

    const gemini = new GeminiService(apiKey, configAi);

    try {
        const aiResult = await gemini.generateCommunityPost(prompt, tenant.name);

        c.executionCtx.waitUntil(
            db.insert(aiUsageLogs).values({
                id: crypto.randomUUID(),
                tenantId: tenant.id,
                userId: auth?.userId || null,
                model: aiResult.model,
                feature: 'community_hub',
                promptTokens: aiResult.usage.promptTokenCount,
                completionTokens: aiResult.usage.candidatesTokenCount,
                totalTokens: aiResult.usage.totalTokenCount,
            }).run().catch(err => console.error('Failed to log AI usage:', err))
        );

        return c.json({ content: aiResult.content });
    } catch (e: any) {
        console.error('AI Generation Failed Trace:', e);
        return c.json({
            error: `AI Error: ${e.message}`,
            details: e.message
        }, 500);
    }
});

// POST / community/:id/react
app.post('/:id/react', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    const postId = c.req.param('id');
    if (!member) return c.json({ error: 'Member required' }, 403);

    const { type = 'like' } = await c.req.json<{ type?: 'like' | 'heart' | 'celebrate' | 'fire' }>();

    const existing = await db.select().from(communityReactions)
        .where(and(eq(communityReactions.postId, postId), eq(communityReactions.memberId, member.id), eq(communityReactions.type, type)))
        .get();

    if (existing) {
        await db.delete(communityReactions)
            .where(and(eq(communityReactions.postId, postId), eq(communityReactions.memberId, member.id), eq(communityReactions.type, type)))
            .run();
    } else {
        await db.insert(communityReactions).values({
            postId,
            memberId: member.id,
            type
        }).run();
    }

    // Sync counts
    const communityService = new CommunityService(db);
    const reactionsJson = await communityService.updateReactionCounts(postId);

    return c.json({ success: true, reactions: reactionsJson });
});

// GET / community/:id/comments
app.get('/:id/comments', async (c) => {
    const db = createDb(c.env.DB);
    const list = await db.select({
        id: communityComments.id,
        content: communityComments.content,
        createdAt: communityComments.createdAt,
        parentId: communityComments.parentId,
        authorId: tenantMembers.id,
        authorEmail: users.email,
        authorProfile: users.profile
    })
        .from(communityComments).innerJoin(tenantMembers, eq(communityComments.authorId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(communityComments.postId, c.req.param('id'))).orderBy(communityComments.createdAt).all();

    return c.json(list.map(l => ({ ...l, author: { id: l.authorId, user: { email: l.authorEmail, profile: l.authorProfile } } })));
});

// POST / community/:id/comments
app.post('/:id/comments', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member required' }, 403);

    const { content, parentId } = await c.req.json();
    if (!content) return c.json({ error: 'Content required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(communityComments).values({ id, postId: c.req.param('id'), authorId: member.id, content, parentId: parentId || null }).run();
    await db.update(communityPosts).set({ commentsCount: sql`${communityPosts.commentsCount} + 1` }).where(eq(communityPosts.id, c.req.param('id'))).run();
    return c.json({ id }, 201);
});

// PATCH / community/:id/pin
app.patch('/:id/pin', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const post = await db.select().from(communityPosts).where(and(eq(communityPosts.id, c.req.param('id')), eq(communityPosts.tenantId, c.get('tenant')!.id))).get();
    if (!post) return c.json({ error: 'Not found' }, 404);

    await db.update(communityPosts).set({ isPinned: !post.isPinned }).where(eq(communityPosts.id, post.id)).run();
    return c.json({ isPinned: !post.isPinned });
});

// PATCH / community/:id
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member required' }, 403);

    const postId = c.req.param('id');
    const { content, topicId } = await c.req.json();

    const post = await db.select().from(communityPosts).where(and(eq(communityPosts.id, postId), eq(communityPosts.tenantId, c.get('tenant')!.id))).get();
    if (!post) return c.json({ error: 'Post not found' }, 404);

    if (post.authorId !== member.id && !c.get('can')('manage_marketing')) {
        return c.json({ error: 'Access denied' }, 403);
    }

    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (topicId !== undefined) updateData.topicId = topicId; // can be null

    await db.update(communityPosts)
        .set(updateData)
        .where(eq(communityPosts.id, postId))
        .run();

    return c.json({ success: true });
});

// GET / community/members/:id/preview
app.get('/members/:id/preview', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const memberId = c.req.param('id');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });

    if (!member) return c.json({ error: 'Member not found' }, 404);

    // Stats
    const attendanceCount = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.memberId, memberId), isNotNull(bookings.checkedInAt)))
        .get();

    return c.json({
        id: member.id,
        firstName: (member.user.profile as any)?.firstName,
        lastName: (member.user.profile as any)?.lastName,
        profilePicture: (member.user.profile as any)?.portraitUrl,
        joinedAt: member.joinedAt,
        stats: {
            totalClasses: attendanceCount?.count || 0,
        }
    });
});

// DELETE / community/:id
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    const post = await db.select().from(communityPosts).where(and(eq(communityPosts.id, c.req.param('id')), eq(communityPosts.tenantId, c.get('tenant')!.id))).get();
    if (!post) return c.json({ error: 'Not found' }, 404);

    if (post.authorId !== member?.id && !c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);

    await db.delete(communityPosts).where(eq(communityPosts.id, post.id)).run();
    return c.json({ success: true });
});

export default app;
