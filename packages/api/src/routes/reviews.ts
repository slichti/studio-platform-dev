import { Hono } from 'hono';
import { createDb } from '../db';
import { reviews, tenantMembers, users, classes } from 'db';
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

// GET /reviews - List reviews (public or all for owner)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const isOwner = roles.includes('owner');

    const results = await db.select({
        id: reviews.id,
        rating: reviews.rating,
        content: reviews.content,
        targetType: reviews.targetType,
        targetId: reviews.targetId,
        isTestimonial: reviews.isTestimonial,
        isApproved: reviews.isApproved,
        isPublic: reviews.isPublic,
        createdAt: reviews.createdAt,
        memberId: tenantMembers.id,
        memberProfile: users.profile
    })
        .from(reviews)
        .innerJoin(tenantMembers, eq(reviews.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(
            isOwner
                ? eq(reviews.tenantId, tenant.id)
                : and(eq(reviews.tenantId, tenant.id), eq(reviews.isApproved, true), eq(reviews.isPublic, true))
        )
        .orderBy(desc(reviews.createdAt))
        .all();

    return c.json(results.map(r => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        targetType: r.targetType,
        targetId: r.targetId,
        isTestimonial: r.isTestimonial,
        isApproved: r.isApproved,
        isPublic: r.isPublic,
        createdAt: r.createdAt,
        member: {
            id: r.memberId,
            user: { profile: r.memberProfile }
        }
    })));
});

// GET /reviews/testimonials - Get approved testimonials for public display
app.get('/testimonials', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const results = await db.select({
        id: reviews.id,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        memberProfile: users.profile
    })
        .from(reviews)
        .innerJoin(tenantMembers, eq(reviews.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(reviews.tenantId, tenant.id),
            eq(reviews.isTestimonial, true),
            eq(reviews.isApproved, true)
        ))
        .orderBy(desc(reviews.rating))
        .limit(10)
        .all();

    return c.json(results.map(r => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
        member: {
            user: { profile: r.memberProfile }
        }
    })));
});

// GET /reviews/stats - Get review statistics
app.get('/stats', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const allReviews = await db.select({ rating: reviews.rating })
        .from(reviews)
        .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.isApproved, true)))
        .all();

    const total = allReviews.length;
    const avgRating = total ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : '0.0';
    const distribution = [1, 2, 3, 4, 5].map(star => ({
        star,
        count: allReviews.filter(r => r.rating === star).length
    }));

    return c.json({ total, avgRating: parseFloat(avgRating), distribution });
});

// POST /reviews - Create review
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    const { rating, content, targetType, targetId, isTestimonial } = await c.req.json();

    if (!rating || rating < 1 || rating > 5) {
        return c.json({ error: 'Rating must be 1-5' }, 400);
    }

    const id = crypto.randomUUID();
    await db.insert(reviews).values({
        id,
        tenantId: tenant.id,
        memberId: member.id,
        rating,
        content,
        targetType: targetType || 'studio',
        targetId,
        isTestimonial: isTestimonial || false,
        isApproved: false, // Requires approval
        isPublic: true
    });

    return c.json({ id }, 201);
});

// PATCH /reviews/:id/approve - Approve/reject review (owner only)
app.patch('/:id/approve', async (c) => {
    const db = createDb(c.env.DB);
    const reviewId = c.req.param('id');
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access denied' }, 403);

    const { isApproved, isTestimonial } = await c.req.json();

    await db.update(reviews)
        .set({
            isApproved: isApproved ?? true,
            isTestimonial: isTestimonial
        })
        .where(and(eq(reviews.id, reviewId), eq(reviews.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// DELETE /reviews/:id - Delete review
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const reviewId = c.req.param('id');
    const tenant = c.get('tenant');
    const member = c.get('member');
    const roles = c.get('roles') || [];

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const review = await db.select({ memberId: reviews.memberId })
        .from(reviews)
        .where(and(eq(reviews.id, reviewId), eq(reviews.tenantId, tenant.id)))
        .get();

    if (!review) return c.json({ error: 'Review not found' }, 404);

    // Only author or owner can delete
    if (review.memberId !== member?.id && !roles.includes('owner')) {
        return c.json({ error: 'Access denied' }, 403);
    }

    await db.delete(reviews).where(eq(reviews.id, reviewId));
    return c.json({ success: true });
});

export default app;
