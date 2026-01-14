import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { createDb } from '../db';
import * as schema from 'db/src/schema'; // Import all schema
// Import specific tables for usage
import { tenants, classes, classSeries, tenantMembers, users, bookings, purchasedPacks } from 'db/src/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

const app = new Hono<{ Bindings: any }>();

// GET /public/schedule/:slug - Public Schedule
app.get('/schedule/:slug', async (c) => {
    const db = createDb(c.env.DB);
    const slug = c.req.param('slug');
    const start = c.req.query('start'); // ISO Date
    const end = c.req.query('end');     // ISO Date

    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, slug)
    });

    if (!tenant) return c.json({ error: "Studio not found" }, 404);

    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

    const schedule = await db.query.classes.findMany({
        where: and(
            eq(classes.tenantId, tenant.id),
            // eq(classes.status, 'published'), // Assuming status field exists, if not ignore
            gte(classes.startTime, startDate),
            lte(classes.startTime, endDate)
        ),
        with: {
            instructor: {
                with: { user: true }
            },
            series: true
        },
        orderBy: [asc(classes.startTime)]
    });

    return c.json({
        tenant: { name: tenant.name, id: tenant.id, currency: tenant.currency },
        classes: schedule
    });
});

// POST /booking - Guest Booking
app.post('/booking', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const { token, classId, tenantId, guestDetails } = body;

    // 1. Verify Guest Token (optional if purely open, but good for rate limiting/tracking)
    // For now, let's assume open booking or token passed in header normally.
    // If token passed in body, we can verify it manually or rely on authMiddleware if this route was protected.
    // Since this is public/guest, we might take guestDetails directly.

    if (!classId || !tenantId || !guestDetails?.email) {
        return c.json({ error: "Missing required booking details" }, 400);
    }

    // 2. Check Class Availability
    const cls = await db.query.classes.findFirst({
        where: and(eq(classes.id, classId), eq(classes.tenantId, tenantId))
    });

    if (!cls) return c.json({ error: "Class not found" }, 404);

    // Count existing bookings
    const result = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
        .get();

    const currentCount = result?.count || 0;
    if (cls.capacity && currentCount >= cls.capacity) {
        return c.json({ error: "Class is full" }, 400);
    }

    // 3. Find or Create Guest Member (Shadow Member?)
    // Complex: We want to associate this guest with a real User eventually.
    // For MVP Web Widget: We create a Booking with `isGuest: true` and `guestEmail`.

    // Check if user already exists (by email) -> If so, they should login?
    // For true guest checkout, we just book it.

    const bookingId = crypto.randomUUID();

    // We need a memberId for the schema constraint? 
    // Schema says memberId references tenantMembers.id.
    // So we MUST create a tenantMember record even for guests?
    // Or we relax schema?
    // Let's create a "Guest" member linked to a "Guest" user if not exists.

    // Allow null memberId for guest bookings?
    // Schema: memberId is NOT NULL?
    // Let's check schema. bookings.memberId references tenantMembers.id

    // workaround: create a temporary member record for the guest?
    // Better: Creating a real User/Member record for every guest ensures they can claim account later.

    // A. Check for existing User by email
    let user = await db.query.users.findFirst({
        where: eq(users.email, guestDetails.email)
    });

    if (!user) {
        // Create new user (properly typed for insert)
        try {
            await db.insert(users).values({
                id: `guest_u_${crypto.randomUUID()}`,
                email: guestDetails.email,
                createdAt: new Date(),
            }).run();
        } catch (e) {
            // Ignore if already exists (race condition)
        }

        // Fetch it back to be sure we have the full record
        user = await db.query.users.findFirst({
            where: eq(users.email, guestDetails.email)
        });
    }

    if (!user) return c.json({ error: "Failed to create user" }, 500);

    // B. Check for Member record
    let member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenantId))
    });

    if (!member) {
        try {
            await db.insert(tenantMembers).values({
                id: `guest_m_${crypto.randomUUID()}`,
                tenantId,
                userId: user.id,
                joinedAt: new Date(),
                status: 'active'
            }).run();
        } catch (e) {
            // Ignore if already exists
        }

        member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenantId))
        });
    }

    if (!member) return c.json({ error: "Failed to create member" }, 500);

    // 4. Create Booking
    await db.insert(bookings).values({
        id: bookingId,
        classId,
        memberId: member.id,
        status: 'confirmed',
        attendanceType: 'in_person',
        isGuest: true,
        guestName: guestDetails.name || 'Guest',
        guestEmail: guestDetails.email,
        createdAt: new Date()
    }).run();

    // 5. Send Confirmation Email (via EmailService)
    // usage: new EmailService(...).sendBookingConfirmation(...)

    return c.json({ success: true, bookingId, message: "Class booked successfully!" });
});


// Existing Token Endpoint (kept for reference/usage)
app.post('/token', async (c) => {
    const { name, email } = await c.req.json<{ name: string; email: string }>();

    if (!email) return c.json({ error: "Email required" }, 400);

    const guestId = `guest_${crypto.randomUUID()}`;

    // Sign with CLERK_SECRET_KEY (Symmetric)
    const token = await sign({
        sub: guestId,
        email,
        name: name || 'Guest',
        role: 'guest',
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
    }, c.env.CLERK_SECRET_KEY);

    return c.json({ token, user: { id: guestId, email, name, role: 'guest' } });
});

export default app;
