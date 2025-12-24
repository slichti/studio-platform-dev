import { Hono } from 'hono';
import { createDb } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { classPackDefinitions, purchasedPacks, tenantMembers, users } from 'db/src/schema';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: any;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /commerce/packs: List defined packs
app.get('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const packs = await db.query.classPackDefinitions.findMany({
        where: and(
            eq(classPackDefinitions.tenantId, tenant.id),
            eq(classPackDefinitions.active, true)
        ),
        orderBy: [desc(classPackDefinitions.createdAt)]
    });

    return c.json({ packs });
});

// POST /commerce/packs: Create a new pack definition (Owner only)
app.post('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const { name, credits, price, expirationDays } = await c.req.json();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner')) return c.json({ error: 'Access Denied' }, 403);

    const newPack = {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        name,
        price: price || 0,
        credits: credits || 1,
        expirationDays: expirationDays || null,
        active: true,
        createdAt: new Date()
    };

    await db.insert(classPackDefinitions).values(newPack).run();

    return c.json({ pack: newPack });
});

// POST /commerce/purchase: Assign a pack to a student (Owner/Instructor only for now)
// In a real app, this would be a webhook from Stripe OR a manual POS action
app.post('/purchase', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const { memberId, packId } = await c.req.json();

    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // 1. Verify Member
    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenant.id))
    });
    if (!member) return c.json({ error: 'Student not found' }, 404);

    // 2. Verify Pack Definition
    const packDef = await db.query.classPackDefinitions.findFirst({
        where: and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id))
    });
    if (!packDef) return c.json({ error: 'Pack not found' }, 404);

    // 3. Calculate Expiry
    let expiresAt: Date | undefined;
    if (packDef.expirationDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + packDef.expirationDays);
    }

    // 4. Record Purchase (Grant Credits)
    const newPurchase = {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        memberId,
        packDefinitionId: packId,
        initialCredits: packDef.credits,
        remainingCredits: packDef.credits,
        expiresAt: expiresAt || null,
        createdAt: new Date()
    };

    await db.insert(purchasedPacks).values(newPurchase).run();

    return c.json({ purchase: newPurchase });
});

export default app;
