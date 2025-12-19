import { Hono } from 'hono';
import { classes, tenants, bookings } from 'db/src/schema';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { ZoomService } from '../services/zoom';

type Bindings = {
    DB: D1Database;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: typeof tenants.$inferSelect;
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    // Assuming tenant middleware sets c.var.tenant, or we filter by query param?
    // Use auth tenant or similar. 
    // The current architecture assumes a tenant-aware middleware or we pass tenantId.
    // For now, let's assume we want all classes for the CURRENT tenant from the URL (which the middleware should handle but we haven't fully linked it to domain decoding yet).
    // Let's rely on a query param `tenantId` for basic testing OR c.var.tenant if available.
    // However, the `studios` implementation doesn't strictly assume we are "inside" a tenant context.
    // Let's use specific tenantId query for now to be explicit, or rely on c.var.tenant if the middleware sets it.

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const results = await db.select().from(classes).where(eq(classes.tenantId, tenant.id));
    return c.json(results);
});

app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const userId = c.get('auth').userId;

    const body = await c.req.json();
    const { title, description, startTime, durationMinutes, capacity, locationId, createZoomMeeting } = body;

    const id = crypto.randomUUID();
    let zoomMeetingUrl: string | undefined = undefined;

    if (createZoomMeeting && c.env.ZOOM_ACCOUNT_ID) {
        try {
            const zoom = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET);
            zoomMeetingUrl = await zoom.createMeeting(userId, title, new Date(startTime), durationMinutes);
        } catch (e) {
            console.error("Zoom creation failed:", e);
            // Don't fail the whole request, just proceed without Zoom? Or return error?
            // Let's log and proceed for now, but in production we might want to alert.
        }
    }

    try {
        await db.insert(classes).values({
            id,
            tenantId: tenant.id,
            instructorId: userId, // Assuming Creator is Instructor for now
            title,
            description,
            startTime: new Date(startTime),
            durationMinutes,
            capacity,
            locationId,
            zoomMeetingUrl
        });
        return c.json({ id, title, zoomMeetingUrl }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/:id/book', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const userId = c.get('auth').userId;

    // Optional: Check class existence and capacity
    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo) return c.json({ error: 'Class not found' }, 404);

    // Check if already booked
    // const existing = await db.select().from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.userId, userId))).get();
    // if (existing) return c.json({ error: 'Already booked' }, 400);

    const id = crypto.randomUUID();

    try {
        // Need to import bookings table
        const { bookings } = await import('db/src/schema');

        await db.insert(bookings).values({
            id,
            classId,
            userId,
            status: 'confirmed'
        });

        return c.json({ id, status: 'confirmed' }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
