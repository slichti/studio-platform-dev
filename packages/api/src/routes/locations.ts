import { Hono } from 'hono';
import { createDb } from '../db';
import { locations } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

import { quotaMiddleware } from '../middleware/quota';

const app = new Hono<HonoContext>();

// GET /slug/:slug : Get location by slug
app.get('/slug/:slug', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);
    const slug = c.req.param('slug');

    const location = await db.select().from(locations)
        .where(and(eq(locations.slug, slug), eq(locations.tenantId, tenant.id)))
        .get();

    if (!location) return c.json({ error: 'Location not found' }, 404);
    return c.json(location);
});

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
    const { name, address, timezone, slug: providedSlug, seoConfig } = await c.req.json();

    if (!name) return c.json({ error: "Name is required" }, 400);

    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const slug = providedSlug || slugify(name);

    const id = crypto.randomUUID();
    await db.insert(locations).values({
        id,
        tenantId: tenant.id,
        name,
        slug,
        address,
        timezone: timezone || 'UTC',
        seoConfig: seoConfig || {}
    });

    return c.json({ success: true, id, slug });
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

// PATCH /:id : Update location
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const id = c.req.param('id');
    const { name, address, timezone, slug, seoConfig, isActive, isPrimary } = await c.req.json();

    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (timezone !== undefined) updates.timezone = timezone;
    if (slug !== undefined) {
        const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '-');
        updates.slug = slug || (name ? slugify(name) : undefined);
    }
    if (seoConfig !== undefined) updates.seoConfig = seoConfig;
    if (isActive !== undefined) updates.isActive = isActive;
    if (isPrimary !== undefined) updates.isPrimary = isPrimary;

    await db.update(locations)
        .set(updates)
        .where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// GET /:id/stats : Location-specific statistics
app.get('/:id/stats', async (c) => {
    if (!c.get('can')('view_reports')) {
        return c.json({ error: 'Access Denied' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const locationId = c.req.param('id');
    const { classes, bookings } = await import('@studio/db/src/schema');

    // Get class count
    const classCount = await db.select({ count: sql<number>`count(*)` })
        .from(classes)
        .where(and(
            eq(classes.locationId, locationId),
            eq(classes.status, 'active')
        ))
        .get();

    // Get total bookings
    const bookingCount = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            eq(classes.locationId, locationId),
            eq(bookings.status, 'confirmed')
        ))
        .get();

    return c.json({
        locationId,
        stats: {
            activeClasses: classCount?.count || 0,
            totalBookings: bookingCount?.count || 0,
        }
    });
});

export default app;
