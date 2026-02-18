import { createDb } from '../db';
import { eq, and, lt, gt, gte, lte, or, isNull, sql, inArray } from 'drizzle-orm';
import { marketingAutomations, automationLogs, subscriptions, tenantMembers, users, tenants, coupons, bookings, posOrders, classes, locations, waiverSignatures } from '@studio/db/src/schema'; // Added bookings, posOrders, locations, waiverSignatures
import { EmailService } from './email';
import { SmsService } from './sms'; // Active
import { PushService } from './push';
import { tenantRoles } from '@studio/db/src/schema';
import { UsageService } from './pricing';

export class AutomationsService {
    private db: any;
    private tenantId: string;
    private emailService: EmailService;
    private smsService: SmsService | undefined;
    private pushService: PushService | undefined;

    constructor(db: any, tenantId: string, emailService: EmailService, smsService?: SmsService, pushService?: PushService) {
        this.db = db;
        this.tenantId = tenantId;
        this.emailService = emailService;
        this.smsService = smsService;
        this.pushService = pushService;
    }

    /**
     * Dispatch an event immediately (e.g. from API Webhook or Route)
     * Handles "Immediate" timing automations.
     */
    async dispatchTrigger(triggerEvent: string, context: { userId: string, memberId?: string, email?: string, phone?: string, firstName?: string, lastName?: string, data?: any }) {
        // ... (unchanged select) ...
        const automations = await this.db.select().from(marketingAutomations)
            .where(and(
                eq(marketingAutomations.tenantId, this.tenantId),
                eq(marketingAutomations.isEnabled, true),
                eq(marketingAutomations.triggerEvent, triggerEvent),
                eq(marketingAutomations.timingType, 'immediate') // We only handle immediate here. Delayed ones need a queue or scheduler (Out of Scope for MVP unless heavily requested)
            )).all();

        for (const auto of automations) {
            // Check Conditions
            if (!this.checkConditions(auto.triggerCondition, context.data)) continue;

            // Execute
            await this.executeAutomation(auto, context);
        }
    }

    // ... (omitting cron methods for brevity, assuming they work or I'll patch fetches later? I should patch fetches now) ...
    // Wait, replacing the whole file is safer or targeted? Targeted is better. 
    // I'll update the constructor and imports first. Then I'll update executeAutomation.

    // ...



    /**
     * Cron Job Entry Point: Checks for Time-Based Triggers
     * - Birthday
     * - Trial Ending
     * - Absent X Days
     * - Subscription Renewing
     */
    async processTimeBasedAutomations() {
        const automations = await this.db.select().from(marketingAutomations)
            .where(and(
                eq(marketingAutomations.tenantId, this.tenantId),
                eq(marketingAutomations.isEnabled, true)
            )).all();

        if (automations.length === 0) return;

        const now = new Date();

        for (const auto of automations) {
            switch (auto.triggerEvent) {
                case 'birthday':
                    await this.processBirthday(auto, now);
                    break;
                case 'absent':
                    await this.processAbsent(auto, now);
                    break;
                case 'trial_ending':
                case 'subscription_renewing':
                    await this.processSubscriptionTiming(auto, now);
                    break;
                case 'waiver_missing_reminder':
                    await this.processWaiverMissing(auto, now);
                    break;
                case 'attendance_streak_at_risk':
                    await this.processAttendanceStreakAtRisk(auto, now);
                    break;
                default:
                    if (auto.timingType === 'before') {
                        await this.processBeforeEventTriggers(auto, now);
                    } else if (auto.timingType === 'delay') {
                        await this.processDelayedTriggers(auto, now);
                    }
                    break;
            }
        }
    }

    // --- Processors ---

    private async processBirthday(auto: any, now: Date) {
        // Find users with birthday today (ignoring year)
        // SQLite: strftime('%m-%d', dob) = strftime('%m-%d', 'now')
        // Drizzle might define sql for this.

        // MVP: Fetch active members with DOB, filter in JS for simplicity/database compatibility
        const members = await this.db.select({
            userId: users.id,
            email: users.email,
            profile: users.profile,
            dob: users.dob
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantMembers.status, 'active')
            )).all();

        const todayMonth = now.getMonth();
        const todayDate = now.getDate();

