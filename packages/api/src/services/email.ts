import { Resend } from 'resend';
import { UsageService } from './pricing';

export interface TenantEmailConfig {
    branding?: {
        emailReplyTo?: string;
        emailFooterText?: string;
        primaryColor?: string; // Could be used for styling
        logoUrl?: string; // Future use
    };
    settings?: {
        notifications?: {
            adminEmail?: string;
            enableBcc?: boolean;
            newStudentAlert?: boolean;
        };
    };
}

export class EmailService {
    private resend: Resend;
    private fromEmail: string;
    private config?: TenantEmailConfig;
    private usageService?: UsageService;
    private isByok: boolean = false;

    constructor(
        apiKey: string, // Platform Key OR Tenant Key
        config?: TenantEmailConfig,
        domainConfig?: { slug: string, customDomain?: string | null },
        usageService?: UsageService,
        isByok = false
    ) {
        this.resend = new Resend(apiKey);
        this.config = config;
        this.usageService = usageService;
        this.isByok = isByok;

        // Dynamic Sender Logic
        if (domainConfig?.customDomain) {
            this.fromEmail = `no-reply@${domainConfig.customDomain}`;
        } else if (domainConfig?.slug) {
            // Fallback to platform subdomain
            this.fromEmail = `no-reply@${domainConfig.slug}.studio-platform.com`;
        } else {
            // Default Fallback
            this.fromEmail = 'noreply@studio-platform.com'; // TODO: Update to real domain
        }
    }

    private getEmailOptions() {
        const headers: any = {};
        const options: any = {
            from: this.fromEmail,
        };

        if (this.config?.branding?.emailReplyTo) {
            options.reply_to = this.config.branding.emailReplyTo;
        }

        return options;
    }

    private async checkAndTrackUsage() {
        if (!this.usageService) return true;

        // Don't limit BYOK
        if (!this.isByok) {
            const canSend = await this.usageService.canSend('email');
            if (!canSend) {
                console.warn("Email blocked by usage limit");
                return false;
            }
        }
        return true;
    }

    private async incrementUsage() {
        if (this.usageService && !this.isByok) {
            await this.usageService.incrementUsage('email');
        }
    }

