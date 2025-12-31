import { Hono } from 'hono';
import { classes, tenants, bookings, tenantMembers, users, tenantRoles, classSeries, subscriptions, purchasedPacks } from 'db/src/schema'; // Added subscriptions, purchasedPacks
import { createDb } from '../db';
import { eq, and, gte, lte, gt } from 'drizzle-orm'; // Added gt
import { ZoomService } from '../services/zoom';
import { StreamService } from '../services/stream';

type Bindings = {
    DB: D1Database;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
    STRIPE_SECRET_KEY: string;
    RESEND_API_KEY: string;
    CLOUDFLARE_STREAM_ACCOUNT_ID: string;
    CLOUDFLARE_STREAM_API_TOKEN: string;
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

    const query = c.req.query();
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    let conditions = eq(classes.tenantId, tenant.id);

    if (startDate && endDate) {
        conditions = and(
            eq(classes.tenantId, tenant.id),
            gte(classes.startTime, startDate),
            lte(classes.startTime, endDate)
        ) as any;
    }

    const results = await db.query.classes.findMany({
        where: conditions,
        with: {
            location: true,
            instructor: {
                with: {
                    user: {
                        columns: {
                            id: true,
                            email: true,
                            profile: true
                        }
                    }
                }
            }
        },
        orderBy: (classes, { asc }) => [asc(classes.startTime)]
    });

    // Check for user bookings if logged in
    const userId = c.get('auth').userId;
    let userBookings: Set<string> = new Set();

    if (userId) {
        // Find member ID first
        const member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id))
        });

        if (member) {
            const classIds = results.map(r => r.id);
            if (classIds.length > 0) {
                const myBookings = await db.select({ classId: bookings.classId })
                    .from(bookings)
                    .where(
                        and(
                            eq(bookings.memberId, member.id),
                            // inArray(bookings.classId, classIds), // Not necessary if strict on tenant, but helpful. Drizzle 'inArray' needs import.
                            // Simply fetching all active bookings for this user for simplicity in this MVP
                            eq(bookings.status, 'confirmed')
                        )
                    );
                myBookings.forEach(b => userBookings.add(b.classId));
            }
        }
    }

    const finalResults = results.map(cls => ({
        ...cls,
        userBooked: userBookings.has(cls.id)
    }));

    return c.json(finalResults);
});

