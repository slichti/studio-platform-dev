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
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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
            .where(eq(tenants.status, 'active'))
            .all();

        // Process in chunks to avoid variable limit (SQLite 999 vars)
        const CHUNK_SIZE = 50;
        for (let i = 0; i < activeCustomers.length; i += CHUNK_SIZE) {
            const chunk = activeCustomers.slice(i, i + CHUNK_SIZE);
            const memberIds = chunk.map(c => c.memberId);
            const emails = chunk.map(c => c.email).filter(e => !!e) as string[];

            if (memberIds.length === 0) continue;

            // 1. Batch Check Active Access
            const [activeSubs, activePacks] = await Promise.all([
                this.db.select({ memberId: subscriptions.memberId }).from(subscriptions)
                    .where(and(inArray(subscriptions.memberId, memberIds), eq(subscriptions.status, 'active'))).all(),
                this.db.select({ memberId: purchasedPacks.memberId }).from(purchasedPacks)
                    .where(and(inArray(purchasedPacks.memberId, memberIds), gt(purchasedPacks.remainingCredits, 0))).all()
            ]);

            const activeMemberIds = new Set([
                ...activeSubs.map(s => s.memberId),
                ...activePacks.map(p => p.memberId)
            ]);

            // 2. Batch Check Last Booking (Group By)
            const lastBookings = await this.db.select({
                memberId: bookings.memberId,
                lastSeen: sql<number>`MAX(${classes.startTime})`
            })
                .from(bookings)
                .innerJoin(classes, eq(bookings.classId, classes.id))
                .where(and(
                    inArray(bookings.memberId, memberIds),
                    isNotNull(bookings.checkedInAt)
                ))
                .groupBy(bookings.memberId)
                .all();

            const lastSeenMap = new Map(lastBookings.map(b => [b.memberId, new Date(b.lastSeen)]));

            // 3. Batch Check Recent Nudges
            const recentNudges = await this.db.select({ email: emailLogs.recipientEmail }).from(emailLogs)
                .where(and(
                    inArray(emailLogs.recipientEmail, emails),
                    eq(emailLogs.status, 'sent'),
                    sql`json_extract(${emailLogs.metadata}, '$.type') = 'nudge_inactive'`,
                    gte(emailLogs.sentAt, thirtyDaysAgo)
                )).all();

            const recentlyNudgedEmails = new Set(recentNudges.map(n => n.email));

            // 4. Process Logic In-Memory
            for (const customer of chunk) {
                if (!customer.email) continue;
                if (!activeMemberIds.has(customer.memberId)) continue; // Not an active customer
                if (recentlyNudgedEmails.has(customer.email)) continue; // Already nudged

                const lastSeen = lastSeenMap.get(customer.memberId);
                // If they never attended, we assume they are "new" and handled by other onboarding flows to avoid spamming "We Miss You" to someone who never came.
                if (!lastSeen) continue;

                if (lastSeen < cutoffDate) {
                    // Send Nudge
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

                        await this.db.insert(emailLogs).values({
                            id: crypto.randomUUID(),
                            tenantId: customer.tenantId,
                            recipientEmail: customer.email,
                            subject: 'We Miss You',
                            status: 'sent',
                            metadata: {
                                lastAttended: lastSeen.toISOString(),
                                type: 'nudge_inactive'
                            }
                        }).run();

                        console.log(`[Nudge] Sent inactive nudge to ${customer.email} (Last seen: ${lastSeen.toISOString()})`);
                    } catch (e) {
                        console.error(`[Nudge] Failed to send inactive nudge to ${customer.email}`, e);
                    }
                }
            }
        }
    }
}
