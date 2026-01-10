import { createDb } from './db';
import { tenants, classes, bookings, tenantMembers, marketingAutomations, users, emailLogs, purchasedPacks, tenantRoles, subscriptions, membershipPlans } from 'db/src/schema'; // Ensure imports
import { and, eq, lte, gt, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { BookingService } from './services/bookings';

import { AutomationsService } from './services/automations';
import { EmailService } from './services/email';
import { NotificationService } from './services/notifications';

export const scheduled = async (event: any, env: any, ctx: any) => {
    console.log("Cron trigger fired:", event.cron);

    const db = createDb(env.DB);
    const bookingService = new BookingService(db, env);

    // 1. Find Tenants with Auto-No-Show Enabled
    // Unfortunately, settings is JSON so we can't easily SQL filter deeply in SQLite D1 efficiently without retrieving.
    // Better strategy: Fetch all tenants, filter in memory (if small scale) OR 
    // If we had a column `settings_noShowEnabled`, it would reflect better.
    // For MVP scale, fetching all tenants is fine (assuming < 1000).
    // Or we process ALL classes that ended recently and check tenant settings JIT.
    // Let's do the latter: Find classes that ended recently, then check their tenant settings.

    const now = new Date();
    // Look back window: Classes that ended between 30 mins ago and now? 
    // Or started X mins ago?
    // Let's implement robustly:
    // We want to process any class that "just became eligible" for no-show marking.
    // Eligibility depends on tenant setting `noShowAutoMarkTime` (e.g. 'class_end', '15_mins_start').

    // Simplification for MVP: Assume default is "End of Class" + buffer.
    // We will query classes that ended between 20 mins ago and 5 mins ago (to catch them once).
    // Or simple: ended < now && ended > now - 15min.

    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000);
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000);

    const recentEndedClasses = await db.select({
        id: classes.id,
        tenantId: classes.tenantId,
        startTime: classes.startTime,
        durationMinutes: classes.durationMinutes
    })
        .from(classes)
        .where(and(
            // SQL handling of timestamps might vary. Drizzle stores as Date or Int.
            // Assuming stored as Date/Int compatible.
            // Logic: EndTime = StartTime + Duration.
            // We can't easily do math in WHERE clause portably with Drizzle/SQLite cleanly without raw SQL.
            // Let's fetch active classes from last 24h and filter in code? Too much data.
            // Use Raw SQL for efficiency:
            // endTime = startTime + durationMinutes * 60 * 1000
        ));

    // Actually, let's just fetch classes started in the last 2 hours.
    // Then filter checks in JS.
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const activeClasses = await db.query.classes.findMany({
        where: gte(classes.startTime, twoHoursAgo),
        with: {
            tenant: true
        }
    });

    for (const cls of activeClasses) {
        const tenantSettings = (cls.tenant.settings || {}) as any;
        if (!tenantSettings.noShowFeeEnabled || !tenantSettings.noShowAutoMarkEnabled) continue;

        // Determine if it's time to mark
        const startTime = new Date(cls.startTime);
        const endTime = new Date(startTime.getTime() + cls.durationMinutes * 60000);
        const policy = tenantSettings.noShowAutoMarkTime || 'end_of_class'; // 'start_of_class', '15_mins_after_start', 'end_of_class'

        let thresholdTime;
        if (policy === 'start_of_class') thresholdTime = startTime;
        else if (policy === '15_mins_after_start') thresholdTime = new Date(startTime.getTime() + 15 * 60000);
        else thresholdTime = endTime;

        // If current time is PAST the threshold, and we haven't processed it yet...
        // How do we know if we processed it? 
        // We can check bookings status. If they are 'confirmed' and time > threshold + buffer?
        // Let's process if now > threshold.

        if (now > thresholdTime) {
            // Find bookings that are STILL 'confirmed' (not checked_in, not cancelled)
            const openBookings = await db.select().from(bookings).where(and(
                eq(bookings.classId, cls.id),
                eq(bookings.status, 'confirmed')
            ));

            for (const booking of openBookings) {
                // Mark as No Show
                console.log(`Auto-marking No-Show: Booking ${booking.id} for Class ${cls.id}`);
                try {
                    await bookingService.markNoShow(booking.id);
                } catch (e) {
                    console.error(`Failed to auto-mark booking ${booking.id}`, e);
                }
            }
        }
    }

    // 2. Automated Class Cancellations for Low Enrollment
    // Find classes starting soon that have auto-cancel enabled and haven't matched min students
    const upcomingClasses = await db.query.classes.findMany({
        where: and(
            eq(classes.status, 'active'),
            eq(classes.autoCancelEnabled, true),
            gte(classes.startTime, now)
        ),
        with: {
            tenant: true,
            bookings: {
                where: eq(bookings.status, 'confirmed')
            },
            instructor: {
                with: {
                    user: true
                }
            }
        }
    });

    for (const cls of upcomingClasses) {
        const thresholdHours = cls.autoCancelThreshold || 2; // Default 2 hours if not set
        const thresholdTime = new Date(cls.startTime.getTime() - thresholdHours * 60 * 60 * 1000);

        // If now is past the threshold time
        if (now >= thresholdTime) {
            const currentEnrollment = cls.bookings.length;
            const minEnrollment = cls.minStudents || 1;

            if (currentEnrollment < minEnrollment) {
                console.log(`[Auto-Cancel] Class "${cls.title}" (ID: ${cls.id}) cancelled due to low enrollment (${currentEnrollment}/${minEnrollment}).`);

                // 1. Mark class as cancelled
                await db.update(classes)
                    .set({ status: 'cancelled' })
                    .where(eq(classes.id, cls.id))
                    .run();

                // 2. Notify students
                const notifService = new NotificationService(db, cls.tenantId, env);

                for (const booking of cls.bookings) {
                    // We need student email. We have memberId in booking.
                    // But 'cls.bookings' with 'with' only gives booking records.
                    // Let's fetch members with users.
                    const member = await db.query.tenantMembers.findFirst({
                        where: eq(tenantMembers.id, booking.memberId),
                        with: { user: true }
                    });

                    if (member?.user?.email) {
                        await notifService.sendEmail(
                            member.user.email,
                            `Class Cancelled: ${cls.title}`,
                            `<p>Sorry! The class <strong>${cls.title}</strong> on ${cls.startTime.toLocaleString()} has been cancelled due to low enrollment. Any credits used have been returned to your account.</p>`
                        );

                        // SMS Notification
                        await notifService.sendSMS(
                            member.user.phone || '',
                            `Class Cancelled: ${cls.title} on ${cls.startTime.toLocaleString()} due to low enrollment.`,
                            { memberId: booking.memberId, eventType: 'class_cancellation' }
                        );

                        // Return credits if applicable
                        if (booking.paymentMethod === 'credit' && booking.usedPackId) {
                            await db.update(purchasedPacks)
                                .set({ remainingCredits: sql`${purchasedPacks.remainingCredits} + 1` })
                                .where(eq(purchasedPacks.id, booking.usedPackId))
                                .run();
                        }
                    }

                    // Update booking status
                    await db.update(bookings)
                        .set({ status: 'cancelled' })
                        .where(eq(bookings.id, booking.id))
                        .run();
                }

                // 3. Notify Instructor
                if (cls.instructor?.user?.email) {
                    const profile = (cls.instructor.user.profile || {}) as any;
                    await notifService.sendEmail(
                        cls.instructor.user.email,
                        `Class Cancelled: ${cls.title}`,
                        `<p>Hi ${profile.firstName || 'Instructor'}, your class <strong>${cls.title}</strong> on ${cls.startTime.toLocaleString()} has been automatically cancelled as it did not reach the minimum of ${minEnrollment} students by the cutoff time.</p>`
                    );

                    // SMS Notification (Instructor)
                    await notifService.sendSMS(
                        cls.instructor.user.phone || '',
                        `Class Cancelled: ${cls.title} on ${cls.startTime.toLocaleString()} (Low Enrollment).`,
                        { memberId: cls.instructorId, eventType: 'class_cancellation_instructor' }
                    );
                }

                // 4. Notify Owner(s)
                // Find owners for this tenant
                const owners = await db.select()
                    .from(tenantMembers)
                    .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
                    .innerJoin(users, eq(tenantMembers.userId, users.id))
                    .where(and(
                        eq(tenantMembers.tenantId, cls.tenantId),
                        eq(tenantRoles.role, 'owner')
                    )).all();

                for (const owner of owners) {
                    if (owner.users.email) {
                        await notifService.sendEmail(
                            owner.users.email,
                            `ALERT: Class Auto-Cancelled - ${cls.title}`,
                            `<p>The class <strong>${cls.title}</strong> scheduled for ${cls.startTime.toLocaleString()} was automatically cancelled due to low enrollment.</p>
                             <ul>
                                <li>Current Signups: ${currentEnrollment}</li>
                                <li>Min Required: ${minEnrollment}</li>
                             </ul>
                             <p>Students and the Instructor have been notified.</p>`
                        );

                        // SMS Notification (Owner)
                        await notifService.sendSMS(
                            owner.users.phone || '',
                            `ALERT: Auto-Cancelled ${cls.title} (${currentEnrollment}/${minEnrollment} students).`,
                            { memberId: owner.tenant_members.id, eventType: 'class_cancellation_alert' }
                        );
                    }
                }
            }
        }
    }


    // 3. Marketing Automations: Birthdays
    // Find all enabled birthday automations
    const birthdayAutos = await db.select().from(marketingAutomations)
        .where(and(
            eq(marketingAutomations.triggerEvent, 'birthday'),
            eq(marketingAutomations.isEnabled, true)
        ));

    if (birthdayAutos.length > 0) {
        // We need to match users with today's birthday.
        // SQLite: strftime('%m-%d', dob, 'unixepoch') = strftime('%m-%d', 'now')
        // Assuming dob is stored as integer (unix timestamp in seconds or ms).
        // Drizzle 'timestamp' mode usually handles Date objects -> ms or seconds depending on config.
        // Schema says: integer('dob', { mode: 'timestamp' }) -> mapped to Date in JS, but stored as INTEGER (ms? or seconds?)
        // Drizzle-orm/sqlite-core usually stores as ms by default for 'timestamp' mode IIRC, or we need to check.
        // If it's MS, we divide by 1000.
        // Let's assume MS.

        const monthDay = now.toISOString().slice(5, 10); // "MM-DD" e.g "01-05"

        // It is safer to fetch candidate users in JS if not too many, or use raw SQL.
        // But we need to do it per-tenant to respect the automation.

        for (const auto of birthdayAutos) {
            // Fetch users for this tenant
            const tenantUsers = await db.select({
                email: users.email,
                firstName: users.profile,
                dob: users.dob
            })
                .from(tenantMembers)
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .where(and(
                    eq(tenantMembers.tenantId, auto.tenantId),
                    eq(tenantMembers.status, 'active'),
                    isNotNull(users.dob)
                ));

            // Filter in JS for simplicity avoiding SQLite quirks across environments
            const birthdays = tenantUsers.filter(u => {
                if (!u.dob) return false;
                const d = new Date(u.dob);
                // Compare Month and Date
                return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
            });

            if (birthdays.length === 0) continue;

            // Prepare Email Service
            // Need tenant settings/branding.
            const tenant = await db.query.tenants.findFirst({
                where: eq(tenants.id, auto.tenantId)
            });
            if (!tenant) continue;

            // EmailService imported at top
            const emailService = new EmailService(env.RESEND_API_KEY, {
                branding: tenant.branding as any,
                settings: tenant.settings as any
            });

            for (const user of birthdays) {
                // Check if already sent today
                // We can check emailLogs for this automationId + recipientEmail + sentAt > start of today
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                const existingLog = await db.query.emailLogs.findFirst({
                    where: and(
                        eq(emailLogs.recipientEmail, user.email),
                        // We check metadata for automationId? Or just check recent logs?
                        // Schema has metadata as json. Drizzle query helper might not filter JSON field easily.
                        // But we can check sentAt first.
                        gte(emailLogs.sentAt, startOfDay)
                    )
                });

                // If we found a log today, check if it was for this automation (in JS)
                if (existingLog) {
                    const meta = existingLog.metadata as any;
                    if (meta && meta.automationId === auto.id) continue;
                }

                // Send Email
                // Parse profile json if needed (Drizzle 'json' mode handles it automatically?)
                // Query returns it as object if typed correctly.
                const profile: any = user.firstName || {};
                const firstName = profile.firstName || 'Student';

                let content = auto.content;
                content = content.replace(/{{firstName}}/g, firstName);
                content = content.replace(/{{studioName}}/g, tenant.name);
                const subject = auto.subject.replace(/{{firstName}}/g, firstName);

                try {
                    console.log(`Sending Birthday email to ${user.email} (Tenant: ${tenant.slug})`);
                    await emailService.sendGenericEmail(user.email, subject, content, true);

                    await db.insert(emailLogs).values({
                        id: crypto.randomUUID(),
                        tenantId: tenant.id,
                        recipientEmail: user.email,
                        subject: subject,
                        status: 'sent',
                        metadata: { trigger: 'birthday', automationId: auto.id }
                    } as any).run();

                } catch (e) {
                    console.error("Failed to send birthday email", e);
                }
            }
        }
        // 4. Automated Workflows (Trial / Flows)
        // Runs on every tick (e.g. 15 mins)
        // It iterates all active tenants and processes triggers.
        // Optimization: We could query only tenants with enabled automations first.
        // For now, let's iterate known active tenants from previous steps or query distinct tenants.
        // Or just query ALL active tenants.
        // AutomationsService does query by tenantId.
        // Let's loop all Active tenants.

        const allTenants = await db.select({ id: tenants.id, branding: tenants.branding, settings: tenants.settings }).from(tenants).where(eq(tenants.status, 'active')).all();

        for (const tenant of allTenants) {
            const emailService = new EmailService(env.RESEND_API_KEY, {
                branding: tenant.branding as any,
                settings: tenant.settings as any
            });
            const autoService = new AutomationsService(db, tenant.id, emailService);

            try {
                await autoService.processTimeBasedAutomations();
            } catch (e) {
                console.error(`Failed to process automations for tenant ${tenant.id}`, e);
            }
        }
    }

    // 5. Billing Renewal Notifications
    await processRenewals(db, env);
};

