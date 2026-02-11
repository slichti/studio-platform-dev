
import { EmailService } from './email';
import { LoggerService } from './logger';

export class MonitoringService {
    private emailService: EmailService;
    private platformEmail: string;
    private slackWebhookUrl: string | undefined;

    constructor(env: any) {
        this.emailService = new EmailService(env.RESEND_API_KEY);
        this.platformEmail = env.PLATFORM_ADMIN_EMAIL || 'support@studio-platform.com';
        this.slackWebhookUrl = env.SLACK_WEBHOOK_URL;
    }

    async alert(subject: string, message: string, meta?: any) {
        console.error(`[MONITORING ALERT] ${subject}`, meta);

        // 1. Email Alert
        try {
            await this.emailService.sendGenericEmail(
                this.platformEmail,
                `🚨 ALERT: ${subject}`,
                `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #dc2626;">System Alert</h2>
                    <p><strong>Message:</strong> ${message}</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    ${meta ? `<pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(meta, null, 2)}</pre>` : ''}
                </div>
                `,
                true // Is notification
            );
        } catch (e) {
            console.error("Failed to send monitoring alert email", e);
        }

        // 2. Slack Alert
        if (this.slackWebhookUrl) {
            try {
                await this.sendSlackAlert(subject, message, meta);
            } catch (e) {
                console.error("Failed to send Slack alert", e);
            }
        }
    }

    private async sendSlackAlert(subject: string, message: string, meta?: any) {
        const payload = {
            text: `🚨 *System Alert: ${subject}*`,
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `🚨 *System Alert: ${subject}*\n${message}`
                    }
                },
                {
                    type: "section",
                    fields: [
                        { type: "mrkdwn", text: `*Time:*\n${new Date().toISOString()}` },
                        { type: "mrkdwn", text: `*Environment:*\nProduction` } // Hardcoded for now or fetch from env
                    ]
                }
            ]
        };

        if (meta) {
            payload.blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Metadata:*\n\`\`\`${JSON.stringify(meta, null, 2)}\`\`\``
                }
            });
        }

        const res = await fetch(this.slackWebhookUrl!, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) throw new Error(`Slack API error: ${res.statusText}`);
    }

    async captureException(error: Error, context?: string) {
        await this.alert(
            `Exception: ${error.message}`,
            `An unhandled exception occurred${context ? ` in ${context}` : ''}.`,
            {
                name: error.name,
                stack: error.stack,
                context
            }
        );
    }
}