app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Member context required' }, 403);
    const userId = c.get('auth').userId;

    // RBAC: Only Instructors or Owners can create classes
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
        currency: z.string().default('usd'),
        recurrenceRule: z.string().optional(), // RRule string
        recurrenceEnd: z.string().or(z.date()).pipe(z.coerce.date()).optional(),
        isRecurring: z.boolean().optional()
    });

    const parseResult = createClassSchema.safeParse(body);
    if (!parseResult.success) {
        return c.json({ error: 'Invalid input', details: parseResult.error.format() }, 400);
    }

    const { title, description, startTime, durationMinutes, capacity, locationId, createZoomMeeting, price, currency, recurrenceRule, recurrenceEnd, isRecurring } = parseResult.data;

    // Logic:
    // If isRecurring && recurrenceRule:
    // 1. Create ClassSeries
    // 2. Generate instances via RRule
    // 3. Create Classes linked to Series

    if (isRecurring && recurrenceRule) {
        const { RRule } = await import('rrule');
        const seriesId = crypto.randomUUID();

        // 1. Create Series
        await db.insert(classSeries).values({
            id: seriesId,
            tenantId: tenant.id,
            instructorId: member.id,
            locationId,
            title,
            description,
            durationMinutes,
            price: price,
            currency: currency,
            recurrenceRule,
            validFrom: new Date(startTime),
            validUntil: recurrenceEnd ? new Date(recurrenceEnd) : undefined
        });

        // 2. Generate Instances
        // Parse RRule. Ensure dtstart is set correctly.
        // We need to construct the rule object.
        let ruleOptions;
        try {
            ruleOptions = RRule.parseString(recurrenceRule);
            ruleOptions.dtstart = new Date(startTime);
        } catch (e) {
            return c.json({ error: 'Invalid recurrence rule' }, 400);
        }

        const rule = new RRule(ruleOptions);

        // Limit generation: Either until recurrenceEnd OR 3 months max to prevent infinite
        const limitDate = recurrenceEnd ? new Date(recurrenceEnd) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days default
        const dates = rule.between(new Date(startTime), limitDate, true); // true = include start if matches

        const newClasses = [];

        for (const date of dates) {
            const classId = crypto.randomUUID();
            let zoomUrl = undefined;

            if (createZoomMeeting && c.env.ZOOM_ACCOUNT_ID) {
                // Warning: Creating 50 zoom meetings sequentially will be slow and might rate limit.
                // Ideally this is a background job. For now, let's only create Zoom for the FIRST occurrence 
                // and warn user, OR skip zoom for recurring in this MVP Sync flow?
                // Or just create for first one. 
                // Let's create for the first one only for speed/safety in MVP.
                if (date.getTime() === dates[0].getTime()) {
                    try {
                        const zoom = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET);
                        zoomUrl = await zoom.createMeeting(userId, title, date, durationMinutes);
                    } catch (e) { console.error("Zoom failed", e); }
                }
            }

            // Insert Class
            await db.insert(classes).values({
                id: classId,
                tenantId: tenant.id,
                instructorId: member.id,
                seriesId,
                title,
                description,
                startTime: date,
                durationMinutes,
                capacity,
                locationId,
                zoomMeetingUrl: zoomUrl,
                price: price || 0,
                currency: currency || 'usd'
            });
            newClasses.push({ id: classId, startTime: date });
        }

        return c.json({ message: 'Series created', seriesId, count: newClasses.length }, 201);
    }

    // Single Class Flow
    const id = crypto.randomUUID();
    let zoomMeetingUrl: string | undefined = undefined;

    if (createZoomMeeting && c.env.ZOOM_ACCOUNT_ID) {
        try {
            const zoom = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET);
            zoomMeetingUrl = await zoom.createMeeting(userId, title, new Date(startTime), durationMinutes);
        } catch (e) {
            console.error("Zoom creation failed:", e);
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
            where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id)),
            with: {
                memberships: {
                    where: eq(subscriptions.status, 'active')
                },
                purchasedPacks: {
                    where: and(
                        gt(purchasedPacks.remainingCredits, 0),
                        // or(isNull(purchasedPacks.expiresAt), gt(purchasedPacks.expiresAt, new Date())) // Simple check
                    ),
                    orderBy: (purchasedPacks, { asc }) => [asc(purchasedPacks.expiresAt)]
                }
            }
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
            member = { id: memberId, memberships: [], purchasedPacks: [] } as any;
        }

        // Check Payment Requirement
        let paymentMethod = 'free';
        let usedPackId = undefined;

        if (classInfo.price && classInfo.price > 0) {
            const hasActiveMembership = member!.memberships && member!.memberships.length > 0;

            if (hasActiveMembership) {
                paymentMethod = 'subscription';
            } else {
                // Try to use credits
                // Filter out expired packs explicitly in JS if Drizzle 'gt' on date is tricky or needed safety
                const validPacks = (member!.purchasedPacks || []).filter(p => !p.expiresAt || new Date(p.expiresAt) > new Date());

                if (validPacks.length > 0) {
                    const packToUse = validPacks[0]; // First one (sorted by expiry asc)

                    // Deduct Credit
                    await db.update(purchasedPacks)
                        .set({ remainingCredits: packToUse.remainingCredits - 1 })
                        .where(eq(purchasedPacks.id, packToUse.id))
                        .run();

                    paymentMethod = 'credit';
                    usedPackId = packToUse.id;
                } else {
                    return c.json({ error: 'Payment required: No active membership or class credits' }, 402);
                }
            }
        }

        await db.insert(bookings).values({
            id,
            classId,
            memberId: member!.id,
            status: 'confirmed',
            paymentMethod: paymentMethod as any,
            usedPackId
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

app.patch('/:id/bookings/:bookingId/check-in', async (c) => {
    const db = createDb(c.env.DB);
    const { id: classId, bookingId } = c.req.param();

    // RBAC
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        const body = await c.req.json();
        const checkedIn = body.checkedIn; // true or false

        await db.update(bookings)
            .set({ checkedInAt: checkedIn ? new Date() : null })
            .where(eq(bookings.id, bookingId))
            .run();

        return c.json({ success: true, checkedIn });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/:id/bookings/:bookingId/cancel', async (c) => {
    const db = createDb(c.env.DB);
    const { id: classId, bookingId } = c.req.param();

    // RBAC - Owner/Instructor can cancel any; Student can cancel their own? 
    // For this route let's assume Instructor context management.
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        // Find booking to restore credits
        const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();

        if (!booking) return c.json({ error: 'Booking not found' }, 404);
        if (booking.status === 'cancelled') return c.json({ error: 'Already cancelled' }, 400);

        // Restore credit logic
        if (booking.paymentMethod === 'credit' && booking.usedPackId) {
            const pack = await db.select().from(purchasedPacks).where(eq(purchasedPacks.id, booking.usedPackId)).get();
            if (pack) {
                await db.update(purchasedPacks)
                    .set({ remainingCredits: pack.remainingCredits + 1 })
                    .where(eq(purchasedPacks.id, booking.usedPackId))
                    .run();
            }
        }

        await db.update(bookings)
            .set({ status: 'cancelled' })
            .where(eq(bookings.id, bookingId))
            .run();

        return c.json({ success: true, status: 'cancelled' });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PATCH /classes/:id/bookings/:bookingId/status
app.patch('/:id/bookings/:bookingId/status', async (c) => {
    const db = createDb(c.env.DB);
    const { id: classId, bookingId } = c.req.param();

    // RBAC: Instructor/Owner only
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const body = await c.req.json();
    const { status } = body; // 'confirmed', 'cancelled', 'no_show', 'checked_in'

    if (!['confirmed', 'cancelled', 'no_show', 'checked_in'].includes(status)) {
        return c.json({ error: "Invalid status" }, 400);
    }

    try {
        const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
        if (!booking) return c.json({ error: "Booking not found" }, 404);

        // Update Status
        await db.update(bookings).set({ status }).where(eq(bookings.id, bookingId)).run();

        if (status === 'no_show') {
            const tenant = c.get('tenant');
            const settings = (tenant?.settings || {}) as any;

            if (settings.noShowFeeEnabled && settings.noShowFeeAmount > 0) {
                // Get Member Email
                const memberUser = await db.select({ email: users.email })
                    .from(tenantMembers)
                    .innerJoin(users, eq(tenantMembers.userId, users.id))
                    .where(eq(tenantMembers.id, booking.memberId))
                    .get();

                // Trigger Notification
                if (c.env.RESEND_API_KEY && memberUser) {
                    const { EmailService } = await import('../services/email');
                    const emailService = new EmailService(c.env.RESEND_API_KEY);
                    const classInfo = await db.select({ title: classes.title }).from(classes).where(eq(classes.id, classId)).get();

                    c.executionCtx.waitUntil(emailService.notifyNoShow(
                        memberUser.email,
                        settings.noShowFeeAmount,
                        classInfo?.title || "Class"
                    ));
                }

                // Attempt Charge (Placeholder / TODO: Stripe Integration)
                // We need customer ID. Assuming we don't have it yet, we just log.
                console.log(`[Mock Charge] Charging ${settings.noShowFeeAmount} to member ${booking.memberId} for No-Show`);
            }
        }

        return c.json({ success: true, status });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /classes/:id/recording
// Attach a video from a URL (e.g. Zoom Cloud Recording)
app.post('/:id/recording', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // RBAC: Instructor or Owner
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const { url, name } = await c.req.json();
    if (!url) return c.json({ error: 'URL required' }, 400);

    // Init Stream Service
    if (!c.env.CLOUDFLARE_STREAM_ACCOUNT_ID || !c.env.CLOUDFLARE_STREAM_API_TOKEN) {
        return c.json({ error: 'Video service not configured' }, 500);
    }
    const stream = new StreamService(c.env.CLOUDFLARE_STREAM_ACCOUNT_ID, c.env.CLOUDFLARE_STREAM_API_TOKEN);

    try {
        // Upload via Link
        const videoId = await stream.uploadViaLink(url, { name: name || `Class ${classId}` });

        // Update Class Record
        await db.update(classes)
            .set({
                cloudflareStreamId: videoId,
                recordingStatus: 'processing'
            })
            .where(eq(classes.id, classId))
            .run();

        return c.json({ success: true, videoId, status: 'processing' });
    } catch (e: any) {
        console.error("Stream Upload Info Error:", e);
        // Important: Don't start an upload if we can't save it, but here it's async copy.
        return c.json({ error: e.message || 'Failed to start video upload' }, 500);
    }
});

// GET /classes/:id/recording
// Get video details for playback
app.get('/:id/recording', async (c) => {
    const db = createDb(c.env.DB);
    const classId = c.req.param('id');
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const auth = c.get('auth');

    // Access Control:
    // 1. Owner/Instructor: Always allow
    // 2. Student: Must have a "confirmed" booking AND (if configured) be paid/valid.
    // For now, simple booking check.

    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo || !classInfo.cloudflareStreamId) {
        return c.json({ error: 'No recording available' }, 404);
    }

    const roles = c.get('roles') || [];
    let canWatch = false;

    if (roles.includes('owner') || roles.includes('instructor')) {
        canWatch = true;
    } else if (auth && auth.userId) {
        // Check booking
        const member = c.get('member'); // Set by middleware
        if (member) {
            const booking = await db.select().from(bookings).where(and(
                eq(bookings.classId, classId),
                eq(bookings.memberId, member.id),
                eq(bookings.status, 'confirmed')
            )).get();
            if (booking) canWatch = true;
        }
    }

    if (!canWatch) return c.json({ error: 'Access Denied: You must book this class to watch the recording.' }, 403);

    // Fetch Token (Mock or Real)
    // For MVP, we pass the videoId directly.
    return c.json({
        videoId: classInfo.cloudflareStreamId,
        status: classInfo.recordingStatus // could be 'processing'
    });
});
