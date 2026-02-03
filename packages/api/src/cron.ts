import { createDb } from './db';
import { tenants, classes, bookings, tenantMembers, marketingAutomations, users, emailLogs, purchasedPacks, tenantRoles, subscriptions, membershipPlans, scheduledReports } from '@studio/db/src/schema'; // Ensure imports
import { and, eq, lte, gt, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { BookingService } from './services/bookings';
import { ReportService } from './services/reports';

import { AutomationsService } from './services/automations';
import { EmailService } from './services/email';
import { NotificationService } from './services/notifications';
import { NudgeService } from './services/nudges';
import { ChurnService } from './services/churn';

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



    // 4. Automated Workflows (Trial / Flows) & Daily Maintenance
    // Runs on every tick (e.g. 15 mins)

    // Determine if this is the "Daily" run (e.g. 00:00 - 00:15 UTC)
    const isDailyRun = now.getUTCHours() === 0 && now.getUTCMinutes() < 15;
    if (isDailyRun) console.log("Starting Daily Maintenance Tasks...");

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

        // Daily: Update Churn Scores
        if (isDailyRun) {
            try {
                const churnService = new ChurnService(db, tenant.id);
                await churnService.updateAllScores();
            } catch (e) {
                console.error(`Failed to update churn scores for tenant ${tenant.id}`, e);
            }
        }
    }

    // 5. Billing Renewal Notifications
    await processRenewals(db, env);

    // 6. Student Nudges (Trial Expiring / Inactive)
    const nudgeService = new NudgeService(db, env);
    try {
        await nudgeService.checkTrialExpiring(3); // 3 days before
        // Weekly run optimization: Check if today is Monday (or any specific day)
        // Or simpler: checkInactiveStudents includes logic to not spam (30 day cool-off).
        // So harmless to run daily, but let's stick to simple logic.
        await nudgeService.checkInactiveStudents(14); // 14 days inactive
    } catch (e) {
        console.error("Failed to process nudges", e);
    }

    // 7. Scheduled Reports
    const dueReports = await db.query.scheduledReports.findMany({
        where: and(
            lte(scheduledReports.nextRun, now),
            eq(scheduledReports.status, 'active')
        ),
        with: {
            tenant: true
        }
    });

    for (const report of dueReports) {
        console.log(`Processing Scheduled Report: ${report.reportType} for Tenant ${report.tenantId}`);
        const reportService = new ReportService(db, report.tenantId);
        const emailService = new EmailService(env.RESEND_API_KEY, {
            branding: report.tenant.branding as any,
            settings: report.tenant.settings as any
        });

        try {
            const summaryHtml = await reportService.generateEmailSummary(report.reportType as any);
            const recipients = report.recipients as string[];

            for (const recipient of recipients) {
                await emailService.sendGenericEmail(
                    recipient,
                    `Scheduled Report: ${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)}`,
                    `
                    <div style="font-family: sans-serif; color: #374151;">
                        <p>Hello,</p>
                        <p>This is your scheduled <strong>${report.reportType}</strong> report for <strong>${report.tenant.name}</strong>.</p>
                        ${summaryHtml}
                        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #E5E7EB;" />
                        <p style="font-size: 12px; color: #9CA3AF;">You received this because you are subscribed to scheduled reports for ${report.tenant.name}.</p>
                    </div>
                    `
                );
            }

            // Update schedule
            let nextRun = new Date(report.nextRun);
            if (report.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
            else if (report.frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
            else if (report.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

            await db.update(scheduledReports)
                .set({
                    lastSent: now,
                    nextRun: nextRun,
                    updatedAt: now
                })
                .where(eq(scheduledReports.id, report.id))
                .run();

        } catch (e) {
            console.error(`Failed to process scheduled report ${report.id}`, e);
        }
    }
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
    // (Student renewals are now handled by Automations engine)
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
}
