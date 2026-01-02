import twilio from 'twilio';

export class SmsService {
    private client: twilio.Twilio;
    private fromNumber: string;

    constructor(accountSid: string, authToken: string, fromNumber: string) {
        this.client = twilio(accountSid, authToken);
        this.fromNumber = fromNumber;
    }

    async sendSms(to: string, body: string) {
        try {
            await this.client.messages.create({
                body,
                from: this.fromNumber,
                to,
            });
            console.log(`SMS sent to ${to}`);
            return { success: true };
        } catch (error: any) {
            console.error('Failed to send SMS:', error);
            // Don't throw, just log and return failure so we don't crash main flows?
            // Or throw if critical? Usually notifications are best-effort.
            return { success: false, error: error.message };
        }
    }
}
