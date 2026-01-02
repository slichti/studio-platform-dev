import { Hono } from 'hono';
import { classes, tenants, bookings, tenantMembers, users, tenantRoles, classSeries, subscriptions, purchasedPacks, userRelationships, waiverTemplates, waiverSignatures } from 'db/src/schema'; // Added subscriptions, purchasedPacks, userRelationships, waiver...
import { createDb } from '../db';
import { eq, and, gte, lte, gt, sql, inArray } from 'drizzle-orm';
import { ZoomService } from '../services/zoom';
import { EncryptionUtils } from '../utils/encryption';
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
    ENCRYPTION_SECRET: string;
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

    const instructorId = query.instructorId;

    let conditions = eq(classes.tenantId, tenant.id);
    const filters = [eq(classes.tenantId, tenant.id)];

    if (instructorId) {
        filters.push(eq(classes.instructorId, instructorId));
    }

    if (startDate && endDate) {
        filters.push(gte(classes.startTime, startDate));
        filters.push(lte(classes.startTime, endDate));
    }

    conditions = and(...filters) as any;

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
            },
            substitutions: {
                orderBy: (substitutions, { desc }) => [desc(substitutions.createdAt)],
                limit: 1
            }
        },
        orderBy: (classes, { asc }) => [asc(classes.startTime)]
    });

    // Check for user bookings if logged in
    const auth = c.get('auth');
    const userId = auth?.userId;
    let userBookings: Map<string, string> = new Map();

    if (userId) {
        // Find member ID first
        const member = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id))
        });

        if (member) {
            const classIds = results.map(r => r.id);
            if (classIds.length > 0) {
                const myBookings = await db.select({ classId: bookings.classId, status: bookings.status })
                    .from(bookings)
                    .where(
                        and(
                            eq(bookings.memberId, member.id),
                            // inArray(bookings.classId, classIds), 
                            // eq(bookings.status, 'confirmed') // Remove this to get active waitlists too
                        )
                    );
                myBookings.forEach(b => {
                    // Only care about active statuses
                    if (['confirmed', 'waitlisted'].includes(b.status || '')) {
                        userBookings.set(b.classId, b.status!);
                    }
                });
            }
        }
    }

    // Fetch aggregate booking counts
    // Fetch aggregate booking counts
    const counts = await db.select({
        classId: bookings.classId,
        confirmedCount: sql<number>`sum(case when ${bookings.status} = 'confirmed' then 1 else 0 end)`,
        waitlistCount: sql<number>`sum(case when ${bookings.status} = 'waitlisted' then 1 else 0 end)`
    })
        .from(bookings)
        .where(inArray(bookings.status, ['confirmed', 'waitlisted']))
        .groupBy(bookings.classId)
        .all();

    const countsMap = new Map(counts.map(c => [c.classId, { confirmed: c.confirmedCount, waitlisted: c.waitlistCount }]));

    const finalResults = results.map(cls => ({
        ...cls,
        ...cls,
        confirmedCount: countsMap.get(cls.id)?.confirmed || 0,
        waitlistCount: countsMap.get(cls.id)?.waitlisted || 0,
        userBookingStatus: userBookings.get(cls.id) || null // 'confirmed', 'waitlisted', etc.
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
        currency: z.string().optional(),
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
            currency: currency || tenant.currency || 'usd',
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

            if (createZoomMeeting) {
                // Ensure Zoom Service is initialized
                const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
                const zoomService = await ZoomService.getForTenant(tenant, c.env, encryption);

                if (zoomService && date.getTime() === dates[0].getTime()) {
                    try {
                        const meeting = await zoomService.createMeeting(`${title}`, date, durationMinutes);
                        zoomUrl = meeting.join_url;
                        // For recurring series, we might only create one meeting for the first one, 
                        // or shared meeting? Zoom recurring meetings approach is complex. 
                        // For simple MVP: Create separate meetings or use same link?
                        // If we use same link, we need RRule on Zoom side. 
                        // Let's simple check: if we want unique links, we loop.
                        // But here we are inside loop.
                    } catch (e) { console.error("Zoom Sync Error", e); }
                }
            }

            // NOTE: For recurring classes, ideally we should create a RECURRING meeting in Zoom.
            // But implementing full sync is complex.
            // Simplified: If createZoomMeeting is true, we create a meeting for EACH instance if we are iterating? 
            // Or simpler: Create one recurring meeting on Zoom and share URL. 
            // Let's create one meeting on Zoom for the first date, and reuse URL? No, that breaks time.

            // Re-evaluating Loop:
            // We should use Zoom's recurrence if possible. 
            // But DB schema splits them into individual classes.
            // Let's iterate and create unique meetings for each for now (safer but slower), 
            // OR create one Recurring Zoom Meeting ID and reuse.
            // Let's try One Recurring Zoom Meeting for the SERIES.

            // (Revisiting logic to keep it simple for now: We won't support auto-Zoom for recurring series in this MVP iteration to avoid API rate limits, or we do it efficiently).
            // Let's just create individual meetings for now but handle errors gracefully.

            let meetingData: any = null;
            if (createZoomMeeting) {
                const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
                const zoomService = await ZoomService.getForTenant(tenant, c.env, encryption);
                if (zoomService) {
                    try {
                        meetingData = await zoomService.createMeeting(title, date, durationMinutes);
                    } catch (e) { console.error("Zoom error", e); }
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
                zoomEnabled: createZoomMeeting || false,
                zoomMeetingUrl: meetingData?.join_url,
                zoomMeetingId: meetingData?.id?.toString(),
                zoomPassword: meetingData?.password,
                price: price || 0,
                currency: currency || tenant.currency || 'usd'
            });
            newClasses.push({ id: classId, startTime: date });
        }

        return c.json({ message: 'Series created', seriesId, count: newClasses.length }, 201);
    }

    // Single Class Flow
    const id = crypto.randomUUID();
    let zoomMeetingUrl: string | undefined = undefined;

    // Determine Zoom Credentials (Tenant > Env)
    // We assume 'zoomCredentials' is loaded with tenant. 
    // Note: 'tenant' object from middleware might imply simple select. 
    // We might need to ensure 'zoomCredentials' is fetched if it is a JSON field.
    // Drizzle select() without columns usually fetches all. 

    // Check if we should create a zoom meeting
    // Logic: Explicit flag OR Location name "Zoom" (if we had location lookup, but let's stick to flag for now)

    let meetingData: any = null;

    if (createZoomMeeting) {
        const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);
        const zoomService = await ZoomService.getForTenant(tenant, c.env, encryption);

        if (zoomService) {
            try {
                // userId is used as 'host'? No, Zoom Service uses Me or Account default. 
                meetingData = await zoomService.createMeeting(title, new Date(startTime), durationMinutes);
            } catch (e) {
                console.error("Zoom creation failed:", e);
            }
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
            zoomEnabled: createZoomMeeting || false,
            zoomMeetingUrl: meetingData?.join_url,
            zoomMeetingId: meetingData?.id?.toString(),
            zoomPassword: meetingData?.password,
            price: price || 0,
            currency: currency || tenant.currency || 'usd'
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

    // Check Capacity & Waitlist
    const requestBody = await c.req.json().catch(() => ({})); // Safe parse body in case it's empty
    const intent = requestBody.intent; // 'waitlist' or undefined
    const attendanceType = requestBody.attendanceType || 'in_person'; // 'in_person' | 'zoom'
    const targetMemberId = requestBody.memberId; // Optional: book for a family member

    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // Determine acting member ID
    let member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenant.id))
    });

    if (!member && !targetMemberId) {
        // Auto-join for self if not exists

        // LIMIT CHECK: Students
        const { UsageService } = await import('../services/pricing');
        const usageService = new UsageService(db, tenant.id);
        const canAddCallback = await usageService.checkLimit('students', tenant.tier || 'basic');

        if (!canAddCallback) {
            return c.json({
                error: "Studio student limit reached. Cannot join this studio.",
                code: "LIMIT_REACHED"
            }, 403);
        }

        const memberId = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: memberId, tenantId: tenant.id, userId: userId });
        await db.insert(tenantRoles).values({ memberId: memberId, role: 'student' });
        member = { id: memberId } as any;
    }

    let bookingMemberId = member?.id;

    // 0. Compliance Check: Waiver
    const activeWaiver = await db.select({ id: waiverTemplates.id })
        .from(waiverTemplates)
        .where(and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true)))
        .get();

    if (activeWaiver) {
        const checkMemberId = targetMemberId || member?.id;
        if (!checkMemberId) return c.json({ error: 'Acting member required for waiver check' }, 400);
        const signature = await db.query.waiverSignatures.findFirst({
            where: and(
                eq(waiverSignatures.memberId, checkMemberId),
                eq(waiverSignatures.templateId, activeWaiver.id)
            )
        });

        if (!signature) {
            return c.json({
                error: 'Liability waiver must be signed before booking.',
                code: 'WAIVER_REQUIRED',
                needsWaiver: true
            }, 403);
        }
    }

    // Handle Family Booking Logic
    if (targetMemberId) {
        // Verify targetMemberId exists in this tenant
        const targetMember = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.id, targetMemberId), eq(tenantMembers.tenantId, tenant.id))
        });

        if (!targetMember) return c.json({ error: 'Target member not found in this studio' }, 404);

        if (roles.includes('instructor') || roles.includes('owner')) {
            bookingMemberId = targetMemberId;
        } else {
            // Verify Relationship: Current User must be Parent of Target User
            const relationship = await db.query.userRelationships.findFirst({
                where: and(
                    eq(userRelationships.parentUserId, userId),
                    eq(userRelationships.childUserId, targetMember.userId)
                )
            });

            if (!relationship) {
                return c.json({ error: 'You do not have permission to book for this member' }, 403);
            }

            bookingMemberId = targetMemberId;
        }
    }

    if (!bookingMemberId) return c.json({ error: 'Could not determine member' }, 400);
    const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classInfo) return c.json({ error: 'Class not found' }, 404);

    if (classInfo.capacity) {
        // Count confirmed bookings
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(bookings)
            .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
            .get();

        const currentCount = result?.count || 0;

        if (currentCount >= classInfo.capacity) {
            if (intent !== 'waitlist') {
                return c.json({ error: 'Class is full', code: 'CLASS_FULL' }, 409);
            }
            // Create Waitlist Booking
            const id = crypto.randomUUID();
            await db.insert(bookings).values({
                id,
                classId,
                memberId: bookingMemberId!,
                status: 'waitlisted',
                // No payment method yet
            });

            return c.json({ id, status: 'waitlisted' }, 201);
        }
    }

    const id = crypto.randomUUID();

    try {
        // Fetch full member details for payment logic with the correct member ID
        let memberWithPlans = await db.query.tenantMembers.findFirst({
            where: eq(tenantMembers.id, bookingMemberId!),
            with: {
                memberships: {
                    where: eq(subscriptions.status, 'active')
                },
                purchasedPacks: {
                    where: and(
                        gt(purchasedPacks.remainingCredits, 0),
                    ),
                    orderBy: (purchasedPacks, { asc }) => [asc(purchasedPacks.expiresAt)]
                }
            }
        });

        if (!memberWithPlans) return c.json({ error: 'Member not found' }, 400);

        let paymentMethod: 'subscription' | 'credit' | 'drop_in' = 'drop_in';
        let usedPackId = undefined;

        if (memberWithPlans.memberships.length > 0) {
            paymentMethod = 'subscription';
        } else if (memberWithPlans.purchasedPacks.length > 0) {
            paymentMethod = 'credit';
            const packToUse = memberWithPlans.purchasedPacks[0];
            usedPackId = packToUse.id;

            // Deduct Credit
            await db.update(purchasedPacks)
                .set({ remainingCredits: sql`${purchasedPacks.remainingCredits} - 1` })
                .where(eq(purchasedPacks.id, usedPackId));
        }

        // Logic for paid classes if no membership/credits would go here
        // For now assuming drop-in is allowed or handled later

        await db.insert(bookings).values({
            id,
            classId,
            memberId: memberWithPlans.id,
            status: 'confirmed',
            attendanceType: attendanceType,
            paymentMethod,
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
        // 1. Get Active Waiver Template
        const { waiverTemplates, waiverSignatures } = await import('db/src/schema');
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

        const activeWaiver = await db.select({ id: waiverTemplates.id })
            .from(waiverTemplates)
            .where(and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true)))
            .get();

        const results = await db.select({
            id: bookings.id,
            status: bookings.status,
            user: {
                id: users.id,
                email: users.email,
                profile: users.profile
            },
            memberId: bookings.memberId,
            checkedInAt: bookings.checkedInAt,
            createdAt: bookings.createdAt
        })
            .from(bookings)
            .innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(bookings.classId, classId))
            .orderBy(bookings.createdAt)
            .all();

        // 2. If active waiver exists, check signatures for these members
        // 3. Check for Student Notes
        const { studentNotes } = await import('db/src/schema');

        const finalResults = await Promise.all(results.map(async (b: any) => {
            const waiverSigned = activeWaiver ? (await db.select({ id: waiverSignatures.id })
                .from(waiverSignatures)
                .where(and(
                    eq(waiverSignatures.memberId, b.memberId),
                    eq(waiverSignatures.templateId, activeWaiver.id)
                )).get()) : true;

            const existingNote = await db.select({ id: studentNotes.id })
                .from(studentNotes)
                .where(eq(studentNotes.studentId, b.memberId))
                .limit(1)
                .get();

            return {
                ...b,
                waiverSigned: !!waiverSigned,
                hasNotes: !!existingNote
            };
        }));

        return c.json(finalResults);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /classes/:id/bookings/:bookingId/promote
