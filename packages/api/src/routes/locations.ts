import { Hono } from 'hono';
import { createDb } from '../db';
import { locations, tenants, tenantMembers } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
    features: Set<string>;
    isImpersonating?: boolean;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /: List locations
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const allLocations = await db.select().from(locations).where(eq(locations.tenantId, tenant.id));
    return c.json({ locations: allLocations });
});

// POST /: Create location
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { name, address, timezone } = await c.req.json();

    if (!name) return c.json({ error: "Name is required" }, 400);

    // Limit Check
    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(db, tenant.id);
    const canAdd = await usageService.checkLimit('locations', tenant.tier || 'launch');

    if (!canAdd) {
        return c.json({
            error: "Location limit reached for your plan",
            code: "LIMIT_REACHED"
        }, 403);
    }

    const id = crypto.randomUUID();
    await db.insert(locations).values({
        id,
        tenantId: tenant.id,
        name,
        address,
        timezone: timezone || 'UTC'
    });

    return c.json({ success: true, id });
});

// DELETE /:id : Delete location
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

    // TODO: Check if classes exist for this location before deleting
    await db.delete(locations).where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)));

    return c.json({ success: true });
});

export default app;
