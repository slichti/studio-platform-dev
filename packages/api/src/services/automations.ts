import { createDb } from '../db';
import { eq, and, lt, gt, or, isNull } from 'drizzle-orm';
import { marketingAutomations, automationLogs, subscriptions, tenantMembers, users, tenants, coupons } from 'db/src/schema';
import { EmailService } from './email';
// import { SmsService } from './sms'; // Future
import { UsageService } from './pricing';

export class AutomationsService {
    private db: any;
    private tenantId: string;
    private emailService: EmailService;

    constructor(db: any, tenantId: string, emailService: EmailService) {
        this.db = db;
        this.tenantId = tenantId;
        this.emailService = emailService;
    }

    // Main entry point for Cron
    async processTrialAutomations() {
        // 1. Get enabled automations for this tenant
        const automations = await this.db.select().from(marketingAutomations)
            .where(and(
                eq(marketingAutomations.tenantId, this.tenantId),
                eq(marketingAutomations.isEnabled, true)
            )).all();

        if (automations.length === 0) return;

        // 2. Get active trialing subscriptions
        // "Trialing" status in subscriptions OR status='active' and within trial period (currentPeriodEnd > now)
        // Let's treat 'trialing' status as the source of truth if Stripe syncing matches.
        // Assuming subscription tables are accurate.
        const now = new Date();
        const activeTrials = await this.db.select({
            userId: subscriptions.userId,
            memberId: subscriptions.memberId,
            startDate: subscriptions.createdAt, // Approximating trial start from sub creation
            email: users.email,
            firstName: sql`json_extract(${users.profile}, '$.firstName')`,
            phone: users.phone
        })
            .from(subscriptions)
            .innerJoin(users, eq(subscriptions.userId, users.id))
            .where(and(
                eq(subscriptions.tenantId, this.tenantId),
                or(
                    eq(subscriptions.status, 'trialing'),
                    // Also check basic tier if it's treated as a "trial" in some logic? 
                    // No, stick to explicit status or a "free_trial" flag if we had one.
                )
            ))
            .all();

        for (const trial of activeTrials) {
            const trialStart = new Date(trial.startDate);
            const hoursSinceStart = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60);

            for (const auto of automations) {
                // Check if this automation applies to trials
                // We might have triggers: 'trial_started' (immediate), 'trial_nudge' (delayed), 'trial_ending' (delayed)
                // But current schema has 'new_student' -> immediate welcome?
                // Let's support mapping generic types to trial logic or utilize the delay.

                // Logic:
                // If trigger="new_student" AND delay is matched.
                // Match = hoursSinceStart >= delayHours.
                // AND hoursSinceStart < delayHours + 24 (window to send, avoid sending 1 year later)

                // Map old enum types to flow:
                // 'new_student' -> 0 delay (Welcome)
                // We need to interpret the intended trigger. 
                // For now, let's assume ALL enabled automations are evaluated against the user if the trigger matches context.

                let shouldRun = false;

                if (auto.triggerType === 'new_student') {
                    // Evaluate delay
                    const delay = auto.delayHours || 0;
                    if (hoursSinceStart >= delay && hoursSinceStart < (delay + 48)) { // 48h buffer
                        shouldRun = true;
                    }
                }

                if (shouldRun) {
                    await this.executeAutomation(auto, trial);
                }
            }
        }
    }

    private async executeAutomation(automation: any, user: any) {
        // 1. Check idempotency (Logs)
        // Check for ANY execution of this automation for this user (regardless of channel for now, or per channel?)
        // Schema constraint is unique per (automationId, userId, channel).

        const channels = automation.channels || ['email'];

        for (const channel of channels) {
            const existingLog = await this.db.select().from(automationLogs)
                .where(and(
                    eq(automationLogs.automationId, automation.id),
                    eq(automationLogs.userId, user.userId),
                    eq(automationLogs.channel, channel)
                )).get();

            if (existingLog) continue; // Already sent

            // 2. Coupon Generation
            let couponCode = null;
            if (automation.couponConfig) {
                // Generate a unique code
                // Format: WELCOME-{USER_SHORT}-{RAND}
                const prefix = automation.couponConfig.prefix || 'TRIAL';
                const userPart = user.firstName ? user.firstName.substring(0, 3).toUpperCase() : 'MEM';
                const rand = Math.floor(1000 + Math.random() * 9000);
                couponCode = `${prefix}-${userPart}-${rand}`;

                // Create coupon in DB
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
                    continue; // Abort send if coupon fails? or send without? Abort safer.
                }
            }

            // 3. Send Message
            const content = this.processTemplate(automation.content, user, couponCode);
            const subject = this.processTemplate(automation.subject, user, couponCode);

            try {
                if (channel === 'email' && user.email) {
                    await this.emailService.sendGenericEmail(user.email, subject, content, true);
                }
                // else if (channel === 'sms') ...

                // 4. Log Success
                await this.db.insert(automationLogs).values({
                    id: crypto.randomUUID(),
                    tenantId: this.tenantId,
                    automationId: automation.id,
                    userId: user.userId,
                    channel: channel,
                    metadata: { couponCode }
                }).run();

            } catch (e) {
                console.error(`Failed to send automation ${automation.id} to ${user.email}`, e);
            }
        }
    }

    private processTemplate(text: string, user: any, couponCode: string | null) {
        let processed = text
            .replace(/{{first_name}}/g, user.firstName || 'Friend')
            .replace(/{{email}}/g, user.email || '');

        if (couponCode) {
            processed = processed.replace(/{{coupon_code}}/g, couponCode);
        }

        return processed;
    }
}

import { sql } from 'drizzle-orm';
