import { Hono } from 'hono';
import { createDb } from '../db';
import { locations } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /: List locations
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const allLocations = await db.select().from(locations).where(eq(locations.tenantId, tenant.id));
    return c.json({ locations: allLocations });
});

// POST /: Create location
app.post('/', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);
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
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);
    const id = c.req.param('id');

    // TODO: Check if classes exist for this location before deleting
    await db.delete(locations).where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)));

    return c.json({ success: true });
});

export default app;
