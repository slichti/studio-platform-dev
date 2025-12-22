import { Hono } from 'hono';
import { classes, tenants, bookings, tenantMembers, users, tenantRoles } from 'db/src/schema';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { ZoomService } from '../services/zoom';

type Bindings = {
    DB: D1Database;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
    STRIPE_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
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
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member context required' }, 403);
    const userId = c.get('auth').userId;

    // RBAC: Only Instructors or Owners can create classes
    // We can check roles in c.get('roles')
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Only instructors or owners can create classes' }, 403);
    }

    const body = await c.req.json();

    // Zod Validation
    const { z } = await import('zod');
    const createClassSchema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startTime: z.string().or(z.date()).pipe(z.coerce.date()), // Handle ISO strings
        durationMinutes: z.number().int().positive(),
        capacity: z.number().int().positive().optional(),
        locationId: z.string().optional(),
        createZoomMeeting: z.boolean().optional(),
        price: z.number().int().nonnegative().optional().default(0),
        currency: z.string().default('usd')
    });

    const parseResult = createClassSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }

    const { title, description, startTime, durationMinutes, capacity, locationId, createZoomMeeting, price, currency } = parseResult.data;

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
            instructorId: member.id, // Fixed: Use Tenant Member ID
            title,
            description,
            startTime: new Date(startTime),
            durationMinutes,
            capacity,
            locationId,
            zoomMeetingUrl,
            price: price || 0,
            currency: currency || 'usd'
        });
        return c.json({ id, title, zoomMeetingUrl }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/:id/book', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const auth = c.get('auth');
    if (!auth || !auth.userId) {
        return c.json({ error: 'Authentication required' }, 401);
    }
    const userId = auth.userId;

    // Optional: Check class existence and capacity
    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo) return c.json({ error: 'Class not found' }, 404);

    // Check if already booked
    // const existing = await db.select().from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.userId, userId))).get();
    // if (existing) return c.json({ error: 'Already booked' }, 400);

    const id = crypto.randomUUID();

    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

        // Find or Auto-Join Member
        let member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id))
        });

        if (!member) {
            // Auto-join as Student?
            const memberId = crypto.randomUUID();
            await db.insert(tenantMembers).values({
                id: memberId,
                tenantId: tenant.id,
                userId: userId
            });
            // Add student role
            await db.insert(tenantRoles).values({
                memberId: memberId,
                role: 'student'
            });
            member = { id: memberId } as any;
        }

        await db.insert(bookings).values({
            id,
            classId,
            memberId: member!.id,
            status: 'confirmed'
        });

        return c.json({ id, status: 'confirmed' }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/:id/bookings', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');

    // RBAC: Instructor or Owner only
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        const results = await db.select({
            id: bookings.id,
            status: bookings.status,
            user: {
                id: users.id,
                email: users.email,
                profile: users.profile
            },
            createdAt: bookings.createdAt
        })
            .from(bookings)
            .innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(bookings.classId, classId));

        return c.json(results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
