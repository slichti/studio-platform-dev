import { Twilio } from 'twilio';
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

    constructor(
        credentials: TwilioCredentials | undefined,
        env: any,
        usageService: UsageService | undefined,
        db: any,
        tenantId: string
    ) {
        this.db = db;
        this.tenantId = tenantId;

        // 1. Try Tenant Credentials (BYOK)
        if (credentials?.accountSid && credentials?.authToken && credentials?.fromNumber) {
            this.client = new Twilio(credentials.accountSid, credentials.authToken);
            this.fromNumber = credentials.fromNumber;
            this.isByok = true;
        }
        // 2. Fallback to Platform Credentials
        else if (env?.TWILIO_ACCOUNT_SID && env?.TWILIO_AUTH_TOKEN && env?.TWILIO_FROM_NUMBER) {
            this.client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
            this.fromNumber = env.TWILIO_FROM_NUMBER;
            this.isByok = false;
        } else {
            console.warn("SmsService: No valid Twilio credentials found.");
        }

        this.usageService = usageService;
    }

    async sendSms(to: string, body: string) {
        if (!this.client || !this.fromNumber) {
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
            const message = await this.client.messages.create({
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
