import type { Twilio } from 'twilio';
import { UsageService } from './pricing';
import { smsLogs } from 'db/src/schema';

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

    async sendSms(to: string, body: string) {
        const client = await this.getClient();

        if (!client || !this.fromNumber) {
            await this.logSms(to, body, 'failed', { error: 'Configuration missing' });
            return { success: false, error: 'SMS configuration missing', code: 'CONFIG_MISSING' };
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
