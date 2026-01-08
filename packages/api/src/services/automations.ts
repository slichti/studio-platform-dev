import { createDb } from '../db';
import { eq, and, lt, gt, or, isNull, sql } from 'drizzle-orm';
import { marketingAutomations, automationLogs, subscriptions, tenantMembers, users, tenants, coupons, bookings, posOrders, classes, locations } from 'db'; // Added bookings, posOrders, locations
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
                case 'new_student':
                case 'subscription_created':
                    // Special Case: "Delayed" Welcome or Nudge triggers 
                    // (e.g. 7 days after sign up)
                    if (auto.timingType === 'delay') {
                        await this.processDelayedNudge(auto, now);
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

    private async processDelayedNudge(auto: any, now: Date) {
        // trigger: 'new_student' (Sign up)
        // timing: 'delay' 48 hours.
        // Look for TenantMembers joinedAt between [48h ago, 49h ago].

        const hoursDelay = auto.timingValue || 24;
        const targetTime = new Date(now.getTime() - (hoursDelay * 60 * 60 * 1000));
        const windowEnd = new Date(targetTime.getTime() + (1 * 60 * 60 * 1000)); // 1 hour window

        const members = await this.db.select()
            .from(tenantMembers)
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                ge(tenantMembers.joinedAt, targetTime), // >= 
                le(tenantMembers.joinedAt, windowEnd)   // <=
            )).all();

        for (const m of members) {
            const user = await this.db.query.users.findFirst({ where: eq(users.id, m.userId) });
            if (user) {
                await this.executeAutomation(auto, {
                    userId: user.id,
                    email: user.email,
                    firstName: (user.profile as any)?.firstName
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
            } else if (data?.[key] !== val) {
                return false;
            }
        }
        return true;
    }

    private async executeAutomation(automation: any, context: { userId: string, email?: string, firstName?: string, lastName?: string, data?: any }) {
        // 1. Idempotency Check
        const channel = automation.channels?.[0] || 'email'; // MVP Single Channel

        let timeWindow = 0; // Forever
        if (automation.triggerEvent === 'birthday') timeWindow = 300 * 24; // ~1 year
        if (automation.triggerEvent === 'absent') timeWindow = 14 * 24; // Don't spam absent nudges more than once per 2 weeks?

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
        const content = this.processTemplate(automation.content, extendedContext, couponCode);
        const subject = this.processTemplate(automation.subject, extendedContext, couponCode);

        try {
            if (channel === 'email' && context.email) {
                await this.emailService.sendGenericEmail(context.email, subject, content, true);
            }

            // 4. Log
            await this.db.insert(automationLogs).values({
                id: crypto.randomUUID(),
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
        let processed = text
            .replace(/{{first_name}}/g, context.firstName || 'Friend')
            .replace(/{{firstName}}/g, context.firstName || 'Friend') // Support both
            .replace(/{{last_name}}/g, context.lastName || '')
            .replace(/{{lastName}}/g, context.lastName || '')
            .replace(/{{email}}/g, context.email || '')
            .replace(/{{title}}/g, context.title || '')
            .replace(/{{studioName}}/g, context.title || '') // Alias
            .replace(/{{address}}/g, context.address || '');

        if (couponCode) {
            processed = processed.replace(/{{coupon_code}}/g, couponCode);
        }

        return processed;
    }
}

// Helpers for Drizzle operators that weren't imported
function ge(col: any, val: any) { return sql`${col} >= ${val}`; }
function le(col: any, val: any) { return sql`${col} <= ${val}`; }
