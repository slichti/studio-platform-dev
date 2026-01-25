
import { Hono } from 'hono';
import { createDb } from '../db';
import { coupons, couponRedemptions } from '@studio/db/src/schema'; // Updated imports
import { eq, desc, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 500);
    const tenantId = tenant.id;
    const db = createDb(c.env.DB);

    const results = await db.select({
        id: coupons.id,
        code: coupons.code,
        type: coupons.type,
        value: coupons.value,
        active: coupons.active,
        usageLimit: coupons.usageLimit,
        expiresAt: coupons.expiresAt,
        createdAt: coupons.createdAt,
        redemptions: sql<number>`(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = coupons.id)`
    })
        .from(coupons)
        .where(eq(coupons.tenantId, tenantId))
        .orderBy(desc(coupons.createdAt))
        .all();

    return c.json(results);
});

app.post('/', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = createDb(c.env.DB);
    const body = await c.req.json();

    const id = uuidv4();

    // Check uniqueness (ignoring case usually, but here exact for simplicity unless we lower)
    // body.code should be uppercase?
    const code = body.code.toUpperCase();

    // Basic conflict check
    const existing = await db.select().from(coupons)
        .where(and(eq(coupons.tenantId, tenantId), eq(coupons.code, code)))
        .get();

    if (existing) {
        return c.json({ error: 'Coupon code already exists' }, 400);
    }

    await db.insert(coupons).values({
        id,
        tenantId,
        code,
        type: body.type, // 'percent' | 'amount'
        value: Number(body.value),
        active: body.active !== false,
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdAt: new Date()
    }).run();

    return c.json({ id, code });
});

app.put('/:id', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();

    await db.update(coupons).set({
        active: body.active,
        usageLimit: body.usageLimit,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
    })
        .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)))
        .run();

    return c.json({ success: true });
});

app.delete('/:id', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = createDb(c.env.DB);
    const id = c.req.param('id');

    // Soft delete or Hard delete? Schema doesn't have deletedAt.
    // Let's delete. Redemptions might reference it via foreign key?
    // SQLite foreign keys might restriction deletion if redemptions exist.
    // Safe option: de-active.
    // User requested Archive/Delete.

    // Check for redemptions
    const usage = await db.select({ count: sql<number>`count(*)` })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, id))
        .get();

    if (usage && usage.count > 0) {
        // Can't delete, just deactivate
        await db.update(coupons).set({ active: false }).where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId))).run();
        return c.json({ success: true, message: 'Coupon has redemptions, deactivated instead of deleted.' });
    }

    await db.delete(coupons).where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId))).run();
    return c.json({ success: true });
});

export default app;
