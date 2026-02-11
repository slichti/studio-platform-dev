
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { tenants, tenantMembers, users, bookings, classes, tenantFeatures } from '@studio/db/src/schema';
import { BookingService } from '../services/bookings';
import { eq, and, like, desc, gte, sql, inArray, or } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import type { Variables } from '../types';

const app = createOpenAPIApp<Variables>();

// --- Schemas ---

const KioskAuthSchema = z.object({
    tenantSlug: z.string(),
    pin: z.string()
});

const KioskAuthResponseSchema = z.object({
    token: z.string(),
    tenant: z.object({
        id: z.string(),
        name: z.string()
    })
});

const KioskMemberSchema = z.object({
    memberId: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    portraitUrl: z.string().nullable(),
    email: z.string(),
    nextBooking: z.object({
        id: z.string(),
        className: z.string(),
        startTime: z.any(), // Date or string
        status: z.string(),
        checkedInAt: z.any().nullable()
    }).nullable(),
    hasBookingToday: z.boolean()
});

const KioskSearchResponseSchema = z.array(KioskMemberSchema);

const CheckinResponseSchema = z.object({
    success: z.boolean(),
    timestamp: z.string()
});

// --- Middleware ---

const kioskAuth = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: "Missing Kiosk Token" }, 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = await verify(token, c.env.ENCRYPTION_SECRET as string, 'HS256');
        if (!payload.kioskTenantId) {
            throw new Error("Invalid Token");
        }
        c.set('kioskTenantId', payload.kioskTenantId);
        await next();
    } catch (e) {
        return c.json({ error: "Invalid or Expired Token" }, 401);
    }
};

// --- Routes ---

/**
 * POST /kiosk/auth
 */
app.openapi(createRoute({
    method: 'post',
    path: '/auth',
    tags: ['Kiosk'],
    summary: 'Authenticate Kiosk',
    description: 'Exchange Tenant Slug and PIN for a long-lived Kiosk JWT.',
    request: {
        body: {
            content: {
                'application/json': { schema: KioskAuthSchema }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: KioskAuthResponseSchema } }, description: 'Authenticated' },
        400: { description: 'Bad Request' },
        401: { description: 'Invalid PIN' },
        403: { description: 'Kiosk mode disabled' },
        404: { description: 'Studio not found' }
    }
}), async (c) => {
    const { tenantSlug, pin } = c.req.valid('json');
    const db = createDb(c.env.DB);

    const tenant = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).get();
    if (!tenant) return c.json({ error: "Studio not found" }, 404);

    // Verify Feature Logic
    const kioskFeature = await db.select().from(tenantFeatures)
        .where(and(eq(tenantFeatures.tenantId, tenant.id), eq(tenantFeatures.featureKey, 'kiosk')))
        .get();

    if (!kioskFeature || !kioskFeature.enabled) {
        return c.json({ error: "Kiosk Mode is not enabled for this studio." }, 403);
    }

    const settings = (tenant.settings || {}) as any;
    if (!settings.kioskPin) {
        return c.json({ error: "Kiosk PIN is not configured." }, 400);
    }

    if (settings.kioskPin !== pin) {
        return c.json({ error: "Invalid PIN" }, 401);
    }

    // Generate Long-Lived Kiosk Token
    const token = await sign({
        kioskTenantId: tenant.id,
        role: 'kiosk',
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }, c.env.ENCRYPTION_SECRET as string, 'HS256');

    return c.json({ token, tenant: { id: tenant.id, name: tenant.name } });
});

// --- Protected Routes ---

const protectedApp = createOpenAPIApp<Variables & { kioskTenantId: string }>();
protectedApp.use('*', kioskAuth);

/**
 * GET /kiosk/search?q=John
 */
protectedApp.openapi(createRoute({
    method: 'get',
    path: '/search',
    tags: ['Kiosk'],
    summary: 'Search Students',
    request: {
        query: z.object({
            q: z.string().min(2)
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: KioskSearchResponseSchema } }, description: 'Search results' },
        401: { description: 'Unauthorized' }
    }
}), async (c) => {
    const tenantId = c.get('kioskTenantId');
    const query = c.req.valid('query').q;
    // if (query.length < 2) return c.json([]); // Handled by Zod min(2) usually, but Zod throws 400.

    const db = createDb(c.env.DB);

    const results = await db.select({
        memberId: tenantMembers.id,
        firstName: sql<string>`json_extract(${users.profile}, '$.firstName')`,
        lastName: sql<string>`json_extract(${users.profile}, '$.lastName')`,
        portraitUrl: sql<string>`json_extract(${users.profile}, '$.portraitUrl')`,
        email: users.email
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantMembers.status, 'active'),
            or(
                like(users.email, `%${query}%`),
                like(sql`json_extract(${users.profile}, '$.firstName')`, `%${query}%`),
                like(sql`json_extract(${users.profile}, '$.lastName')`, `%${query}%`)
            )
        ))
        .limit(10)
        .all();

    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    const memberIds = results.map(r => r.memberId);

    if (memberIds.length === 0) return c.json([]);

    const fileteredBookings = await db.select({
        id: bookings.id,
        memberId: bookings.memberId,
        className: classes.title,
        startTime: classes.startTime,
        status: bookings.status,
        checkedInAt: bookings.checkedInAt
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(
            inArray(bookings.memberId, memberIds),
            gte(classes.startTime, startOfDay)
        ))
        .orderBy(desc(classes.startTime))
        .all();

    const finalResults = results.map(m => {
        const memberBookings = fileteredBookings.filter(b => b.memberId === m.memberId);
        const nextBooking = memberBookings.find(b => !b.checkedInAt);
        return {
            ...m,
            nextBooking: nextBooking || null,
            hasBookingToday: memberBookings.length > 0
        };
    });

    return c.json(finalResults);
});

/**
 * POST /kiosk/checkin/:bookingId
 */
protectedApp.openapi(createRoute({
    method: 'post',
    path: '/checkin/{bookingId}',
    tags: ['Kiosk'],
    summary: 'Check-in Booking',
    request: {
        params: z.object({ bookingId: z.string() })
    },
    responses: {
        200: { content: { 'application/json': { schema: CheckinResponseSchema } }, description: 'Checked in' },
        400: { description: 'Bad Request' },
        401: { description: 'Unauthorized' },
        500: { description: 'Internal Error' }
    }
}), async (c) => {
    const tenantId = c.get('kioskTenantId');
    const bookingId = c.req.valid('param').bookingId;
    const db = createDb(c.env.DB);

    const service = new BookingService(db, c.env);

    try {
        await service.checkIn(bookingId, true, tenantId);
        return c.json({ success: true, timestamp: new Date().toISOString() });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.route('/', protectedApp);

export default app;
