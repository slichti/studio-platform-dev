import twilio from 'twilio';
import { UsageService } from './pricing';

export class SmsService {
    private client: twilio.Twilio;
    private fromNumber: string;
    private db?: any;
    private tenantId?: string;

    constructor(accountSid: string, authToken: string, fromNumber: string, db?: any, tenantId?: string) {
        this.client = twilio(accountSid, authToken);
        this.fromNumber = fromNumber;
        this.db = db;
        this.tenantId = tenantId;
    }

    async sendSms(to: string, body: string) {
        if (this.db && this.tenantId) {
            const usageService = new UsageService(this.db, this.tenantId);
            const usage = await usageService.getUsage();
            // checkLimit expects 'smsUsage' keys, but logic in pricing.ts handles it by comparing to limits.sms
            const canSend = await usageService.checkLimit('smsUsage', usage.tier);

            if (!canSend) {
                console.warn(`[SMS Blocked] Tenant ${this.tenantId} reached SMS limit.`);
                return { success: false, error: 'SMS limit reached', code: 'LIMIT_REACHED' };
            }
        }

        try {
            await this.client.messages.create({
                body,
                from: this.fromNumber,
                to,
            });

            if (this.db && this.tenantId) {
                const usageService = new UsageService(this.db, this.tenantId);
                await usageService.incrementUsage('sms', 1);
            }

            console.log(`SMS sent to ${to}`);
            return { success: true };
        } catch (error: any) {
            console.error('Failed to send SMS:', error);
            // Don't throw, just log and return failure so we don't crash main flows
            return { success: false, error: error.message };
        }
    }
}
