
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { tenants, tenantMembers, users, bookings, classes, tenantFeatures, purchasedPacks } from '@studio/db/src/schema';
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
    hasBookingToday: z.boolean(),
    availableCredits: z.number().optional()
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

    // Constant-time PIN comparison to prevent timing attacks
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);
    const storedPinBytes = encoder.encode(settings.kioskPin);
    if (pinBytes.length !== storedPinBytes.length) {
        return c.json({ error: "Invalid PIN" }, 401);
    }
    const key = await crypto.subtle.importKey('raw', new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const [pinMac, storedMac] = await Promise.all([
        crypto.subtle.sign('HMAC', key, pinBytes),
        crypto.subtle.sign('HMAC', key, storedPinBytes)
    ]);
    const pinMacArr = new Uint8Array(pinMac);
    const storedMacArr = new Uint8Array(storedMac);
    let match = true;
    for (let i = 0; i < pinMacArr.length; i++) {
        if (pinMacArr[i] !== storedMacArr[i]) match = false;
    }
    if (!match) {
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

    // Get credit counts for each member
    const allPacks = memberIds.length > 0
        ? await db.select({
            memberId: purchasedPacks.memberId,
            credits: purchasedPacks.remainingCredits
        })
            .from(purchasedPacks)
            .where(inArray(purchasedPacks.memberId, memberIds))
            .all()
        : [];

    const creditsByMember: Record<string, number> = {};
    for (const p of allPacks) {
        creditsByMember[p.memberId] = (creditsByMember[p.memberId] || 0) + (p.credits || 0);
    }

    const finalResults = results.map(m => {
        const memberBookings = fileteredBookings.filter(b => b.memberId === m.memberId);
        const nextBooking = memberBookings.find(b => !b.checkedInAt);
        return {
            ...m,
            nextBooking: nextBooking || null,
            hasBookingToday: memberBookings.length > 0,
            availableCredits: creditsByMember[m.memberId] || 0
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

/**
 * GET /kiosk/today-classes — Get today's upcoming classes for walk-in booking
 */
protectedApp.get('/today-classes', async (c) => {
    const tenantId = c.get('kioskTenantId');
    const db = createDb(c.env.DB);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const todayClasses = await db.select({
        id: classes.id,
        title: classes.title,
        startTime: classes.startTime,
        capacity: classes.capacity
    })
        .from(classes)
        .where(and(
            eq(classes.tenantId, tenantId),
            gte(classes.startTime, now),
            sql`${classes.startTime} <= ${endOfDay}`
        ))
        .orderBy(classes.startTime)
        .all();

    // Get current booking counts
    const classIds = todayClasses.map(c => c.id);
    const bookingCounts = classIds.length > 0
        ? await db.select({ classId: bookings.classId, count: sql<number>`count(*)` })
            .from(bookings)
            .where(and(inArray(bookings.classId, classIds), eq(bookings.status, 'confirmed')))
            .groupBy(bookings.classId)
            .all()
        : [];

    const countsMap: Record<string, number> = {};
    for (const bc of bookingCounts) {
        countsMap[bc.classId] = bc.count;
    }

    const result = todayClasses.map(c => ({
        ...c,
        spotsRemaining: (c.capacity || 30) - (countsMap[c.id] || 0)
    }));

    return c.json(result);
});

/**
 * POST /kiosk/walk-in — Walk-in booking + immediate check-in
 */
protectedApp.post('/walk-in', async (c) => {
    const tenantId = c.get('kioskTenantId');
    const db = createDb(c.env.DB);
    const { memberId, classId } = await c.req.json();

    if (!memberId || !classId) {
        return c.json({ error: 'Missing memberId or classId' }, 400);
    }

    // Verify member belongs to tenant
    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId))
    });
    if (!member) return c.json({ error: 'Member not found' }, 404);

    // Verify class belongs to tenant and has spots
    const cls = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId))).get();
    if (!cls) return c.json({ error: 'Class not found' }, 404);

    const currentCount = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
        .get();

    if ((currentCount?.count || 0) >= (cls.capacity || 30)) {
        return c.json({ error: 'Class is full' }, 409);
    }

    // Check no duplicate booking
    const existing = await db.query.bookings.findFirst({
        where: and(eq(bookings.memberId, memberId), eq(bookings.classId, classId))
    });
    if (existing) {
        // Already booked, just check in
        if (!existing.checkedInAt) {
            await db.update(bookings).set({ checkedInAt: new Date() }).where(eq(bookings.id, existing.id)).run();
        }
        return c.json({ success: true, bookingId: existing.id, timestamp: new Date().toISOString(), alreadyBooked: true });
    }

    // Create booking + check in
    const bookingId = crypto.randomUUID();
    await db.insert(bookings).values({
        id: bookingId,
        classId,
        memberId,
        status: 'confirmed',
        checkedInAt: new Date(),
        createdAt: new Date()
    }).run();

    // Deduct class pack credit if available
    let creditsRemaining: number | null = null;
    const activePack = await db.query.purchasedPacks.findFirst({
        where: and(
            eq(purchasedPacks.memberId, memberId),
            sql`${purchasedPacks.remainingCredits} > 0`
        )
    });
    if (activePack) {
        const newCredits = (activePack.remainingCredits || 1) - 1;
        await db.update(purchasedPacks).set({ remainingCredits: newCredits }).where(eq(purchasedPacks.id, activePack.id)).run();
        creditsRemaining = newCredits;
    }

    return c.json({
        success: true,
        bookingId,
        timestamp: new Date().toISOString(),
        creditsRemaining,
        className: cls.title
    });
});

app.route('/', protectedApp);

export default app;
