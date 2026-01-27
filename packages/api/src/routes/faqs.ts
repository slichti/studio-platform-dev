import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { faqs } from '@studio/db/src/schema';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant?: any;
    auth?: { userId: string; claims: any };
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// --- Public Routes ---

// GET /faqs - List active FAQs (public, optionally filtered by category)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const category = c.req.query('category');
    const tenant = c.get('tenant');

    // Build conditions: active only, and either platform-wide (tenantId=null) or tenant-specific
    const conditions = [eq(faqs.isActive, true)];

    if (category) {
        conditions.push(eq(faqs.category, category as any));
    }

    // Get platform-wide FAQs (tenantId is null)
    const platformFaqs = await db.select().from(faqs)
        .where(and(...conditions, isNull(faqs.tenantId)))
        .orderBy(asc(faqs.sortOrder))
        .all();

    // If tenant context, also get tenant-specific FAQs
    let tenantFaqs: any[] = [];
    if (tenant?.id) {
        tenantFaqs = await db.select().from(faqs)
            .where(and(...conditions, eq(faqs.tenantId, tenant.id)))
            .orderBy(asc(faqs.sortOrder))
            .all();
    }

    // Merge and sort by sortOrder
    const allFaqs = [...platformFaqs, ...tenantFaqs].sort((a, b) => a.sortOrder - b.sortOrder);

    return c.json({ faqs: allFaqs });
});

// GET /faqs/categories - List available categories
app.get('/categories', async (c) => {
    return c.json({
        categories: [
            { id: 'features', label: 'Features' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'support', label: 'Support' },
            { id: 'getting_started', label: 'Getting Started' }
        ]
    });
});

// --- Admin Routes ---

// GET /faqs/admin - List all FAQs for admin (includes inactive)
app.get('/admin', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');

    if (!auth?.userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if platform admin (for now, allow any authenticated user to view)
    // In production, add proper platform admin check
    const tenant = c.get('tenant');
    const category = c.req.query('category');

    const conditions: any[] = [];

    if (category) {
        conditions.push(eq(faqs.category, category as any));
    }

    // Platform admin sees platform FAQs, tenant admin sees tenant FAQs
    if (tenant?.id) {
        conditions.push(eq(faqs.tenantId, tenant.id));
    } else {
        conditions.push(isNull(faqs.tenantId));
    }

    const allFaqs = await db.select().from(faqs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(faqs.sortOrder))
        .all();

    return c.json({ faqs: allFaqs });
});

// POST /faqs/admin - Create new FAQ
app.post('/admin', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    const tenant = c.get('tenant');

    if (!auth?.userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { category, question, answer, sortOrder = 0, isActive = true } = body;

    if (!category || !question || !answer) {
        return c.json({ error: 'Category, question, and answer are required' }, 400);
    }

    const id = crypto.randomUUID();

    await db.insert(faqs).values({
        id,
        tenantId: tenant?.id || null, // null for platform-wide
        category,
        question,
        answer,
        sortOrder,
        isActive
    });

    return c.json({ id, success: true });
});

// PUT /faqs/admin/:id - Update FAQ
app.put('/admin/:id', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    const faqId = c.req.param('id');

    if (!auth?.userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const existing = await db.select().from(faqs).where(eq(faqs.id, faqId)).get();

    if (!existing) {
        return c.json({ error: 'FAQ not found' }, 404);
    }

    const body = await c.req.json();

    await db.update(faqs).set({
        category: body.category ?? existing.category,
        question: body.question ?? existing.question,
        answer: body.answer ?? existing.answer,
        sortOrder: body.sortOrder ?? existing.sortOrder,
        isActive: body.isActive ?? existing.isActive,
        updatedAt: new Date()
    }).where(eq(faqs.id, faqId)).run();

    return c.json({ success: true });
});

// DELETE /faqs/admin/:id - Delete FAQ
app.delete('/admin/:id', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');
    const faqId = c.req.param('id');

    if (!auth?.userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const existing = await db.select().from(faqs).where(eq(faqs.id, faqId)).get();

    if (!existing) {
        return c.json({ error: 'FAQ not found' }, 404);
    }

    await db.delete(faqs).where(eq(faqs.id, faqId)).run();

    return c.json({ success: true });
});

// PUT /faqs/admin/reorder - Bulk update sort order
app.put('/admin/reorder', async (c) => {
    const db = createDb(c.env.DB);
    const auth = c.get('auth');

    if (!auth?.userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { items } = body; // Array of { id, sortOrder }

    if (!Array.isArray(items)) {
        return c.json({ error: 'Items array required' }, 400);
    }

    // Update each item's sort order
    for (const item of items) {
        if (item.id && typeof item.sortOrder === 'number') {
            await db.update(faqs).set({
                sortOrder: item.sortOrder,
                updatedAt: new Date()
            }).where(eq(faqs.id, item.id)).run();
        }
    }

    return c.json({ success: true });
});

export default app;
