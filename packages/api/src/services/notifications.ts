import { createDb } from '../db';
import { emailLogs, smsLogs, smsConfig, tenantFeatures, tenantMembers } from 'db/src/schema'; // Ensure sms exported
import { eq, and } from 'drizzle-orm';
import { Twilio } from 'twilio';

// Minimal Email Service stub from before, identifying needing update?
// We will unify notification usage here if possible.

export class NotificationService {
    db: any;
    tenantId: string;
    env: any;

    constructor(db: any, tenantId: string, env: any) {
        this.db = db;
        this.tenantId = tenantId;
        this.env = env;
    }

    async sendEmail(to: string, subject: string, html: string) {
        // ... (Existing logic or placeholder)
        // Log it
        await this.db.insert(emailLogs).values({
            id: crypto.randomUUID(),
            tenantId: this.tenantId,
            recipientEmail: to,
            subject,
            status: 'sent',
            sentAt: new Date()
        }).run();
    }

    async sendSMS(to: string, body: string, options: { eventType?: string, memberId?: string } = {}) {
        const { eventType = 'general', memberId } = options;
        if (!to) return;

        // 1. Check Tenant Feature Entitlement
        const feature = await this.db.select().from(tenantFeatures)
            .where(and(
                eq(tenantFeatures.tenantId, this.tenantId),
                eq(tenantFeatures.featureKey, 'sms')
            ))
            .get();

        if (!feature || !feature.enabled) {
            console.log(`[SMS Blocked] Tenant ${this.tenantId} does not have SMS enabled.`);
            return { success: false, status: 'blocked_feature' };
        }

        // 2. Check User Preference (Opt-in)
        if (memberId) {
            const member = await this.db.select().from(tenantMembers)
                .where(eq(tenantMembers.id, memberId))
                .get();

            // Default to FALSE for SMS (Strict Opt-in)
            const smsEnabled = member?.settings?.notifications?.sms === true;

            if (!smsEnabled) {
                console.log(`[SMS Blocked] Member ${memberId} has not opted in.`);
                return { success: false, status: 'blocked_preference' };
            }
        }

        // 3. Check Config (Provider)
        const config = await this.db.select().from(smsConfig).where(eq(smsConfig.tenantId, this.tenantId)).get();
        const provider = config?.provider || 'mock'; // Default to mock if config missing but feature enabled

        // 4. Send (Mock vs Twilio)
        let status = 'queued';

        if (provider === 'mock') {
            console.log(`[SMS MOCK] To: ${to} | Body: "${body}"`);
            status = 'sent';
        } else if (provider === 'twilio') {
            try {
                // Initialize Twilio using Env or Config if we allowed BYO
                // For MVP, using centralized Platform credentials from Env
                const accountSid = this.env?.TWILIO_ACCOUNT_SID;
                const authToken = this.env?.TWILIO_AUTH_TOKEN;
                const fromNumber = this.env?.TWILIO_FROM_NUMBER; // Or messaging service sid

                if (!accountSid || !authToken || !fromNumber) {
                    console.error('[SMS ERROR] Missing Twilio Credentials');
                    status = 'failed_config';
                } else {
                    const client = new Twilio(accountSid, authToken);
                    const message = await client.messages.create({
                        body,
                        from: fromNumber,
                        to
                    });

                    console.log(`[SMS TWILIO] Sent SID: ${message.sid}`);
                    status = 'sent'; // In reality 'queued' or 'sent'
                    // We could also store message.sid in metadata
                }
            } catch (error: any) {
                console.error('[SMS ERROR] Twilio failed:', error.message);
                status = 'failed';
            }
        }

        // 5. Log
        await this.db.insert(smsLogs).values({
            id: crypto.randomUUID(),
            tenantId: this.tenantId,
            recipientPhone: to,
            body,
            status: status as any,
            sentAt: new Date(),
            memberId: memberId || null,
            metadata: { eventType, provider }
        }).run();

        return { success: status === 'sent', status };
    }
}
