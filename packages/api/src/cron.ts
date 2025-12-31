import { createDb } from './db';
import { tenants, classes, bookings, tenantMembers } from 'db/src/schema'; // Ensure imports
import { and, eq, lte, gt, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { BookingService } from './services/bookings';

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
                const { NotificationService } = await import('./services/notifications');
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

                        // Return credits if applicable
                        if (booking.paymentMethod === 'credit' && booking.usedPackId) {
                            const { purchasedPacks } = await import('db/src/schema');
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
                }
            }
        }
    }
}
