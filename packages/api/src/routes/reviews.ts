import { Hono } from 'hono';
import { createDb } from '../db';
import { reviews, tenantMembers, users } from '@studio/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';
import { HonoContext } from '../types';
import { GeminiService } from '../services/gemini';

const app = new Hono<HonoContext>();

// GET /reviews
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const filterAll = c.get('can')('manage_marketing');

    const results = await db.select({
        id: reviews.id, rating: reviews.rating, content: reviews.content, targetType: reviews.targetType,
        targetId: reviews.targetId, isTestimonial: reviews.isTestimonial, isApproved: reviews.isApproved,
        isPublic: reviews.isPublic, replyDraft: reviews.replyDraft, replyDraftGeneratedAt: reviews.replyDraftGeneratedAt,
        createdAt: reviews.createdAt, memberId: tenantMembers.id, memberProfile: users.profile
    })
        .from(reviews)
        .innerJoin(tenantMembers, eq(reviews.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(filterAll ? eq(reviews.tenantId, tenant.id) : and(eq(reviews.tenantId, tenant.id), eq(reviews.isApproved, true), eq(reviews.isPublic, true)))
        .orderBy(desc(reviews.createdAt)).all();

    return c.json(results.map(r => ({
        ...r, member: { id: r.memberId, user: { profile: r.memberProfile } }
    })));
});

// GET /testimonials
app.get('/testimonials', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const results = await db.select({
        id: reviews.id, rating: reviews.rating, content: reviews.content, createdAt: reviews.createdAt, memberProfile: users.profile
    })
        .from(reviews).innerJoin(tenantMembers, eq(reviews.memberId, tenantMembers.id)).innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.isTestimonial, true), eq(reviews.isApproved, true)))
        .orderBy(desc(reviews.rating)).limit(10).all();

    return c.json(results.map(r => ({ ...r, member: { user: { profile: r.memberProfile } } })));
});

// GET /stats
app.get('/stats', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const allReviews = await db.select({ rating: reviews.rating }).from(reviews).where(and(eq(reviews.tenantId, tenant.id), eq(reviews.isApproved, true))).all();
    const total = allReviews.length;
    const avgRating = total ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : '0.0';
    const distribution = [1, 2, 3, 4, 5].map(star => ({ star, count: allReviews.filter(r => r.rating === star).length }));

    return c.json({ total, avgRating: parseFloat(avgRating), distribution });
});

// POST /reviews
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 400);

    const { rating, content, targetType, targetId, isTestimonial } = await c.req.json();
    if (!rating || rating < 1 || rating > 5) return c.json({ error: 'Rating 1-5' }, 400);

    const id = crypto.randomUUID();
    await db.insert(reviews).values({
        id, tenantId: tenant.id, memberId: member.id, rating, content, targetType: targetType || 'studio',
        targetId, isTestimonial: !!isTestimonial, isApproved: false, isPublic: true
    }).run();
    return c.json({ id }, 201);
});

// PATCH /:id/approve
app.patch('/:id/approve', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);
    const { isApproved, isTestimonial } = await c.req.json();

    await db.update(reviews).set({ isApproved: isApproved ?? true, isTestimonial }).where(and(eq(reviews.id, c.req.param('id')), eq(reviews.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

// POST /:id/draft-reply — Generate AI draft reply (Review AI T3.4)
app.post('/:id/draft-reply', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: 'Review AI not configured (missing GEMINI_API_KEY)' }, 503);

    const id = c.req.param('id');
    const row = await db.select({ content: reviews.content, rating: reviews.rating }).from(reviews)
        .where(and(eq(reviews.id, id), eq(reviews.tenantId, tenant.id))).get();
    if (!row) return c.json({ error: 'Not found' }, 404);

    const settings = (tenant.settings as any) || {};
    const seo = settings.seo || {};
    const gemini = new GeminiService(apiKey);
    const draft = await gemini.generateReviewReplyDraft({
        reviewContent: row.content,
        rating: row.rating,
        studioName: tenant.name,
        businessType: seo.businessType || 'fitness studio',
        city: seo.location,
    });

    const now = Math.floor(Date.now() / 1000);
    await db.update(reviews).set({ replyDraft: draft, replyDraftGeneratedAt: new Date(now * 1000) })
        .where(and(eq(reviews.id, id), eq(reviews.tenantId, tenant.id))).run();
    return c.json({ replyDraft: draft });
});

// PATCH /:id/reply-draft — Save or clear manual draft
app.patch('/:id/reply-draft', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Access denied' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);
    const { replyDraft } = await c.req.json() as { replyDraft?: string | null };
    const id = c.req.param('id');
    const update: { replyDraft: string | null; replyDraftGeneratedAt: Date | null } = {
        replyDraft: replyDraft ?? null,
        replyDraftGeneratedAt: replyDraft ? new Date() : null,
    };
    await db.update(reviews).set(update)
        .where(and(eq(reviews.id, id), eq(reviews.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const review = await db.select({ memberId: reviews.memberId }).from(reviews).where(and(eq(reviews.id, c.req.param('id')), eq(reviews.tenantId, tenant.id))).get();
    if (!review) return c.json({ error: 'Not found' }, 404);

    const canDelete = review.memberId === member?.id || c.get('can')('manage_marketing');
    if (!canDelete) return c.json({ error: 'Unauthorized' }, 403);

    await db.delete(reviews).where(eq(reviews.id, c.req.param('id'))).run();
    return c.json({ success: true });
});

export default app;
