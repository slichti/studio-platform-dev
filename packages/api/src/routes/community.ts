import { Hono } from 'hono';
import { createDb } from '../db';
import { communityPosts, communityComments, communityLikes, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET / community - List posts
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const posts = await db.select({
        id: communityPosts.id, content: communityPosts.content, type: communityPosts.type, imageUrl: communityPosts.imageUrl,
        likesCount: communityPosts.likesCount, commentsCount: communityPosts.commentsCount, isPinned: communityPosts.isPinned,
        createdAt: communityPosts.createdAt, authorId: tenantMembers.id, authorEmail: users.email, authorProfile: users.profile
    })
        .from(communityPosts).innerJoin(tenantMembers, eq(communityPosts.authorId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(communityPosts.tenantId, tenant.id)).orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt)).limit(50).all();

    let likedIds = new Set<string>();
    if (member) {
        const likes = await db.select({ postId: communityLikes.postId }).from(communityLikes).where(eq(communityLikes.memberId, member.id)).all();
        likedIds = new Set(likes.map(l => l.postId));
    }

    return c.json(posts.map(p => ({
        ...p, author: { id: p.authorId, user: { email: p.authorEmail, profile: p.authorProfile } }, isLiked: likedIds.has(p.id)
    })));
});

// POST / community - Create post
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 400);

    const { content, type, imageUrl } = await c.req.json();
    if (!content) return c.json({ error: 'Content required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(communityPosts).values({ id, tenantId: tenant.id, authorId: member.id, content, type: type || 'post', imageUrl }).run();
    return c.json({ id }, 201);
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
