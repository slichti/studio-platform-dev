
import { EmailService } from './email';
import { LoggerService } from './logger';

export class MonitoringService {
    private emailService: EmailService;
    private platformEmail: string;

    constructor(env: any) {
        this.emailService = new EmailService(env.RESEND_API_KEY);
        this.platformEmail = env.PLATFORM_ADMIN_EMAIL || 'support@studio-platform.com';
    }

    async alert(subject: string, message: string, meta?: any) {
        console.error(`[MONITORING ALERT] ${subject}`, meta);

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