app.post('/:id/bookings/:bookingId/promote', async (c) => {
    const db = createDb(c.env.DB);
    const { id: classId, bookingId } = c.req.param();

    // RBAC: Instructor/Owner
    const roles = c.get('roles') || [];
    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    try {
        const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
        if (!booking) return c.json({ error: 'Booking not found' }, 404);
        if (booking.status !== 'waitlisted') return c.json({ error: 'Booking is not waitlisted' }, 400);

        // Promote
        // TODO: Handle Payment Capture here? For now assuming Drop-in/Pay Later
        await db.update(bookings)
            .set({
                status: 'confirmed',
                paymentMethod: 'drop_in' // Default to pay later/at door for promoted users if not charged
            })
            .where(eq(bookings.id, bookingId))
            .run();

        // Optional: Email Notification
        const tenant = c.get('tenant');
        if (c.env.RESEND_API_KEY && tenant) {
            const user = await db.select({ email: users.email })
                .from(tenantMembers)
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .where(eq(tenantMembers.id, booking.memberId))
                .get();

            if (user) {
                const { EmailService } = await import('../services/email');
                // Pass tenant config for branding
                const emailService = new EmailService(c.env.RESEND_API_KEY, {
                    branding: tenant.branding as any,
                    settings: tenant.settings as any
                });
                const classInfo = await db.select({ title: classes.title }).from(classes).where(eq(classes.id, classId)).get();

                c.executionCtx.waitUntil(emailService.sendGenericEmail(
                    user.email,
                    `You're off the waitlist!`,
                    `<p>Good news! You've been promoted to the active roster for <strong>${classInfo?.title || 'Class'}</strong>.</p><p>Please note that payment may be due upon arrival if you do not have an active membership.</p><p>See you there!</p>`
                ));
            }
        }

        return c.json({ success: true, status: 'confirmed' });
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
    const userId = c.get('auth').userId;
    const roles = c.get('roles') || [];

    // Check Permissions later based on booking ownership

    try {
        const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
        if (!booking) return c.json({ error: 'Booking not found' }, 404);
        if (booking.status === 'cancelled') return c.json({ error: 'Already cancelled' }, 400);

        // Permission Check
        if (!roles.includes('instructor') && !roles.includes('owner')) {
            const member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, booking.memberId)).get();
            if (!member || member.userId !== userId) {
                return c.json({ error: 'Access Denied' }, 403);
            }
        }

        const classInfo = await db.select().from(classes).where(eq(classes.id, classId)).get();
        const tenant = c.get('tenant');
        const settings = (tenant?.settings || {}) as any;

        // Late Cancel Logic
        if (!roles.includes('instructor') && !roles.includes('owner') && classInfo) {
            const cutoffMinutes = settings.classSettings?.cancellationCutoffMinutes || 60;
            const now = new Date();
            const startTime = new Date(classInfo.startTime);
            const diffMinutes = (startTime.getTime() - now.getTime()) / 60000;

            if (diffMinutes < cutoffMinutes) {
                // Late Cancel!
                // If fee enabled, maybe charge or mark as 'late_cancel'?
                // For now, let's just mark it legally as cancelled but maybe different status?
                // Or just warn?
                // Current requirement: "cutoff for people to cancel... unable to changes... students might be charged no-show fee"
                // Let's Block cancellation if strictly passed cutoff? Or allow with warning? 
                // User said "cutoff for people to cancel their attendance". This implies they CANNOT cancel after cutoff.
                // So we return error.

                return c.json({
                    error: `Cannot cancel less than ${cutoffMinutes} minutes before class.`,
                    code: 'LATE_CANCELLATION'
                }, 403);
            }
        }

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

        // Notification to Student
        if (booking.memberId && classInfo && tenant) {
            const memberData = await db.select({
                email: users.email,
                profile: users.profile,
                phone: users.phone
            })
                .from(tenantMembers)
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .where(eq(tenantMembers.id, booking.memberId))
                .get();

            if (memberData && c.env.RESEND_API_KEY) {
                const { EmailService } = await import('../services/email');
                const emailService = new EmailService(c.env.RESEND_API_KEY, {
                    branding: tenant.branding as any,
                    settings: tenant.settings as any
                });
                const notificationSettings = (tenant.settings as any)?.notificationSettings || {};
                const profile = memberData.profile as any;
                const firstName = profile?.firstName || 'there';

                // Email Notification (Default True)
                if (notificationSettings.cancellationEmail !== false) {
                    c.executionCtx.waitUntil(emailService.sendGenericEmail(
                        memberData.email,
                        `Booking Cancelled: ${classInfo.title}`,
                        `<p>Hi ${firstName},</p>
                          <p>Your booking for <strong>${classInfo.title}</strong> on ${new Date(classInfo.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })} has been cancelled.</p>
                          <p>If this was a mistake, please book again via the studio app.</p>`
                    ));
                }
            }
        }

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
                const memberUser = await db.select({
                    email: users.email,
                    stripeCustomerId: users.stripeCustomerId
                })
                    .from(tenantMembers)
                    .innerJoin(users, eq(tenantMembers.userId, users.id))
                    .where(eq(tenantMembers.id, booking.memberId))
                    .get();

                const classInfo = await db.select({ title: classes.title }).from(classes).where(eq(classes.id, classId)).get();

                // Trigger Notification
                if (c.env.RESEND_API_KEY && memberUser) {
                    const { EmailService } = await import('../services/email');
                    const emailService = new EmailService(c.env.RESEND_API_KEY);

                    c.executionCtx.waitUntil(emailService.notifyNoShow(
                        memberUser.email,
                        settings.noShowFeeAmount,
                        classInfo?.title || "Class"
                    ));
                }

                // Attempt Charge
                if (tenant && memberUser && memberUser?.stripeCustomerId && tenant.stripeAccountId) {
                    try {
                        const { StripeService } = await import('../services/stripe');
                        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);

                        await stripeService.chargeCustomer(tenant.stripeAccountId, {
                            customerId: memberUser.stripeCustomerId,
                            amount: settings.noShowFeeAmount,
                            currency: tenant.currency || 'usd',
                            description: `No-Show Fee: ${classInfo?.title || 'Class'}`,
                            metadata: {
                                tenantId: tenant.id,
                                memberId: booking.memberId,
                                classId: classId,
                                type: 'no_show_fee'
                            }
                        });
                        console.log(`[Charge Success] Charged ${settings.noShowFeeAmount} to member ${booking.memberId}`);
                    } catch (err: any) {
                        console.error(`[Charge Failed] Could not charge no-show fee:`, err.message);
                        // We do not fail the request, just log the error.
                    }
                } else {
                    console.log(`[Charge Skipped] No Stripe Customer ID or Connect Account`);
                }
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

    // LIMIT CHECK: Streaming Minutes
    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(db, tenant.id);
    const canUpload = await usageService.checkLimit('streamingUsage', tenant.tier || 'basic');
    if (!canUpload) {
        return c.json({
            error: "Streaming limit reached. Upgrade to add more videos.",
            code: "LIMIT_REACHED"
        }, 403);
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
