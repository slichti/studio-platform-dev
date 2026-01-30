import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { faqs } from '@studio/db/src/schema';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const cat = c.req.query('category');
    const t = c.get('tenant');
    const conds = [eq(faqs.isActive, true)];
    if (cat) conds.push(eq(faqs.category, cat as any));

    const platform = await db.select().from(faqs).where(and(...conds, isNull(faqs.tenantId))).orderBy(asc(faqs.sortOrder)).all();
    let tenantList: any[] = [];
    if (t?.id) tenantList = await db.select().from(faqs).where(and(...conds, eq(faqs.tenantId, t.id))).orderBy(asc(faqs.sortOrder)).all();

    return c.json({ faqs: [...platform, ...tenantList].sort((a, b) => a.sortOrder - b.sortOrder) });
});

// GET /categories
app.get('/categories', async (c) => c.json({ categories: [{ id: 'features', label: 'Features' }, { id: 'pricing', label: 'Pricing' }, { id: 'support', label: 'Support' }, { id: 'getting_started', label: 'Getting Started' }] }));

// Admin Routes (Platform or Tenant)
app.get('/admin', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    const canManageTenant = c.get('can')('manage_tenant');
    if (!isPlatformAdmin && !canManageTenant) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const t = c.get('tenant');
    const conds: any[] = [];
    if (t?.id) conds.push(eq(faqs.tenantId, t.id));
    else conds.push(isNull(faqs.tenantId));

    return c.json({ faqs: await db.select().from(faqs).where(and(...conds)).orderBy(asc(faqs.sortOrder)).all() });
});

app.post('/admin', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    const canManageTenant = c.get('can')('manage_tenant');
    if (!isPlatformAdmin && !canManageTenant) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const { category, question, answer, sortOrder, isActive } = await c.req.json();
    if (!category || !question || !answer) return c.json({ error: 'Missing fields' }, 400);

    const id = crypto.randomUUID();
    await db.insert(faqs).values({ id, tenantId: c.get('tenant')?.id || null, category, question, answer, sortOrder: sortOrder || 0, isActive: isActive ?? true }).run();
    return c.json({ id, success: true });
});

app.delete('/admin/:id', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    const canManageTenant = c.get('can')('manage_tenant');
    if (!isPlatformAdmin && !canManageTenant) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const fid = c.req.param('id');
    const exists = await db.select().from(faqs).where(eq(faqs.id, fid)).get();
    if (!exists) return c.json({ error: 'Not found' }, 404);

    if (exists.tenantId && exists.tenantId !== c.get('tenant')?.id) return c.json({ error: 'Forbidden' }, 403);
    if (!exists.tenantId && !isPlatformAdmin) return c.json({ error: 'Forbidden' }, 403);

    await db.delete(faqs).where(eq(faqs.id, fid)).run();
    return c.json({ success: true });
});

export default app;
