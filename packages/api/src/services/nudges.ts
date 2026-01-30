import { DrizzleD1Database } from 'drizzle-orm/d1';
import { bookings, emailLogs, tenants, tenantMembers, tenantRoles, subscriptions, membershipPlans, users, purchasedPacks, classes } from '@studio/db/src/schema'; // Ensure imports
import { and, eq, lte, gt, gte, inArray, isNotNull, sql, desc } from 'drizzle-orm';
import { EmailService } from './email';

export class NudgeService {
    constructor(
        private db: DrizzleD1Database<any>,
        private env: any
    ) { }

    // 1. Trial Expiring Soon (Run daily)
    async checkTrialExpiring(daysBefore: number = 3) {
        console.log(`[Nudge] Checking trials expiring in ${daysBefore} days...`);
        const now = new Date();
        const targetDateStart = new Date(now);
        targetDateStart.setDate(targetDateStart.getDate() + daysBefore);
        targetDateStart.setHours(0, 0, 0, 0);

        const targetDateEnd = new Date(targetDateStart);
        targetDateEnd.setHours(23, 59, 59, 999);

        // Find subscriptions expiring in range that are 'trialing'
        const expiringTrials = await this.db.select({
            subId: subscriptions.id,
            status: subscriptions.status,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            tenantId: subscriptions.tenantId,
            memberId: subscriptions.memberId,
            planName: membershipPlans.name,
            tenantName: tenants.name,
            settings: tenants.settings,
            branding: tenants.branding,
            email: users.email,
            firstName: users.profile
        })
            .from(subscriptions)
            .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
            .innerJoin(tenants, eq(subscriptions.tenantId, tenants.id))
            .innerJoin(tenantMembers, eq(subscriptions.memberId, tenantMembers.id))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(subscriptions.status, 'trialing'),
                gte(subscriptions.currentPeriodEnd, targetDateStart),
                lte(subscriptions.currentPeriodEnd, targetDateEnd)
            ))
            .all();

        for (const trial of expiringTrials) {
            if (!trial.email) continue;

            const uniqueKey = `trial_expiring_${trial.subId}_${daysBefore}days`;

            // Avoid duplicates
            const existingLog = await this.db.select().from(emailLogs).where(and(
                eq(emailLogs.recipientEmail, trial.email),
                eq(emailLogs.status, 'sent'),
                sql`json_extract(${emailLogs.metadata}, '$.uniqueKey') = ${uniqueKey}`
            )).get();

            if (existingLog) continue;

            // Send Email
            const emailService = new EmailService(this.env.RESEND_API_KEY, {
                branding: trial.branding as any,
                settings: trial.settings as any
            });

            const profile: any = trial.firstName || {};
            const name = profile.firstName || 'Student';
            const endDate = new Date(trial.currentPeriodEnd as Date).toLocaleDateString();

            try {
                // Use generic template for MVP, can migrate to specific React template later
                await emailService.sendGenericEmail(
                    trial.email,
                    `Your trial at ${trial.tenantName} is ending soon`,
                    `
                    <p>Hi ${name},</p>
                    <p>Just a friendly reminder that your trial for <strong>${trial.planName}</strong> is ending on <strong>${endDate}</strong>.</p>
                    <p>We hope you've enjoyed your time with us so far! If you wish to continue your membership, no action is needed.</p>
                    <div style="margin-top: 20px;">
                        <a href="https://${trial.tenantName.toLowerCase().replace(/\s/g, '')}.studio-platform.com/portal" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Portal</a>
                    </div>
                    `,
                    false // use tenant branding
                );

                // Log it
                await this.db.insert(emailLogs).values({
                    id: crypto.randomUUID(),
                    tenantId: trial.tenantId,
                    recipientEmail: trial.email,
                    subject: 'Trial Expiring Soon',
                    status: 'sent',
                    metadata: { uniqueKey, type: 'nudge_trial_expiry' }
                }).run();

                console.log(`[Nudge] Sent trial expiry email to ${trial.email}`);

            } catch (e) {
                console.error(`[Nudge] Failed to send trial expiry to ${trial.email}`, e);
            }
        }
    }

    // 2. Inactive Students (Run weekly)
    async checkInactiveStudents(daysInactive: number = 14) {
        console.log(`[Nudge] Checking students inactive for ${daysInactive}+ days...`);
        const now = new Date();
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

        // We want students who:
        // 1. Have active membership/pack (so they ARE customers)
        // 2. LAST attended a class < cutoffDate
        // 3. HAVEN'T been nudged recently (e.g. in last 30 days)

        // Strategy:
        // Select members with active subs/packs.
        // For each, check last booking date.

        // MVP Optimization: 
        // Iterate all active members across all tenants? Expensive.
        // Let's filter by only tenants who have this feature enabled? 
        // For now, iterate all active subscriptions as a proxy for "Active Customer".

        const activeCustomers = await this.db.select({
            memberId: tenantMembers.id,
            tenantId: tenantMembers.tenantId,
            email: users.email,
            firstName: users.profile,
            tenantName: tenants.name,
            settings: tenants.settings,
            branding: tenants.branding
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
            .where(eq(tenants.status, 'active')) // Only active tenants
            .all();

        // This is potentially large. In production, we'd paginate or do this per-tenant via queue.
        // For current scale, it's fine.

        for (const customer of activeCustomers) {
            if (!customer.email) continue;

            // Check if they have active access (Subscription OR Pack credits > 0)
            const hasActiveSub = await this.db.select().from(subscriptions).where(and(
                eq(subscriptions.memberId, customer.memberId),
                eq(subscriptions.status, 'active')
            )).get();

            const hasCredits = await this.db.select().from(purchasedPacks).where(and(
                eq(purchasedPacks.memberId, customer.memberId),
                gt(purchasedPacks.remainingCredits, 0)
            )).get();

            if (!hasActiveSub && !hasCredits) continue; // Not an "active" paying customer to retain

            // Check Last Booking
            const lastBooking = await this.db.select().from(bookings)
                .innerJoin(classes, eq(bookings.classId, classes.id))
                .where(and(
                    eq(bookings.memberId, customer.memberId),
                    isNotNull(bookings.checkedInAt) // actually attended
                ))
                .orderBy(desc(classes.startTime))
                .limit(1)
                .get();

            let lastAttendedAt = lastBooking ? new Date(lastBooking.classes.startTime) : null;

            // If they NEVER attended, maybe use joinedAt?
            // Let's skip never-attended for "We Miss You", that's a different flow ("First Class").
            if (!lastAttendedAt) continue;

            if (lastAttendedAt < cutoffDate) {
                // They are inactive!

                // Check if nudged recently (don't spam every week)
                const recentNudge = await this.db.select().from(emailLogs).where(and(
                    eq(emailLogs.recipientEmail, customer.email),
                    eq(emailLogs.status, 'sent'),
                    sql`json_extract(${emailLogs.metadata}, '$.type') = 'nudge_inactive'`,
                    gte(emailLogs.sentAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) // 30 days cool-off
                )).get();

                if (recentNudge) continue;

                // Send "We Miss You" Email
                const emailService = new EmailService(this.env.RESEND_API_KEY, {
                    branding: customer.branding as any,
                    settings: customer.settings as any
                });

                const profile: any = customer.firstName || {};
                const name = profile.firstName || 'Friend';

                try {
                    await emailService.sendGenericEmail(
                        customer.email,
                        `We miss you at ${customer.tenantName}!`,
                        `
                        <p>Hi ${name},</p>
                        <p>We noticed it's been a while since your last visit. We'd love to see you back on the mat!</p>
                        <p>Check out our schedule and book your next class today.</p>
                        <div style="margin-top: 20px;">
                            <a href="https://${customer.tenantName.toLowerCase().replace(/\s/g, '')}.studio-platform.com/schedule" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Schedule</a>
                        </div>
                        `,
                        false
                    );

                    // Log it
                    await this.db.insert(emailLogs).values({
                        id: crypto.randomUUID(),
                        tenantId: customer.tenantId,
                        recipientEmail: customer.email,
                        subject: 'We Miss You',
                        status: 'sent',
                        metadata: {
                            lastAttended: lastAttendedAt.toISOString(),
                            type: 'nudge_inactive'
                        }
                    }).run();

                    console.log(`[Nudge] Sent inactive nudge to ${customer.email} (Last seen: ${lastAttendedAt.toISOString()})`);
                } catch (e) {
                    console.error(`[Nudge] Failed to send inactive nudge to ${customer.email}`, e);
                }
            }
        }
    }
}
