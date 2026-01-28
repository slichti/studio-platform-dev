import { pushLogs } from '@studio/db/src/schema';

export class PushService {
    private db: any;
    private tenantId: string;

    constructor(db: any, tenantId: string) {
        this.db = db;
        this.tenantId = tenantId;
    }

    /**
     * Send a push notification to one or more Expo Push Tokens
     */
    async sendPush(tokens: string | string[], title: string, body: string, data: any = {}) {
        const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
        const validTokens = tokenArray.filter(t => t && t.startsWith('ExponentPushToken'));

        if (validTokens.length === 0) {
            console.log('[PushService] No valid tokens provided');
            return { success: false, error: 'No valid tokens' };
        }

        const messages = validTokens.map(to => ({
            to,
            sound: 'default',
            title,
            body,
            data
        }));

        try {
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });

            const result: any = await response.json();

            // Expo returns { data: [ { status: "ok" }, { status: "error", message: "..." } ] }
            // We should log each attempt.

            const tickets = result.data || [];

            await Promise.all(validTokens.map(async (token, index) => {
                const ticket = tickets[index];
                const status = ticket?.status === 'ok' ? 'sent' : 'failed';
                const metadata = ticket?.status === 'error' ? { error: ticket.message, details: ticket.details } : { ticketId: ticket.id };

                // Log to DB
                try {
                    await this.db.insert(pushLogs).values({
                        id: crypto.randomUUID(),
                        tenantId: this.tenantId,
                        recipientToken: token,
                        title,
                        body,
                        status,
                        sentAt: new Date(),
                        metadata
                    }).run();
                } catch (dbError) {
                    console.error('[PushService] Failed to log push:', dbError);
                }
            }));

            return { success: true, tickets };

        } catch (error: any) {
            console.error('[PushService] Network error:', error);

            // Log failure for all tokens
            await Promise.all(validTokens.map(async (token) => {
                try {
                    await this.db.insert(pushLogs).values({
                        id: crypto.randomUUID(),
                        tenantId: this.tenantId,
                        recipientToken: token,
                        title,
                        body,
                        status: 'failed',
                        sentAt: new Date(),
                        metadata: { error: error.message }
                    }).run();
                } catch (e) {
                    // ignore
                }
            }));

            return { success: false, error: error.message };
        }
    }
}
