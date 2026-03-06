import { Hono } from 'hono';
import { createDb } from '../db';
import { communityPosts, communityComments, communityLikes, tenantMembers, users, tenants } from '@studio/db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

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
        likesCount: communityPosts.likesCount, commentsCount: communityPosts.commentsCount, isPinned: communityPosts.isPinned,
        media: communityPosts.mediaJson,
        createdAt: communityPosts.createdAt, authorId: tenantMembers.id, authorEmail: users.email, authorProfile: users.profile
    })
        .from(communityPosts).innerJoin(tenantMembers, eq(communityPosts.authorId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(whereClause).orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt)).limit(limit).all();

    let likedIds = new Set<string>();
    if (member) {
        const likes = await db.select({ postId: communityLikes.postId }).from(communityLikes).where(eq(communityLikes.memberId, member.id)).all();
        likedIds = new Set(likes.map(l => l.postId));
    }

    return c.json(posts.map(p => ({
        ...p, author: { id: p.authorId, user: { email: p.authorEmail, profile: p.authorProfile } }, isLiked: likedIds.has(p.id)
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
        smsEnabled: false
    };

    return c.json(settings);
});

// PATCH /community/settings - Update tenant community settings
app.patch('/settings', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { emailEnabled, smsEnabled } = await c.req.json();

    const currentSettings = (tenant.settings as any) || {};
    const newSettings = {
        ...currentSettings,
        community: {
            ...(currentSettings.community || {}),
            ...(emailEnabled !== undefined ? { emailEnabled } : {}),
            ...(smsEnabled !== undefined ? { smsEnabled } : {})
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

// POST / community/generate - AI Assist for posts
app.post('/generate', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { prompt, tone = 'friendly' } = await c.req.json();
    if (!prompt) return c.json({ error: 'Prompt required' }, 400);

    const { GeminiService } = await import('../services/gemini');
    const gemini = new GeminiService(c.env.GEMINI_API_KEY!);

    const systemPrompt = `You are a social media manager for "${tenant.name}", a fitness/wellness studio.
    Write a short, engaging community post (under 400 characters) based on the user's idea: "${prompt}".
    The tone should be ${tone}. 
    Include 2-3 relevant emojis.
    Keep it warm, encouraging, and brand-aligned.
    Output ONLY the post text.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${c.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
            })
        });

        const data = await response.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        return c.json({ content: text });
    } catch (e) {
        console.error(e);
        return c.json({ error: 'Failed to generate content' }, 500);
    }
});

// POST / community/:id/like
app.post('/:id/like', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member required' }, 403);

    const existing = await db.select().from(communityLikes).where(and(eq(communityLikes.postId, c.req.param('id')), eq(communityLikes.memberId, member.id))).get();
    if (existing) {
        await db.delete(communityLikes).where(and(eq(communityLikes.postId, c.req.param('id')), eq(communityLikes.memberId, member.id))).run();
        await db.update(communityPosts).set({ likesCount: sql`${communityPosts.likesCount} - 1` }).where(eq(communityPosts.id, c.req.param('id'))).run();
        return c.json({ liked: false });
    } else {
        await db.insert(communityLikes).values({ postId: c.req.param('id'), memberId: member.id }).run();
        await db.update(communityPosts).set({ likesCount: sql`${communityPosts.likesCount} + 1` }).where(eq(communityPosts.id, c.req.param('id'))).run();
        return c.json({ liked: true });
    }
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
