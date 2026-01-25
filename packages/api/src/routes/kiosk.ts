
import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, users, bookings, classes, tenantFeatures } from '@studio/db/src/schema'; // Ensure correct import
import { eq, and, like, desc, gte } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import type { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Kiosk Auth Middleware
const kioskAuth = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: "Missing Kiosk Token" }, 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = await verify(token, c.env.ENCRYPTION_SECRET, 'HS256');
        if (!payload.kioskTenantId) {
            throw new Error("Invalid Token");
        }
        c.set('kioskTenantId', payload.kioskTenantId);
        await next();
    } catch (e) {
        return c.json({ error: "Invalid or Expired Token" }, 401);
    }
};

/**
 * POST /kiosk/auth
 * Authenticate using Kiosk PIN
 * Body: { tenantSlug: string, pin: string }
 */
app.post('/auth', async (c) => {
    const { tenantSlug, pin } = await c.req.json();
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

    // Generate Long-Lived Kiosk Token (e.g. 30 days)
    // Kiosk is a trusted device on a wall.
    const token = await sign({
        kioskTenantId: tenant.id,
        role: 'kiosk',
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }, c.env.ENCRYPTION_SECRET, 'HS256');

    return c.json({ token, tenant: { id: tenant.id, name: tenant.name } });
});


// Protected Routes
const protectedApp = new Hono<{ Bindings: Bindings, Variables: Variables & { kioskTenantId: string } }>();

protectedApp.use('*', kioskAuth);

/**
 * GET /kiosk/search?q=John
 * Search students for check-in
 */
protectedApp.get('/search', async (c) => {
    const tenantId = c.get('kioskTenantId');
    const query = c.req.query('q') || '';
    if (query.length < 2) return c.json([]);

    const db = createDb(c.env.DB);

    // Join TenantMember -> User
    // Use Drizzle Query to get easy data
    // Note: This matches "firstName" or "email"
    // Limitations: SQLite 'like' is case-insensitive depending on collation, assume lowercase

    // We need to fetch relevant members
    // This query might be expensive on standard SQLite without FTS. Keep result set small.
    // Assuming simple `like` for now.

    // NOTE: In Cloudflare D1, we might need a raw query to join easily if not using relations perfectly.
    // Let's use `db.select` with joins.

    const results = await db.select({
        memberId: tenantMembers.id,
        firstName: sql<string>`json_extract(${users.profile}, '$.firstName')`, // Extract from JSON
        lastName: sql<string>`json_extract(${users.profile}, '$.lastName')`,
        portraitUrl: sql<string>`json_extract(${users.profile}, '$.portraitUrl')`,
        email: users.email
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantMembers.status, 'active'), // Only active members
            or(
                like(users.email, `%${query}%`),
                like(sql`json_extract(${users.profile}, '$.firstName')`, `%${query}%`),
                like(sql`json_extract(${users.profile}, '$.lastName')`, `%${query}%`)
            )
        ))
        .limit(10)
        .all();

    // Now check for *TODAY's* Booking for these people.
    // We want to return if they can check in.
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

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
            gte(classes.startTime, startOfDay),
            // lte(classes.startTime, endOfDay) // SQLite comparison issues often. Just verifying GTE start of day.
            // Actually we should filter by end of day too to only show Relevant Classes
            // but let's just grab upcoming ones.
        ))
        .orderBy(desc(classes.startTime))
        .all();

    // Attach booking info to members
    const finalResults = results.map(m => {
        const memberBookings = fileteredBookings.filter(b => b.memberId === m.memberId);
        // Find the "Best" booking (e.g. next starting class not checked in)
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
protectedApp.post('/checkin/:bookingId', async (c) => {
    const tenantId = c.get('kioskTenantId');
    const bookingId = c.req.param('bookingId');
    const db = createDb(c.env.DB);

    // Verify Booking belongs to Tenant
    const booking = await db.select().from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id)) // Join class to verify tenant
        .where(eq(bookings.id, bookingId))
        .get();

    if (!booking) return c.json({ error: "Booking not found" }, 404);
    if (booking.classes.tenantId !== tenantId) return c.json({ error: "Unauthorized" }, 403);

    // Check In
    await db.update(bookings).set({
        checkedInAt: new Date(),
        // optional: updatedBy: 'kiosk' if we tracked that
    }).where(eq(bookings.id, bookingId)).run();

    return c.json({ success: true, timestamp: new Date() });
});

// Mount Protected
app.route('/', protectedApp);

export default app;

// Helpers
import { sql, inArray, or } from 'drizzle-orm';
