import { Hono } from 'hono';
import { createDb } from '../db';
import { communityPosts, communityComments, communityLikes, tenantMembers, users } from 'db';
import { eq, and, desc, sql } from 'drizzle-orm';

interface Bindings {
    DB: D1Database;
}

interface Variables {
    auth: { userId: string; };
    tenant?: any;
    member?: any;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /community - List posts
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const posts = await db.select({
        id: communityPosts.id,
        content: communityPosts.content,
        type: communityPosts.type,
        imageUrl: communityPosts.imageUrl,
        likesCount: communityPosts.likesCount,
        commentsCount: communityPosts.commentsCount,
        isPinned: communityPosts.isPinned,
        createdAt: communityPosts.createdAt,
        authorId: tenantMembers.id,
        authorEmail: users.email,
        authorProfile: users.profile
    })
        .from(communityPosts)
        .innerJoin(tenantMembers, eq(communityPosts.authorId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(communityPosts.tenantId, tenant.id))
        .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
        .limit(50)
        .all();

    // Check which posts the current user has liked
    let likedPostIds = new Set<string>();
    if (member) {
        const likes = await db.select({ postId: communityLikes.postId })
            .from(communityLikes)
            .where(eq(communityLikes.memberId, member.id))
            .all();
        likedPostIds = new Set(likes.map(l => l.postId));
    }

    return c.json(posts.map(p => ({
        id: p.id,
        content: p.content,
        type: p.type,
        imageUrl: p.imageUrl,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        isPinned: p.isPinned,
        createdAt: p.createdAt,
        author: {
            id: p.authorId,
            user: {
                email: p.authorEmail,
                profile: p.authorProfile
            }
        },
        isLiked: likedPostIds.has(p.id)
    })));
});

// POST /community - Create post
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    const { content, type, imageUrl } = await c.req.json();
    if (!content) return c.json({ error: 'Content is required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(communityPosts).values({
        id,
        tenantId: tenant.id,
        authorId: member.id,
        content,
        type: type || 'post',
        imageUrl
    });

    return c.json({ id }, 201);
});

// POST /community/:id/like - Toggle like
app.post('/:id/like', async (c) => {
    const db = createDb(c.env.DB);
    const postId = c.req.param('id');
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    // Check if already liked
    const existing = await db.select({ postId: communityLikes.postId })
        .from(communityLikes)
        .where(and(eq(communityLikes.postId, postId), eq(communityLikes.memberId, member.id)))
        .get();

    if (existing) {
        // Unlike
        await db.delete(communityLikes)
            .where(and(eq(communityLikes.postId, postId), eq(communityLikes.memberId, member.id)));
        await db.update(communityPosts)
            .set({ likesCount: sql`${communityPosts.likesCount} - 1` })
            .where(eq(communityPosts.id, postId))
            .run();
        return c.json({ liked: false });
    } else {
        // Like
        await db.insert(communityLikes).values({ postId, memberId: member.id });
        await db.update(communityPosts)
            .set({ likesCount: sql`${communityPosts.likesCount} + 1` })
            .where(eq(communityPosts.id, postId))
            .run();
        return c.json({ liked: true });
    }
});

// GET /community/:id/comments - Get comments
app.get('/:id/comments', async (c) => {
    const db = createDb(c.env.DB);
    const postId = c.req.param('id');

    const comments = await db.select({
        id: communityComments.id,
        content: communityComments.content,
        createdAt: communityComments.createdAt,
        authorId: tenantMembers.id,
        authorEmail: users.email,
        authorProfile: users.profile
    })
        .from(communityComments)
        .innerJoin(tenantMembers, eq(communityComments.authorId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(communityComments.postId, postId))
        .orderBy(communityComments.createdAt)
        .all();

    return c.json(comments.map(c => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: {
            id: c.authorId,
            user: {
                email: c.authorEmail,
                profile: c.authorProfile
            }
        }
    })));
});

// POST /community/:id/comments - Add comment
app.post('/:id/comments', async (c) => {
    const db = createDb(c.env.DB);
    const postId = c.req.param('id');
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    const { content } = await c.req.json();
    if (!content) return c.json({ error: 'Content is required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(communityComments).values({
        id,
        postId,
        authorId: member.id,
        content
    });

    await db.update(communityPosts)
        .set({ commentsCount: sql`${communityPosts.commentsCount} + 1` })
        .where(eq(communityPosts.id, postId))
        .run();

    return c.json({ id }, 201);
});

// PATCH /community/:id/pin - Toggle pin (owner only)
app.patch('/:id/pin', async (c) => {
    const db = createDb(c.env.DB);
    const postId = c.req.param('id');
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access denied' }, 403);

    const post = await db.select({ isPinned: communityPosts.isPinned })
        .from(communityPosts)
        .where(and(eq(communityPosts.id, postId), eq(communityPosts.tenantId, tenant.id)))
        .get();

    if (!post) return c.json({ error: 'Post not found' }, 404);

    await db.update(communityPosts)
        .set({ isPinned: !post.isPinned })
        .where(eq(communityPosts.id, postId))
        .run();

    return c.json({ isPinned: !post.isPinned });
});

// DELETE /community/:id - Delete post
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const postId = c.req.param('id');
    const tenant = c.get('tenant');
    const member = c.get('member');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const post = await db.select({ authorId: communityPosts.authorId })
        .from(communityPosts)
        .where(and(eq(communityPosts.id, postId), eq(communityPosts.tenantId, tenant.id)))
        .get();

    if (!post) return c.json({ error: 'Post not found' }, 404);

    // Only author or owner can delete
    if (post.authorId !== member?.id && !roles.includes('owner')) {
        return c.json({ error: 'Access denied' }, 403);
    }

    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    return c.json({ success: true });
});

export default app;
