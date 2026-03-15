import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { z } from 'zod';
import { createDb } from '../db';
import * as schema from '@studio/db/src/schema'; // Import all schema
// Import specific tables for usage
import { tenants, classes, classSeries, tenantMembers, users, bookings, purchasedPacks } from '@studio/db/src/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const GuestBookingBodySchema = z.object({
    classId: z.string().min(1, 'classId is required'),
    tenantId: z.string().min(1, 'tenantId is required'),
    guestDetails: z.object({
        email: z.string().email('Valid email is required'),
        name: z.string().max(500).optional(),
    }),
    token: z.string().optional(),
});

const GuestChatStartBodySchema = z.object({
    tenantSlug: z.string().min(1, 'tenantSlug is required'),
    email: z.string().email('Valid email is required'),
    message: z.string().min(1, 'message is required'),
    name: z.string().max(500).optional(),
});

const GuestTokenBodySchema = z.object({
    email: z.string().email('Valid email is required'),
    name: z.string().max(500).optional(),
});

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
    const twoMonthsMs = 60 * 24 * 60 * 60 * 1000; // ~2 months in ms
    const endDate = end ? new Date(end) : new Date(startDate.getTime() + twoMonthsMs);

    const schedule = await db.query.classes.findMany({
        where: and(
            eq(classes.tenantId, tenant.id),
            eq(classes.status, 'active'),
            gte(classes.startTime, startDate),
            lte(classes.startTime, endDate)
        ),
        with: {
            instructor: { with: { user: true } },
            location: true,
            series: true
        },
        orderBy: [asc(classes.startTime)]
    });

    return c.json({
        tenant: { name: tenant.name, id: tenant.id, currency: tenant.currency },
        classes: schedule
    });
});

// GET /public/videos/:slug - Public Video Library
app.get('/videos/:slug', async (c) => {
    const db = createDb(c.env.DB);
    const slug = c.req.param('slug');

    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, slug)
    });

    if (!tenant) return c.json({ error: "Studio not found" }, 404);

    const videoLibrary = await db.query.classes.findMany({
        where: and(
            eq(classes.tenantId, tenant.id),
            eq(classes.isRecordingSellable, true),
            sql`${classes.cloudflareStreamId} IS NOT NULL`
        ),
        with: {
            instructor: {
                with: { user: true }
            }
        },
        orderBy: [desc(classes.startTime)]
    });

    return c.json({
        tenant: { name: tenant.name, id: tenant.id, currency: tenant.currency },
        videos: videoLibrary
    });
});

const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60; // 24 hours

// POST /booking - Guest Booking
app.post('/booking', rateLimitMiddleware({ limit: 5, window: 60, keyPrefix: 'guest_booking', failClosed: true }), async (c) => {
    const db = createDb(c.env.DB);
    const idemKey = c.req.header('Idempotency-Key')?.trim();

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body', code: 'VALIDATION_FAILED' }, 400);
    }
    const parsed = GuestBookingBodySchema.safeParse(body);
    if (!parsed.success) {
        return c.json({
            error: 'Validation failed',
            code: 'VALIDATION_FAILED',
            issues: parsed.error.issues,
        }, 400);
    }
    const { classId, tenantId, guestDetails } = parsed.data;

    // Idempotency: return stored response if key was already used within TTL
    if (idemKey) {
        try {
            const row = (await c.env.DB.prepare(
                'SELECT response, created_at FROM idempotency_keys WHERE key = ?'
            ).bind(idemKey).first()) as { response: string; created_at: number } | null;
            if (row && row.created_at && (Math.floor(Date.now() / 1000) - row.created_at) < IDEMPOTENCY_TTL_SEC) {
                return c.json(JSON.parse(row.response) as object, 200);
            }
        } catch {
            // Table may not exist yet; proceed without idempotency
        }
    }

    // 1. Check Class Availability
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

    const successResponse = { success: true, bookingId, message: "Class booked successfully!" };

    if (idemKey) {
        try {
            await c.env.DB.prepare(
                'INSERT OR REPLACE INTO idempotency_keys (key, response, created_at) VALUES (?, ?, ?)'
            ).bind(idemKey, JSON.stringify(successResponse), Math.floor(Date.now() / 1000)).run();
        } catch {
            // Table may not exist; ignore
        }
    }

    return c.json(successResponse);
});


// Existing Token Endpoint (kept for reference/usage)
app.post('/token', rateLimitMiddleware({ limit: 5, window: 60, keyPrefix: 'guest_token' }), async (c) => {
    let raw: unknown;
    try {
        raw = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body', code: 'VALIDATION_FAILED' }, 400);
    }
    const parsed = GuestTokenBodySchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', code: 'VALIDATION_FAILED', issues: parsed.error.issues }, 400);
    }
    const { name, email } = parsed.data;

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

// POST /public/chat/start - Start a guest support chat
app.post('/chat/start', rateLimitMiddleware({ limit: 3, window: 60, keyPrefix: 'guest_chat_start' }), async (c) => {
    const db = createDb(c.env.DB);
    let raw: unknown;
    try {
        raw = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body', code: 'VALIDATION_FAILED' }, 400);
    }
    const parsed = GuestChatStartBodySchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', code: 'VALIDATION_FAILED', issues: parsed.error.issues }, 400);
    }
    const body = parsed.data;

    // 1. Find tenant
    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, body.tenantSlug)
    });

    if (!tenant) return c.json({ error: 'Studio not found' }, 404);

    // 2. Find or create guest user
    let user = await db.query.users.findFirst({
        where: eq(users.email, body.email)
    });

    if (!user) {
        const userId = `guest_u_${crypto.randomUUID()}`;
        await db.insert(users).values({
            id: userId,
            email: body.email,
            profile: { firstName: body.name || 'Guest' },
            createdAt: new Date()
        }).run();
        user = await db.query.users.findFirst({
            where: eq(users.email, body.email)
        });
    }

    if (!user) return c.json({ error: 'Failed to create user' }, 500);

    // 3. Find or create tenant membership
    let member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member) {
        const memberId = `guest_m_${crypto.randomUUID()}`;
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId: tenant.id,
            userId: user.id,
            joinedAt: new Date(),
            status: 'active'
        }).run();
        member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenant.id))
        });
    }

    // 4. Create chat room
    const { chatRooms, chatMessages } = await import('@studio/db/src/schema');
    const roomId = crypto.randomUUID();
    await db.insert(chatRooms).values({
        id: roomId,
        tenantId: tenant.id,
        type: 'support',
        name: body.name || 'Guest',
        customerEmail: body.email,
        status: 'open',
        priority: 'normal',
        metadata: { source: 'widget', guestName: body.name }
    }).run();

    // 5. Insert initial message
    const messageId = crypto.randomUUID();
    await db.insert(chatMessages).values({
        id: messageId,
        roomId: roomId,
        userId: user.id,
        content: body.message
    }).run();

    // 6. Generate guest token for WebSocket
    const { sign } = await import('hono/jwt');
    const guestToken = await sign({
        sub: user.id,
        email: body.email,
        name: body.name || 'Guest',
        role: 'guest',
        tenantId: tenant.id,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    }, c.env.CLERK_SECRET_KEY);

    return c.json({
        success: true,
        roomId,
        guestToken,
        user: { id: user.id, email: body.email, name: body.name }
    });
});






export default app;
