import { Hono } from 'hono';
import { createDb } from '../db';
import { locations } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

import { quotaMiddleware } from '../middleware/quota';

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
app.post('/', quotaMiddleware('locations'), async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { name, address, timezone } = await c.req.json();

    if (!name) return c.json({ error: "Name is required" }, 400);

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

    // Check if classes exist for this location before deleting

    const { classes } = await import('@studio/db/src/schema');
    const classCount = await db.select({ count: sql<number>`count(*)` })
        .from(classes)
        .where(and(eq(classes.locationId, id), eq(classes.tenantId, tenant.id)))
        .get();

    if (classCount && classCount.count > 0) {
        return c.json({ error: "Cannot delete location with active classes. Please reassign or delete classes first." }, 409);
    }

    await db.delete(locations).where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)));

    return c.json({ success: true });
});

export default app;