async function processRenewals(db: any, env: any) {
    const now = new Date();
    // Target date: 3 days from now
    const targetDateStart = new Date(now);
    targetDateStart.setDate(targetDateStart.getDate() + 3);
    targetDateStart.setHours(0, 0, 0, 0);

    const targetDateEnd = new Date(targetDateStart);
    targetDateEnd.setHours(23, 59, 59, 999);

    console.log(`Processing Renewals for target range: ${targetDateStart.toISOString()} - ${targetDateEnd.toISOString()}`);

    // --- A. Platform Subscription Renewals (Tenant Owners) ---
    // Find tenants whose currentPeriodEnd falls within the target day
    const renewingTenants = await db.query.tenants.findMany({
        where: and(
            gte(tenants.currentPeriodEnd, targetDateStart),
            lte(tenants.currentPeriodEnd, targetDateEnd),
            eq(tenants.subscriptionStatus, 'active')
        )
    });

    for (const tenant of renewingTenants) {
        // Find Owner(s)
        const owners = await db.select({
            email: users.email,
            firstName: users.profile,
            userId: users.id
        })
            .from(tenantMembers)
            .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, tenant.id),
                eq(tenantRoles.role, 'owner')
            ))
            .all();

        for (const owner of owners) {
            if (!owner.email) continue;

            const periodEndNum = tenant.currentPeriodEnd ? new Date(tenant.currentPeriodEnd).getTime() : 0;
            const uniqueKey = `platform_renewal_notice_${tenant.id}_${periodEndNum}`;

            // Check duplicate log
            const existingLog = await db.select().from(emailLogs).where(and(
                eq(emailLogs.recipientEmail, owner.email),
                eq(emailLogs.status, 'sent'),
                sql`json_extract(${emailLogs.metadata}, '$.uniqueKey') = ${uniqueKey}`
            )).get();

            if (existingLog) continue;

            // Send Email (Platform Branding)
            const emailService = new EmailService(env.RESEND_API_KEY); // No tenant config = Platform branding
            const profile: any = owner.firstName || {};
            const name = profile.firstName || 'Partner';
            const dateStr = tenant.currentPeriodEnd ? new Date(tenant.currentPeriodEnd).toLocaleDateString() : 'soon';

            try {
                await emailService.sendGenericEmail(
                    owner.email,
                    `Upcoming Subscription Renewal`,
                    `
                    <h1>Subscription Renewal Notice</h1>
                    <p>Hi ${name},</p>
                    <p>This is a reminder that your subscription to <strong>Studio Platform</strong> is set to renew on <strong>${dateStr}</strong>.</p>
                    <p>No action is required if your payment details are up to date.</p>
                    <p>Thank you for building with us!</p>
                    `,
                    true
                );

                // Log it
                await db.insert(emailLogs).values({
                    id: crypto.randomUUID(),
                    tenantId: tenant.id,
                    recipientEmail: owner.email,
                    subject: 'Upcoming Subscription Renewal',
                    status: 'sent',
                    metadata: { uniqueKey, type: 'platform_renewal' }
                }).run();

                console.log(`Sent Platform Renewal Notice to ${owner.email}`);
            } catch (e) {
                console.error(`Failed to send platform renewal to ${owner.email}`, e);
            }
        }
    }

    // --- B. Studio Membership Renewals (Students) ---
    // Find subscriptions expiring in 3 days
    const renewingSubs = await db.query.subscriptions.findMany({
        where: and(
            gte(subscriptions.currentPeriodEnd, targetDateStart),
            lte(subscriptions.currentPeriodEnd, targetDateEnd),
            eq(subscriptions.status, 'active')
        ),
        with: {
            tenant: true, // Need branding
            // We need user email, but 'subscriptions' links to Users.
            // Drizzle 'with' needs relation defined in schema logic (relations).
            // Schema has 'userId', let's fetch user manually or rely on relations if present.
            // Looking at schema.ts, we need to check if relations are defined for subscriptions -> users.
            // Taking safe route: fetch user details manually if needed, or query with join.
        }
    });

    // Efficiently batch fetch users if list is large, but loop is fine for cron for now.
    // Actually, 'renewingSubs' will be list of subscription objects.
    // 'tenant' is joined. 'userId' is available.

    for (const sub of renewingSubs) {
        if (!sub.tenant || !sub.userId) continue;

        const user = await db.query.users.findFirst({ where: eq(users.id, sub.userId) });
        if (!user || !user.email) continue;

        // Determine Plan Name (for email context)
        let planName = 'Membership';
        if (sub.planId) {
            // Fetch plan name (Optimize: cache or join)
            // We can assume we might need to fetch it.
            const plan = await db.query.membershipPlans.findFirst({ where: eq(membershipPlans.id, sub.planId) });
            if (plan) planName = plan.name;
        }

        const periodEndNum = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;
        const uniqueKey = `student_renewal_notice_${sub.id}_${periodEndNum}`;

        // Check duplicate log
        const existingLog = await db.select().from(emailLogs).where(and(
            eq(emailLogs.recipientEmail, user.email),
            eq(emailLogs.status, 'sent'),
            sql`json_extract(${emailLogs.metadata}, '$.uniqueKey') = ${uniqueKey}`
        )).get();

        if (existingLog) continue;

        // Send Email (Studio Branding)
        const emailService = new EmailService(env.RESEND_API_KEY, {
            branding: sub.tenant.branding as any,
            settings: sub.tenant.settings as any
        }, { slug: sub.tenant.slug, customDomain: sub.tenant.customDomain });

        const profile: any = user.profile || {};
        const name = profile.firstName || 'Student';
        const dateStr = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'soon';

        try {
            await emailService.sendGenericEmail(
                user.email,
                `Membership Renewal: ${planName}`,
                `
                <h1>Upcoming Renewal</h1>
                <p>Hi ${name},</p>
                <p>Your <strong>${planName}</strong> membership at <strong>${sub.tenant.name}</strong> is set to renew on <strong>${dateStr}</strong>.</p>
                <p>We look forward to seeing you soon!</p>
                `,
                true
            );

            // Log it
            await db.insert(emailLogs).values({
                id: crypto.randomUUID(),
                tenantId: sub.tenant.id,
                recipientEmail: user.email,
                subject: `Membership Renewal: ${planName}`,
                status: 'sent',
                metadata: { uniqueKey, type: 'student_renewal', subscriptionId: sub.id }
            }).run();

            console.log(`Sent Student Renewal Notice to ${user.email} (Tenant: ${sub.tenant.slug})`);
        } catch (e) {
            console.error(`Failed to send student renewal to ${user.email}`, e);
        }
    }
}
