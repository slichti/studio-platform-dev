import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantFeatures } from '@studio/db/src/schema'; // Ensure correct import
import { eq, and } from 'drizzle-orm';

// Bindings and Variables should match index.ts or be imported
type Bindings = {
    DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// GET /
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    if (!tenantId) return c.json({ error: 'Missing tenantId' }, 400);

    const features = await db.select().from(tenantFeatures).where(eq(tenantFeatures.tenantId, tenantId)).all();

    const result = features.reduce((acc, f) => {
        acc[f.featureKey] = { enabled: f.enabled, source: f.source || 'manual' };
        return acc;
    }, {} as Record<string, { enabled: boolean, source: string }>);

    return c.json({ features: result });
});

// POST /
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    if (!tenantId) return c.json({ error: 'Missing tenantId' }, 400);
    const { featureKey, enabled, source } = await c.req.json();

    if (!featureKey) return c.json({ error: 'Missing featureKey' }, 400);

    // Upsert
    await db.insert(tenantFeatures).values({
        id: crypto.randomUUID(),
        tenantId,
        featureKey,
        enabled: enabled ?? false,
        source: source || 'manual',
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: [tenantFeatures.tenantId, tenantFeatures.featureKey],
        set: {
            enabled: enabled ?? false,
            source: source || 'manual',
            updatedAt: new Date()
        }
    }).run();

    return c.json({ success: true });
});

export default app;
