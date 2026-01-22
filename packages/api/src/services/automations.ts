import { createDb } from '../db';
import { eq, and, lt, gt, gte, lte, or, isNull, sql } from 'drizzle-orm';
import { marketingAutomations, automationLogs, subscriptions, tenantMembers, users, tenants, coupons, bookings, posOrders, classes, locations } from 'db/src/schema'; // Added bookings, posOrders, locations
import { EmailService } from './email';
import { SmsService } from './sms'; // Active
import { UsageService } from './pricing';

export class AutomationsService {
    private db: any;
    private tenantId: string;
    private emailService: EmailService;
    private smsService: SmsService | undefined;

    constructor(db: any, tenantId: string, emailService: EmailService, smsService?: SmsService) {
        this.db = db;
        this.tenantId = tenantId;
        this.emailService = emailService;
        this.smsService = smsService;
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

        for (const m of members) {
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
        // Trigger: Absent X Days.
        // We look for members whose `lastActiveAt` (on User? or need Member stats?)
        // `users.lastActiveAt` is platform wide. 
        // We really need `tenantMembers.last_visit`. 
        // Let's rely on Booking History. Find latest `checkedInAt`.

        // This is expensive to query raw bookings every time.
        // Optimized: We should have `lastVisitDate` on `tenantMembers` or query `bookings` with MAX().
        // For MVP, we'll try a subquery or join.

        const daysThreshold = auto.timingValue || 30; // Default 30 days
        const cutoffDate = new Date(now.getTime() - (daysThreshold * 24 * 60 * 60 * 1000));

        // Find members who HAVE attended before, but NOT after cutoffDate.
        // AND have not cancelled?

        // 1. Find members active
        const candidates = await this.db.select({
            memberId: tenantMembers.id,
            userId: users.id,
            email: users.email,
            profile: users.profile
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantMembers.status, 'active')
            )).all();

        for (const c of candidates) {
            // Get Last Check-in
            const lastBooking = await this.db.query.bookings.findFirst({
                where: and(
                    eq(bookings.memberId, c.memberId),
                    eq(bookings.status, 'confirmed') // or 'checked_in' if we track that religiously
                ),
                orderBy: (bookings: any, { desc }: any) => [desc(bookings.checkedInAt || bookings.classId)], // fallback
            });

            // If checkedInAt exists
            if (lastBooking && lastBooking.checkedInAt) {
                const lastDate = new Date(lastBooking.checkedInAt);
                if (lastDate < cutoffDate) {
                    // Check range? (e.g. between 30 and 31 days to avoid spamming every hour?)
                    // We rely on AutomationLog idempotency for "Once per X period"?
                    // Or just check if we sent it recently.

                    // Optimization: Check idempotency FIRST to avoid unnecessary work?
                    // But we already did the specific check.

                    await this.executeAutomation(auto, {
                        userId: c.userId,
                        email: c.email,
                        firstName: (c.profile as any)?.firstName
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
            )).all();

        for (const sub of activeSubs) {
            if (!sub.currentPeriodEnd) continue;
            const end = new Date(sub.currentPeriodEnd);

            // If end is within the next hour of our target? 
            // Broad Check: end > now AND end < targetWindowStart + 1 hour? 
            // We want to trigger when we are EXACTLY X hours before.
            // Let's use a window of [X, X+1] hours before.
            const diffHours = (end.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (diffHours >= hoursBuffer && diffHours < (hoursBuffer + 1)) {
                // Fetch User
                const user = await this.db.query.users.findFirst({ where: eq(users.id, sub.userId) });
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

            for (const m of members) {
                const user = await this.db.query.users.findFirst({ where: eq(users.id, m.userId) });
                if (user) candidates.push({ userId: user.id, email: user.email, firstName: (user.profile as any)?.firstName });
            }

        } else if (auto.triggerEvent === 'subscription_created') {
            const subs = await this.db.select()
                .from(subscriptions)
                .where(and(
                    eq(subscriptions.tenantId, this.tenantId),
                    gte(subscriptions.createdAt, windowStart),
                    lte(subscriptions.createdAt, targetTime)
                )).all();

            for (const s of subs) {
                const user = await this.db.query.users.findFirst({ where: eq(users.id, s.userId) });
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
            const newBookings = await this.db.select()
                .from(bookings)
                .where(and(
                    eq(bookings.status, 'confirmed'),
                    gte(bookings.createdAt, windowStart),
                    lte(bookings.createdAt, targetTime)
                )).all();

            for (const b of newBookings) {
                const cls = await this.db.query.classes.findFirst({
                    where: and(eq(classes.id, b.classId), eq(classes.tenantId, this.tenantId)),
                    with: { series: true }
                });
                if (!cls) continue;

                const member = await this.db.query.tenantMembers.findFirst({
                    where: eq(tenantMembers.id, b.memberId),
                    with: { user: true }
                });
                if (!member || !member.user) continue;

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
        for (const c of candidates) {
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
                )).all();

            for (const cls of upcomingClasses) {
                // Get participants
                const participants = await this.db.select().from(bookings)
                    .where(and(
                        eq(bookings.classId, cls.id),
                        eq(bookings.status, 'confirmed')
                    )).all();

                for (const b of participants) {
                    const member = await this.db.query.tenantMembers.findFirst({
                        where: eq(tenantMembers.id, b.memberId),
                        with: { user: true }
                    });
                    if (!member || !member.user) continue;

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
                    eq(automationLogs.userId, context.userId),
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

        // Fetch Tenant Details (Title, Address)
        const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, this.tenantId) });
        // Fetch First Location for Address
        const location = await this.db.query.locations.findFirst({ where: eq(locations.tenantId, this.tenantId) });

        const extendedContext = {
            ...context,
            title: tenant?.name || 'Studio',
            address: location?.address || ''
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

        // 3. Send
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

            // 4. Log
            await this.db.insert(automationLogs).values({
                id: logId,
                tenantId: this.tenantId,
                automationId: automation.id,
                userId: context.userId,
                channel: channel,
                metadata: { couponCode }
            }).run();

        } catch (e) {
            console.error(`Automation Failed ${automation.id}`, e);
        }
    }

    private processTemplate(text: string, context: any, couponCode: string | null) {
        // Core Variables
        let processed = text
            .replace(/{{first_name}}/g, context.firstName || 'Friend')
            .replace(/{{firstName}}/g, context.firstName || 'Friend') // Support both
            .replace(/{{last_name}}/g, context.lastName || '')
            .replace(/{{lastName}}/g, context.lastName || '')
            .replace(/{{email}}/g, context.email || '')
            .replace(/{{title}}/g, context.title || '')
            .replace(/{{studioName}}/g, context.title || '') // Alias
            .replace(/{{address}}/g, context.address || '');

        // Coupon
        if (couponCode) {
            processed = processed.replace(/{{coupon_code}}/g, couponCode);
        }

        // Context Data Variables (Deep check in context.data)
        const data = context.data || {};

        // Class/Booking specific
        if (data.classTitle) processed = processed.replace(/{{classTitle}}/g, data.classTitle);
        if (data.startTime) {
            const date = new Date(data.startTime);
            processed = processed.replace(/{{classDate}}/g, date.toLocaleDateString());
            processed = processed.replace(/{{classTime}}/g, date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        if (data.feeAmount) processed = processed.replace(/{{feeAmount}}/g, String(data.feeAmount));

        return processed;
    }
}

// Helpers for Drizzle operators that weren't imported
function ge(col: any, val: any) { return sql`${col} >= ${val}`; }
function le(col: any, val: any) { return sql`${col} <= ${val}`; }
