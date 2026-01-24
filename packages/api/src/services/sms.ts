import type { Twilio } from 'twilio';
import { UsageService } from './pricing';
import { smsLogs } from '@studio/db/src/schema';

interface TwilioCredentials {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}

export class SmsService {
    private client: Twilio | null = null;
    private fromNumber: string | null = null;
    private usageService?: UsageService;
    private isByok: boolean = false;
    private db: any;
    private tenantId: string;

    // Stored config for lazy init
    private credentials?: TwilioCredentials;
    private env?: any;

    constructor(
        credentials: TwilioCredentials | undefined,
        env: any,
        usageService: UsageService | undefined,
        db: any,
        tenantId: string
    ) {
        this.db = db;
        this.tenantId = tenantId;
        this.usageService = usageService;
        this.credentials = credentials;
        this.env = env;
    }

    private async getClient(): Promise<Twilio | null> {
        if (this.client) return this.client;

        try {
            // Dynamic import to avoid node:os in Workers startup
            const { Twilio } = await import('twilio');

            // 1. Try Tenant Credentials (BYOK)
            if (this.credentials?.accountSid && this.credentials?.authToken && this.credentials?.fromNumber) {
                this.client = new Twilio(this.credentials.accountSid, this.credentials.authToken);
                this.fromNumber = this.credentials.fromNumber;
                this.isByok = true;
            }
            // 2. Fallback to Platform Credentials
            else if (this.env?.TWILIO_ACCOUNT_SID && this.env?.TWILIO_AUTH_TOKEN && this.env?.TWILIO_FROM_NUMBER) {
                this.client = new Twilio(this.env.TWILIO_ACCOUNT_SID, this.env.TWILIO_AUTH_TOKEN);
                this.fromNumber = this.env.TWILIO_FROM_NUMBER;
                this.isByok = false;
            } else {
                // Warning only once? Or on every send attempt (which calls getClient)
                // We'll warn in sendSms if getClient returns null
            }
        } catch (e) {
            console.error("Failed to load Twilio SDK", e);
        }

        return this.client;
    }

    /**
     * Send SMS with TCPA compliance checks
     * @param to - Recipient phone number
     * @param body - Message body
     * @param memberId - Optional member ID for consent checking
     * @param skipConsentCheck - Skip consent for transactional messages (booking confirmations, etc.)
     */
    async sendSms(to: string, body: string, memberId?: string, skipConsentCheck = false) {
        const client = await this.getClient();

        if (!client || !this.fromNumber) {
            await this.logSms(to, body, 'failed', { error: 'Configuration missing' });
            return { success: false, error: 'SMS configuration missing', code: 'CONFIG_MISSING' };
        }

        // TCPA: Check consent if memberId is provided (for marketing messages)
        if (!skipConsentCheck && memberId && this.db) {
            const { tenantMembers } = await import('@studio/db/src/schema');
            const { eq } = await import('drizzle-orm');

            const member = await this.db.select({
                smsConsent: tenantMembers.smsConsent,
                smsOptOutAt: tenantMembers.smsOptOutAt
            }).from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();

            if (!member?.smsConsent) {
                console.warn(`[SMS Blocked] No SMS consent for member ${memberId}`);
                await this.logSms(to, body, 'failed', { error: 'No SMS consent', memberId });
                return { success: false, error: 'No SMS consent on file', code: 'NO_CONSENT' };
            }

            if (member.smsOptOutAt) {
                console.warn(`[SMS Blocked] Member ${memberId} has opted out`);
                await this.logSms(to, body, 'failed', { error: 'Member opted out', memberId });
                return { success: false, error: 'Recipient has opted out of SMS', code: 'OPTED_OUT' };
            }
        }

        // TCPA: Time restriction check (8am-9pm in estimated recipient timezone)
        // Note: Full timezone detection would require phone number geocoding
        // For now, we use a conservative US-based check
        const now = new Date();
        const hourUTC = now.getUTCHours();
        // Assume EST/EDT (-5/-4 hours from UTC) as conservative default for US
        const hourEST = (hourUTC - 5 + 24) % 24;
        if (hourEST < 8 || hourEST >= 21) {
            console.warn(`[SMS Deferred] Outside TCPA hours (${hourEST}:00 EST)`);
            await this.logSms(to, body, 'failed', { error: 'Outside TCPA hours', hourEST });
            return { success: false, error: 'SMS sending restricted to 8am-9pm', code: 'TIME_RESTRICTED' };
        }

        // Check Limits (Skip if BYOK)
        if (!this.isByok && this.usageService) {
            const canSend = await this.usageService.canSend('sms');
            if (!canSend) {
                console.warn(`[SMS Blocked] SMS limit reached or blocked.`);
                await this.logSms(to, body, 'failed', { error: 'Limit reached' });
                return { success: false, error: 'SMS limit reached', code: 'LIMIT_REACHED' };
            }
        }

        try {
            const message = await client.messages.create({
                body: body,
                from: this.fromNumber,
                to: to
            });
            console.log(`SMS sent to ${to}: ${message.sid}`);

            if (!this.isByok && this.usageService) {
                await this.usageService.incrementUsage('sms', 1);
            }

            await this.logSms(to, body, 'sent', { sid: message.sid });

            return { success: true, sid: message.sid };
        } catch (error: any) {
            console.error("SmsService: Failed to send SMS", error);
            await this.logSms(to, body, 'failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle incoming SMS opt-out (STOP keyword)
     * Call this from the Twilio webhook handler
     */
    async handleOptOut(phone: string): Promise<{ success: boolean; membersUpdated: number }> {
        if (!this.db) return { success: false, membersUpdated: 0 };

        try {
            const { tenantMembers, users } = await import('@studio/db/src/schema');
            const { eq, and, sql } = await import('drizzle-orm');

            // Find user by phone number
            const user = await this.db.select({ id: users.id })
                .from(users)
                .where(sql`json_extract(${users.profile}, '$.phoneNumber') = ${phone}`)
                .get();

            if (!user) {
                console.log(`[SMS Opt-Out] No user found for phone ${phone}`);
                return { success: true, membersUpdated: 0 };
            }

            // Update all tenant memberships for this user
            const result = await this.db.update(tenantMembers)
                .set({
                    smsConsent: false,
                    smsOptOutAt: new Date()
                })
                .where(eq(tenantMembers.userId, user.id))
                .run();

            console.log(`[SMS Opt-Out] Updated ${result.changes || 0} memberships for user ${user.id}`);
            return { success: true, membersUpdated: result.changes || 0 };
        } catch (e: any) {
            console.error('[SMS Opt-Out] Failed:', e);
            return { success: false, membersUpdated: 0 };
        }
    }

    private async logSms(to: string, body: string, status: 'queued' | 'sent' | 'delivered' | 'failed', metadata: any = {}) {
        if (!this.db || !this.tenantId) return;
        try {
            await this.db.insert(smsLogs).values({
                id: crypto.randomUUID(),
                tenantId: this.tenantId,
                recipientPhone: to,
                body,
                status,
                metadata,
                sentAt: new Date()
            }).run();
        } catch (e) {
            console.error("Failed to log SMS", e);
        }
    }
}