    private wrapHtml(content: string, title?: string): string {
        const footerText = this.config?.branding?.emailFooterText;
        const footerHtml = footerText
            ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; white-space: pre-wrap;">${footerText}</div>`
            : '';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; }
                    .button { display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="container">
                    ${content}
                    ${footerHtml}
                </div>
            </body>
            </html>
        `;
    }

    async sendInvitation(to: string, studioName: string, inviteUrl: string) {
        if (!await this.checkAndTrackUsage()) return;

        const htmlContent = `
            <h1>You've been invited to ${studioName}</h1>
            <p>Hello,</p>
            <p>You have been added as a member of <strong>${studioName}</strong>.</p>
            <p>Click the button below to access your account and view the schedule:</p>
            <a href="${inviteUrl}" class="button">Access Studio</a>
            <p style="font-size: 12px; color: #888; margin-top: 20px;">If the button doesn't work, verify that you are logged in with this email address.</p>
        `;

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject: `Invitation to ${studioName}`,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            console.log(`Invitation email sent to ${to} from ${this.fromEmail}`);
        } catch (e) {
            console.error("Failed to send invitation email", e);
        }
    }

    private getRecipients(to: string, type: 'transactional' | 'notification'): { to: string; bcc?: string } {
        const result: { to: string; bcc?: string } = { to };

        // Apply BCC logic for transactional emails (bookings, etc)
        if (type === 'transactional' &&
            this.config?.settings?.notifications?.enableBcc &&
            this.config?.settings?.notifications?.adminEmail) {
            result.bcc = this.config.settings.notifications.adminEmail;
        }

        return result;
    }

    async sendBookingConfirmation(to: string, classDetails: {
        title: string;
        startTime: Date;
        instructorName?: string;
        locationName?: string;
        zoomUrl?: string;
    }) {
        if (!await this.checkAndTrackUsage()) return;

        const date = new Date(classDetails.startTime).toLocaleString();

        const htmlContent = `
            <h1>Booking Confirmed!</h1>
            <p>You are booked for <strong>${classDetails.title}</strong>.</p>
            <p><strong>Time:</strong> ${date}</p>
            ${classDetails.instructorName ? `<p><strong>Instructor:</strong> ${classDetails.instructorName}</p>` : ''}
            ${classDetails.locationName ? `<p><strong>Location:</strong> ${classDetails.locationName}</p>` : ''}
            ${classDetails.zoomUrl ? `<p><strong>Zoom Link:</strong> <a href="${classDetails.zoomUrl}">Join Meeting</a></p>` : ''}
            <p>Can't wait to see you there!</p>
        `;

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject: `Booking Confirmed: ${classDetails.title}`,
                html: this.wrapHtml(htmlContent, "Booking Confirmed")
            });
            await this.incrementUsage();
            console.log(`Booking email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send booking email", e);
        }
    }

    async sendWaiverCopy(to: string, waiverTitle: string, pdfBuffer: ArrayBuffer) {
        if (!await this.checkAndTrackUsage()) return;
        try {
            const buffer = Buffer.from(pdfBuffer);
            // Waivers are transactional, but maybe don't BCC the PDF to admin? 
            // Often admins want a copy. Let's respect the BCC setting.
            const { bcc } = this.getRecipients(to, 'transactional');
            const options = this.getEmailOptions();

            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject: `Signed Copy: ${waiverTitle}`,
                html: this.wrapHtml(`<p>Attached is your signed copy of <strong>${waiverTitle}</strong>.</p>`),
                attachments: [
                    {
                        filename: `${waiverTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
                        content: buffer
                    }
                ]
            });
            await this.incrementUsage();
            console.log(`Waiver email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send waiver email", e);
        }
    }

    async sendWelcome(to: string, name: string) {
        if (!await this.checkAndTrackUsage()) return;

        const htmlContent = `
            <h1>Welcome, ${name}!</h1>
            <p>We are thrilled to have you join us.</p>
            <p>Explore classes, book your spot, and start your journey today.</p>
        `;

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject: `Welcome to Studio Platform!`,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            console.log(`Welcome email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send welcome email", e);
        }
    }


    async sendGenericEmail(to: string, subject: string, html: string, isNotification = false) {
        if (!await this.checkAndTrackUsage()) return;

        const { bcc } = this.getRecipients(to, isNotification ? 'notification' : 'transactional');
        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc, // Admin notifications usually don't need BCC, but if 'transactional', apply it.
                subject,
                html: this.wrapHtml(html)
            });
            await this.incrementUsage();
            console.log(`Generic email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send generic email", e);
            throw e;
        }
    }

    async notifyOwnerNewStudent(ownerEmail: string, studentName: string) {
        // Notification to Studio Owner. 
        // We override 'to' with the configured adminEmail if present, defaulting to the ownerEmail passed in.
        const targetEmail = this.config?.settings?.notifications?.adminEmail || ownerEmail;

        if (!this.config?.settings?.notifications?.newStudentAlert) {
            // Check if alerts explicitly disabled?
            // The caller might not have checked the setting before calling.
            // If settings are present and false, skip?
            // Existing logic didn't have this check.
            // If config is provided, we should probably respect it.
            if (this.config?.settings?.notifications?.newStudentAlert === false) return;
        }

        await this.sendGenericEmail(
            targetEmail,
            `New Student Registration: ${studentName}`,
            `<p>Good news! <strong>${studentName}</strong> has just registered for your studio.</p>`,
            true // isNotification
        );
    }

    async notifyStudentSignUpConfirmation(studentEmail: string, studioName: string) {
        await this.sendGenericEmail(
            studentEmail,
            `Welcome to ${studioName}`,
            `<h1>Welcome to ${studioName}!</h1><p>Your account has been successfully created. We look forward to seeing you in class.</p>`
        );
    }

    async notifyNoShow(studentEmail: string, feeAmount: number, className: string) {
        await this.sendGenericEmail(
            studentEmail,
            `Missed Class Policy: ${className}`,
            `
            <p>We missed you at <strong>${className}</strong> today.</p>
            <p>Per our cancellation policy, a no-show fee of <strong>$${(feeAmount / 100).toFixed(2)}</strong> has been processed.</p>
            <p>We hope to see you next time!</p>
            `
        );
    }
}
