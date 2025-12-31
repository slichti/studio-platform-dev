import { Resend } from 'resend';

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
    private fromEmail = 'noreply@studio-platform.com';
    private config?: TenantEmailConfig;

    constructor(apiKey: string, config?: TenantEmailConfig) {
        this.resend = new Resend(apiKey);
        this.config = config;
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
            console.log(`Booking email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send booking email", e);
        }
    }

    async sendWaiverCopy(to: string, waiverTitle: string, pdfBuffer: ArrayBuffer) {
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
            console.log(`Waiver email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send waiver email", e);
        }
    }

    async sendWelcome(to: string, name: string) {
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
            console.log(`Welcome email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send welcome email", e);
        }
    }


    async sendGenericEmail(to: string, subject: string, html: string, isNotification = false) {
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
