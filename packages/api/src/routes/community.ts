import { Hono } from 'hono';
import { createDb } from '../db';
import { communityPosts, communityComments, communityReactions, tenantMembers, users, tenants, bookings } from '@studio/db/src/schema';
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

    const typeFilter = c.req.query('type') as 'post' | 'announcement' | 'event' | 'photo' | 'blog' | undefined;
    const limit = Math.min(Number(c.req.query('limit') || 50), 100);

    const whereClause = typeFilter
        ? and(eq(communityPosts.tenantId, tenant.id), eq(communityPosts.type, typeFilter))
        : eq(communityPosts.tenantId, tenant.id);

    const posts = await db.select({
        id: communityPosts.id, content: communityPosts.content, type: communityPosts.type, imageUrl: communityPosts.imageUrl,
        likesCount: communityPosts.likesCount, commentsCount: communityPosts.commentsCount,
        reactions: communityPosts.reactionsJson,
        isPinned: communityPosts.isPinned,
        media: communityPosts.mediaJson,
        createdAt: communityPosts.createdAt, authorId: tenantMembers.id, authorEmail: users.email, authorProfile: users.profile
    })
        .from(communityPosts).innerJoin(tenantMembers, eq(communityPosts.authorId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
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

// POST / community - Create post
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 400);

    const { content, type, imageUrl, media } = await c.req.json();
    if (!content) return c.json({ error: 'Content required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(communityPosts).values({
        id,
        tenantId: tenant.id,
        authorId: member.id,
        content,
        type: type || 'post',
        imageUrl,
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
import { aiUsageLogs } from '@studio/db/src/schema';

app.post('/ai-generate', async (c) => {
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { prompt } = await c.req.json();
    if (!prompt) return c.json({ error: 'Prompt required' }, 400);

    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: 'AI features not configured' }, 503);

    const gemini = new GeminiService(apiKey);

    try {
        const { content, usage } = await gemini.generateCommunityPost(prompt, tenant.name);

        // Log AI Usage
        const db = createDb(c.env.DB);
        c.executionCtx.waitUntil(
            db.insert(aiUsageLogs).values({
                id: crypto.randomUUID(),
                tenantId: tenant.id,
                userId: auth?.userId || null,
                model: 'gemini-2.0-flash',
                feature: 'community_hub',
                promptTokens: usage.promptTokenCount,
                completionTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount,
            }).run()
        );

        return c.json({ content });
    } catch (e: any) {
        console.error('AI Generation Failed:', e);
        return c.json({ error: 'AI was unable to help this time.' }, 500);
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
    const list = await db.select({ id: communityComments.id, content: communityComments.content, createdAt: communityComments.createdAt, authorId: tenantMembers.id, authorEmail: users.email, authorProfile: users.profile })
        .from(communityComments).innerJoin(tenantMembers, eq(communityComments.authorId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(communityComments.postId, c.req.param('id'))).orderBy(communityComments.createdAt).all();

    return c.json(list.map(l => ({ ...l, author: { id: l.authorId, user: { email: l.authorEmail, profile: l.authorProfile } } })));
});

// POST / community/:id/comments
app.post('/:id/comments', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member required' }, 403);

    const { content } = await c.req.json();
    if (!content) return c.json({ error: 'Content required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(communityComments).values({ id, postId: c.req.param('id'), authorId: member.id, content }).run();
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