        for (const m of members as any[]) {
            if (!m.dob) continue;
            const dob = new Date(m.dob);
            if (dob.getMonth() === todayMonth && dob.getDate() === todayDate) {
                await this.executeAutomation(auto, {
                    userId: m.userId,
                    email: m.email,
                    firstName: (m.profile as any)?.firstName
                });
            }
        }
    }

    private async processAbsent(auto: any, now: Date) {
        // Trigger: Absent X Days (Win-back)
        const daysThreshold = auto.timingValue || 30;
        const cutoffDate = new Date(now.getTime() - (daysThreshold * 24 * 60 * 60 * 1000));

        // Find members who are active but haven't attended since cutoffDate
        // We select members where the MOST RECENT booking check-in is before cutoffDate.

        // Step 1: Get all active members likely to be candidates (optimization: restrict by joinedAt < cutoffDate)
        const candidates = await this.db.select({
            memberId: tenantMembers.id,
            userId: users.id,
            email: users.email,
            profile: users.profile,
            joinedAt: tenantMembers.joinedAt
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantMembers.status, 'active'),
                lte(tenantMembers.joinedAt, cutoffDate)
            )).all();

        // Step 2: Batch fetch latest activity for all candidates to avoid N+1
        const memberIds = candidates.map((c: any) => c.memberId);
        if (!memberIds.length) return;

        const lastActivities = await this.db.select({
            memberId: bookings.memberId,
            lastActive: sql<number>`MAX(CASE 
                WHEN ${bookings.checkedInAt} IS NOT NULL THEN ${bookings.checkedInAt}
                ELSE ${bookings.createdAt}
            END)`
        })
            .from(bookings)
            .where(and(
                inArray(bookings.memberId, memberIds),
                eq(bookings.status, 'confirmed')
            ))
            .groupBy(bookings.memberId)
            .all();

        const activityMap = new Map<string, number>(
            lastActivities.map((a: any) => [a.memberId, Number(a.lastActive)])
        );

        for (const c of candidates as any[]) {
            const lastActiveTimestamp = activityMap.get(c.memberId);
            if (!lastActiveTimestamp) continue;

            const lastActiveDate = new Date(lastActiveTimestamp);

            if (lastActiveDate < cutoffDate) {
                await this.executeAutomation(auto, {
                    userId: c.userId,
                    email: c.email,
                    firstName: (c.profile as any)?.firstName
                });
            }
        }
    }

    private async processWaiverMissing(auto: any, now: Date) {
        const hoursThreshold = auto.timingValue || 24;
        const cutoffDate = new Date(now.getTime() - (hoursThreshold * 60 * 60 * 1000));

        // Find members who joined at least X hours ago
        const newMembers = await this.db.select({
            id: tenantMembers.id,
            userId: tenantMembers.userId,
            email: users.email,
            profile: users.profile,
            joinedAt: tenantMembers.joinedAt
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantMembers.status, 'active'),
                lte(tenantMembers.joinedAt, cutoffDate)
            )).all();

        const memberIds = newMembers.map((m: any) => m.id);
        if (memberIds.length === 0) return;

        const signatures = await this.db.select({ memberId: waiverSignatures.memberId })
            .from(waiverSignatures)
            .where(inArray(waiverSignatures.memberId, memberIds))
            .all();

        const signedMap = new Set(signatures.map((s: any) => s.memberId));

        for (const m of newMembers as any[]) {
            if (!signedMap.has(m.id)) {
                await this.executeAutomation(auto, {
                    userId: m.userId,
                    email: m.email,
                    firstName: (m.profile as any)?.firstName
                });
            }
        }
    }

    private async processAttendanceStreakAtRisk(auto: any, now: Date) {
        // Trigger: Student has a streak but hasn't booked anything recently
        const recentDays = 14;
        const streakThreshold = 3;
        const inactivityThreshold = auto.timingValue || 5;

        const cutoffRecent = new Date(now.getTime() - (recentDays * 24 * 60 * 60 * 1000));
        const cutoffInactivity = new Date(now.getTime() - (inactivityThreshold * 24 * 60 * 60 * 1000));

        // Find members with recent attendance
        const activeMembers = await this.db.select({
            id: tenantMembers.id,
            userId: tenantMembers.userId,
            email: users.email,
            profile: users.profile
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantMembers.status, 'active')
            )).all() as any[];

        const memberIds = activeMembers.map((m: any) => m.id);
        if (memberIds.length === 0) return;

        // 1. Batch count recent attendances
        const recentCounts = await this.db.select({
            memberId: bookings.memberId,
            count: sql<number>`count(*)`
        })
            .from(bookings)
            .where(and(
                inArray(bookings.memberId, memberIds),
                eq(bookings.status, 'confirmed'),
                gte(bookings.checkedInAt, cutoffRecent)
            ))
            .groupBy(bookings.memberId)
            .all();

        const countMap = new Map(recentCounts.map((r: any) => [r.memberId, Number(r.count)]));
        const membersWithStreak = activeMembers.filter((m: any) => (Number(countMap.get(m.id)) || 0) >= streakThreshold);
        if (membersWithStreak.length === 0) return;

        const streakMemberIds = membersWithStreak.map((m: any) => m.id as string);

        // 2. Batch check for future bookings
        const futureCounts = await this.db.select({
            memberId: bookings.memberId,
            count: sql<number>`count(*)`
        })
            .from(bookings)
            .where(and(
                inArray(bookings.memberId, streakMemberIds),
                eq(bookings.status, 'confirmed'),
                gt(bookings.createdAt, now)
            ))
            .groupBy(bookings.memberId)
            .all();

        const futureMap = new Set(futureCounts.map((f: any) => f.memberId));
        const membersToNotify = membersWithStreak.filter((m: any) => !futureMap.has(m.id));
        if (membersToNotify.length === 0) return;

        const notifyIds = membersToNotify.map((m: any) => m.id);

        // 3. Batch fetch last attendance
        const lastAttendances = await this.db.select({
            memberId: bookings.memberId,
            lastCheckedInAt: sql<number>`MAX(${bookings.checkedInAt})`
        })
            .from(bookings)
            .where(and(
                inArray(bookings.memberId, notifyIds),
                eq(bookings.status, 'confirmed')
            ))
            .groupBy(bookings.memberId)
            .all();

        const lastAttendanceMap = new Map(lastAttendances.map((a: any) => [a.memberId, Number(a.lastCheckedInAt)]));

        for (const m of membersToNotify as any[]) {
            const lastCheckedInAt = lastAttendanceMap.get(m.id);
            if (lastCheckedInAt !== undefined) {
                const lastDate = new Date(Number(lastCheckedInAt));
                if (lastDate < cutoffInactivity) {
                    await this.executeAutomation(auto, {
                        userId: m.userId,
                        email: m.email,
                        firstName: (m.profile as any)?.firstName
                    });
                }
            }
        }
    }

    private async processSubscriptionTiming(auto: any, now: Date) {
        // trial_ending (Before X hours)
        // subscription_renewing (Before X hours)

        const hoursBuffer = auto.timingValue || 24;
        const targetWindowStart = new Date(now.getTime() + (hoursBuffer * 60 * 60 * 1000));
        // We look for subscriptions expiring "soon".
        // e.g. currentPeriodEnd is approx targetWindowStart.

        const activeSubs = await this.db.select()
            .from(subscriptions)
            .where(and(
                eq(subscriptions.tenantId, this.tenantId),
                or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'trialing'))
            )).all() as any[];

        const validSubs = activeSubs.filter((sub: any) => {
            if (!sub.currentPeriodEnd) return false;
            const end = new Date(sub.currentPeriodEnd);
            const diffHours = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
            return diffHours >= hoursBuffer && diffHours < (hoursBuffer + 1);
        });

        if (validSubs.length === 0) return;

        const userIds = validSubs.map((s: any) => s.userId as string);
        const usersList = await this.db.select().from(users).where(inArray(users.id, userIds)).all();
        const userMap = new Map((usersList as any[]).map((u: any) => [u.id, u]));

        for (const sub of validSubs as any[]) {
            const user = userMap.get(sub.userId);
            if (user) {
                await this.executeAutomation(auto, {
                    userId: user.id,
                    email: user.email,
                    firstName: (user.profile as any)?.firstName,
                    data: { planId: sub.planId }
                });
            }
        }
    }

    private async processDelayedTriggers(auto: any, now: Date) {
        // Generic Delay Handler looking for creation time based on event type
        const hoursDelay = auto.timingValue || 24;
        const targetTime = new Date(now.getTime() - (hoursDelay * 60 * 60 * 1000));
        const windowStart = new Date(targetTime.getTime() - (1 * 60 * 60 * 1000)); // Look for events between Delay+1h and Delay ago

        let candidates: { userId: string, email?: string, firstName?: string, data?: any }[] = [];

        if (auto.triggerEvent === 'new_student') {
            const members = await this.db.select()
                .from(tenantMembers)
                .where(and(
                    eq(tenantMembers.tenantId, this.tenantId),
                    gte(tenantMembers.joinedAt, windowStart),
                    lte(tenantMembers.joinedAt, targetTime)
                )).all();

            if (members.length === 0) return;
            const userIds = members.map((m: any) => m.userId);
            const usersList = await this.db.select().from(users).where(inArray(users.id, userIds as string[])).all();
            const userMap = new Map((usersList as any[]).map((u: any) => [u.id, u]));

            for (const m of members as any[]) {
                const user = userMap.get(m.userId);
                if (user) {
                    candidates.push({
                        userId: user.id,
                        email: user.email,
                        firstName: (user.profile as any)?.firstName
                    });
                }
            }

        } else if (auto.triggerEvent === 'subscription_created') {
            const subs = await this.db.select()
                .from(subscriptions)
                .where(and(
                    eq(subscriptions.tenantId, this.tenantId),
                    gte(subscriptions.createdAt, windowStart),
                    lte(subscriptions.createdAt, targetTime)
                )).all() as any[];

            if (subs.length === 0) return;
            const userIds = subs.map((s: any) => s.userId as string);
            const usersList = await this.db.select().from(users).where(inArray(users.id, userIds)).all();
            const userMap = new Map((usersList as any[]).map((u: any) => [u.id, u]));

            for (const s of subs as any[]) {
                const user = userMap.get(s.userId);
                if (user) {
                    candidates.push({
                        userId: user.id,
                        email: user.email,
                        firstName: (user.profile as any)?.firstName,
                        data: { planId: s.planId, status: s.status }
                    });
                }
            }
        } else if (auto.triggerEvent === 'class_booked') {
            const newBookings = await this.db.select({
                id: bookings.id,
                classId: bookings.classId,
                memberId: bookings.memberId,
                createdAt: bookings.createdAt
            })
                .from(bookings)
                .innerJoin(classes, eq(bookings.classId, classes.id))
                .where(and(
                    eq(classes.tenantId, this.tenantId),
                    eq(bookings.status, 'confirmed'),
                    gte(bookings.createdAt, windowStart),
                    lte(bookings.createdAt, targetTime)
                )).all();

            if (newBookings.length === 0) return;
            const classIds = Array.from(new Set(newBookings.map((b: any) => b.classId)));
            const memberIds = Array.from(new Set(newBookings.map((b: any) => b.memberId)));

            const classesList = await this.db.query.classes.findMany({
                where: inArray(classes.id, classIds as string[]),
                with: { series: true }
            });
            const classMap = new Map((classesList as any[]).map(c => [c.id, c]));

            const membersList = await this.db.query.tenantMembers.findMany({
                where: inArray(tenantMembers.id, memberIds as string[]),
                with: { user: true }
            });
            const memberMap = new Map((membersList as any[]).map(m => [m.id, m]));

            for (const b of newBookings as any[]) {
                const cls = classMap.get(b.classId);
                const member = memberMap.get(b.memberId);
                if (!cls || !member || !member.user) continue;

                candidates.push({
                    userId: member.user.id,
                    email: member.user.email,
                    firstName: (member.user.profile as any)?.firstName,
                    data: {
                        classTitle: cls.title,
                        startTime: cls.startTime,
                        bookingId: b.id
                    }
                });
            }
        }

        // Execute
        for (const c of candidates as any[]) {
            await this.executeAutomation(auto, {
                userId: c.userId,
                email: c.email,
                firstName: c.firstName,
                data: c.data
            });
        }
    }

    private async processBeforeEventTriggers(auto: any, now: Date) {
        // "Before Event" implies upcoming scheduled item.
        // Currently mostly applies to 'class_booked' (Reminder) or 'appointment'
        // But the triggerEvent in DB is 'class_booked'. 
        // A "Before Class" automation is essentially:
        // Event: class_booked (conceptually "Class Participation")
        // Timing: Before X hours.

        // We scan for Bookings where associated Class StartTime is (Now + X hours).

        const hoursBefore = auto.timingValue || 24;
        const targetTime = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000));
        const windowEnd = new Date(targetTime.getTime() + (1 * 60 * 60 * 1000)); // 1 hour window scan? 
        // Actually crons run every 15 mins? 
        // We should just check [targetTime, targetTime + 15m]? 
        // Logic: class.startTime is between [targetTime, targetTime + window]

        // Let's assume window is 1 hour to be safe against missed crons, relying on idempotency.

        if (auto.triggerEvent === 'class_booked') {
            // Find bookings where class starts soon
            // Join bookings -> classes

            // We need to construct a complex query or manual loop.
            // Manual loop over future classes?

            // Find classes starting in window
            const upcomingClasses = await this.db.select().from(classes)
                .where(and(
                    eq(classes.tenantId, this.tenantId),
                    gt(classes.startTime, targetTime),
                    lt(classes.startTime, windowEnd),
                    eq(classes.status, 'active')
                )).all() as any[];

            if (upcomingClasses.length === 0) return;
            const classIds = upcomingClasses.map((c: any) => c.id);

            // Fetch all participants for these classes in one go
            const participants = await this.db.select().from(bookings)
                .where(and(
                    inArray(bookings.classId, classIds as string[]),
                    eq(bookings.status, 'confirmed')
                )).all();

            if (participants.length === 0) return;
            const memberIds = Array.from(new Set(participants.map((p: any) => p.memberId as string)));

            const membersList = await this.db.query.tenantMembers.findMany({
                where: inArray(tenantMembers.id, memberIds as string[]),
                with: { user: true }
            });
            const memberMap = new Map((membersList as any[]).map(m => [m.id, m]));
            const classMap = new Map((upcomingClasses as any[]).map(c => [c.id, c]));

            for (const b of participants as any[]) {
                const cls = classMap.get(b.classId);
                const member = memberMap.get(b.memberId);
                if (!cls || !member || !member.user) continue;

                await this.executeAutomation(auto, {
                    userId: member.user.id,
                    email: member.user.email,
                    firstName: (member.user.profile as any)?.firstName,
                    data: {
                        classTitle: cls.title,
                        startTime: cls.startTime,
                        bookingId: b.id
                    }
                });
            }
        }
    }

    // --- Execution Core ---

    private checkConditions(condition: any, data: any): boolean {
        if (!condition) return true;

        // Simple Key-Value Match
        // e.g. { "planId": "xyz" } -> data.planId === "xyz"
        // e.g. { "minAmount": 100 } -> data.amount >= 100

        for (const key of Object.keys(condition)) {
            const val = condition[key];

            // Special handlers
            if (key === 'minAmount' && data?.amount !== undefined) {
                if (data.amount < val) return false;
            } else if (key === 'productId' && data?.items && Array.isArray(data.items)) {
                // Check if any item in the order has this productId
                const hasProduct = data.items.some((item: any) => item.productId === val);
                if (!hasProduct) return false;
            } else if (data?.[key] !== val) {
                // Fallback for standard equality
                // But what if data value is missing but we didn't require it? 
                // Implicitly if condition key exists, we require match.
                return false;
            }
        }
        return true;
    }

    private checkAudience(filter: any, context: any): boolean {
        // filter = { ageMin: 18, ageMax: 30, tags: ['vip'] }
        // context = { userId, ... } -> we need to fetch User Profile?
        // Actually context.data might have some, but likely we need to fetch user if we have userId.
        // For simplicity/performance, let's assume we need to fetch IF filter exists.

        if (!filter) return true;
        if (!context.userId) return false; // Cannot filter without user context

        // Note: In dispatchTrigger loop, we might not have full user object loaded. 
        // We should probably load it if filters are present. 
        // OR rely on what's passed.
        // Let's rely on fetching inside `dispatchTrigger` loop? No, that's N+1.
        // Better: Fetch user details if needed.

        return true; // Placeholder: To be implemented in dispatchTrigger loop or passed in context
    }

    private async executeAutomation(automation: any, context: { userId: string, email?: string, firstName?: string, lastName?: string, data?: any }) {
        const recipients = (automation.recipients as string[]) || ['student'];

        // Optimize: Fetch Tenant & Location once here
        const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, this.tenantId) });
        const location = await this.db.query.locations.findFirst({ where: eq(locations.tenantId, this.tenantId) });

        const sharedContext = {
            tenantName: tenant?.name || 'Studio',
            locationAddress: location?.address || ''
        };

        // 1. Send to Student (Original Target)
        if (recipients.includes('student')) {
            await this.dispatchToUser(automation, context, 'student', sharedContext);
        }

        // 2. Send to Owners
        if (recipients.includes('owner')) {
            const owners = await this.db.select({
                userId: tenantMembers.userId,
                email: users.email,
                profile: users.profile
            })
                .from(tenantMembers)
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
                .where(and(
                    eq(tenantMembers.tenantId, this.tenantId),
                    eq(tenantRoles.role, 'owner')
                )).all();

            for (const owner of owners) {
                // Enrich context for Owner
                // They need to know WHO the event is about (The Student)
                const ownerContext = {
                    userId: owner.userId,
                    email: owner.email,
                    firstName: (owner.profile as any)?.firstName || 'Owner',
                    lastName: (owner.profile as any)?.lastName || '',
                    data: {
                        ...context.data,
                        studentName: `${context.firstName || ''} ${context.lastName || ''}`.trim(),
                        studentEmail: context.email,
                        studentId: context.userId,
                        isOwnerNotification: true
                    }
                };
                await this.dispatchToUser(automation, ownerContext, 'owner', sharedContext);
            }
        }
    }

    private async dispatchToUser(
        automation: any,
        context: { userId: string, email?: string, firstName?: string, lastName?: string, data?: any },
        recipientType: string,
        sharedContext: { tenantName: string, locationAddress: string }
    ) {
        // 1. Idempotency Check
        const channels: string[] = automation.channels || ['email'];
        const channel = channels[0] || 'email';
        const logId = crypto.randomUUID();

        let timeWindow = 0; // Forever
        if (automation.triggerEvent === 'birthday') timeWindow = 300 * 24; // ~1 year
        if (automation.triggerEvent === 'absent') timeWindow = 14 * 24; // Don't spam absent nudges more than once per 2 weeks?
        if (automation.triggerEvent === 'new_student') timeWindow = 0; // Check ever

        if (timeWindow > 0) {
            const cutoff = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));
            const recent = await this.db.select().from(automationLogs)
                .where(and(
                    eq(automationLogs.automationId, automation.id),
                    eq(automationLogs.userId, context.userId), // Idempotency per recipient
                    gt(automationLogs.triggeredAt, cutoff)
                )).get();
            if (recent) return;
        } else {
            // Default: Check if EVER sent (for Welcome/Nudge) works best for retention.
            const existing = await this.db.select().from(automationLogs)
                .where(and(
                    eq(automationLogs.automationId, automation.id),
                    eq(automationLogs.userId, context.userId)
                )).get();
            if (existing) return;
        }

        // Fetch User Details if missing (lastName)
        if (!context.lastName || !context.firstName) {
            const user = await this.db.query.users.findFirst({ where: eq(users.id, context.userId) });
            if (user) {
                context.firstName = context.firstName || (user.profile as any)?.firstName;
                context.lastName = context.lastName || (user.profile as any)?.lastName;
                context.email = context.email || user.email;
            }
        }

        const extendedContext = {
            ...context,
            title: sharedContext.tenantName,
            address: sharedContext.locationAddress
        };

        // 2. Coupon Generation
        let couponCode = null;
        if (automation.couponConfig) {
            const prefix = automation.couponConfig.prefix || 'AUTO';
            const userPart = context.firstName ? context.firstName.substring(0, 3).toUpperCase() : 'MEM';
            const rand = Math.floor(1000 + Math.random() * 9000);
            couponCode = `${prefix}-${userPart}-${rand}`;

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + (automation.couponConfig.validityDays || 7));
            try {
                // @ts-ignore - coupons might not be in the current schema import scope but it was working before
                await this.db.insert(coupons).values({
                    id: crypto.randomUUID(),
                    tenantId: this.tenantId,
                    code: couponCode,
                    type: automation.couponConfig.type,
                    value: automation.couponConfig.value,
                    active: true,
                    usageLimit: 1,
                    expiresAt
                }).run();
            } catch (e) {
                console.error("Failed to generate coupon", e);
            }
        }

        try {
            if (channels.includes('email') && context.email) {
                if (automation.templateId) {
                    // Use Template
                    await this.emailService.sendTemplate(
                        context.email,
                        automation.templateId,
                        {
                            firstName: context.firstName,
                            lastName: context.lastName,
                            couponCode: couponCode,
                            ...context.data,
                            title: extendedContext.title,
                            studioName: extendedContext.title,
                            address: extendedContext.address
                        }
                    );
                } else {
                    // Standard Content Replacement
                    let content = automation.content;
                    let subject = automation.subject;

                    // Apply template processing using the existing helper
                    content = this.processTemplate(content, extendedContext, couponCode);
                    subject = this.processTemplate(subject, extendedContext, couponCode);

                    await this.emailService.sendGenericEmail(context.email, subject, content, true);
                }
            }

            if (channels.includes('push') && this.pushService) {
                // Fetch user push token if not in context
                let pushToken = context.data?.pushToken;
                if (!pushToken) {
                    const user = await this.db.query.users.findFirst({ where: eq(users.id, context.userId) });
                    pushToken = user?.pushToken;
                }

                if (pushToken) {
                    let body = automation.content;
                    let subject = automation.subject;
                    body = this.processTemplate(body, extendedContext, couponCode);
                    subject = this.processTemplate(subject, extendedContext, couponCode);

                    // Strip HTML if generic push doesn't support it
                    const textBody = body.replace(/<[^>]*>/g, '');

                    await this.pushService.sendPush(pushToken, subject, textBody, {
                        ...context.data,
                        automationId: automation.id
                    });
                }
            }

            // 4. Log
            await this.db.insert(automationLogs).values({
                id: logId,
                tenantId: this.tenantId,
                automationId: automation.id,
                userId: context.userId,
                channel: channel,
                metadata: { couponCode, recipientType }
            }).run();

        } catch (e) {
            console.error(`Automation Failed ${automation.id}`, e);
        }
    }

    private processTemplate(text: string, context: any, couponCode: string | null) {
        // Core Variables
        let processed = text
            .replace(/\{{1,2}first_name\}{1,2}/gi, context.firstName || 'Friend')
            .replace(/\{{1,2}firstName\}{1,2}/gi, context.firstName || 'Friend') // Support both
            .replace(/\{{1,2}last_name\}{1,2}/gi, context.lastName || '')
            .replace(/\{{1,2}lastName\}{1,2}/gi, context.lastName || '')
            .replace(/\{{1,2}email\}{1,2}/gi, context.email || '')
            .replace(/\{{1,2}title\}{1,2}/gi, context.title || '')
            .replace(/\{{1,2}studioName\}{1,2}/gi, context.title || '') // Alias
            .replace(/\{{1,2}tenant\}{1,2}/gi, context.title || '') // Alias requested by user
            .replace(/\{{1,2}address\}{1,2}/gi, context.address || '')
            .replace(/\{{1,2}studioAddress\}{1,2}/gi, context.address || '');

        // Coupon
        if (couponCode) {
            processed = processed.replace(/\{{1,2}coupon_code\}{1,2}/gi, couponCode);
        }

        // Context Data Variables (Deep check in context.data)
        const data = context.data || {};

        // Class/Booking specific
        if (data.classTitle) processed = processed.replace(/\{{1,2}classTitle\}{1,2}/g, data.classTitle);
        if (data.startTime) {
            const date = new Date(data.startTime);
            processed = processed.replace(/\{{1,2}classDate\}{1,2}/g, date.toLocaleDateString());
            processed = processed.replace(/\{{1,2}classTime\}{1,2}/g, date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        if (data.feeAmount) processed = processed.replace(/\{{1,2}feeAmount\}{1,2}/g, String(data.feeAmount));


        // Helper: Generic Metadata Replacer (if available)
        if (data && typeof data === 'object') {
            for (const [key, val] of Object.entries(data)) {
                if (typeof val === 'string' || typeof val === 'number') {
                    processed = processed.replace(new RegExp(`\\{{1,2}${key}\\}{1,2}`, 'gi'), String(val));
                }
            }
        }

        return processed;
    }
}

// Helpers for Drizzle operators that weren't imported
function ge(col: any, val: any) { return sql`${col} >= ${val}`; }
function le(col: any, val: any) { return sql`${col} <= ${val}`; }
