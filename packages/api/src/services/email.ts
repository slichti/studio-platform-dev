import { Resend } from 'resend';
import { UsageService } from './pricing';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@studio/db';
import { emailLogs } from '@studio/db';
import { eq } from 'drizzle-orm';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';


export interface TenantEmailConfig {
    branding?: {
        emailReplyTo?: string;
        emailFooterText?: string;
        primaryColor?: string; // Could be used for styling
        logoUrl?: string; // Future use
        physicalAddress?: string; // CAN-SPAM: Required physical mailing address
    };
    settings?: {
        notifications?: {
            adminEmail?: string;
            enableBcc?: boolean;
            newStudentAlert?: boolean;
        };
        unsubscribeUrl?: string; // CAN-SPAM: URL for email preferences
    };
}

export class EmailService {
    private resend: Resend;
    private fromEmail: string;
    private config?: TenantEmailConfig;
    private usageService?: UsageService;
    private isByok: boolean = false;
    private db?: DrizzleD1Database<typeof schema>;
    private tenantId?: string;

    constructor(
        apiKey: string, // Platform Key OR Tenant Key
        config?: TenantEmailConfig,
        domainConfig?: { slug: string, customDomain?: string | null },
        usageService?: UsageService,
        isByok = false,
        db?: DrizzleD1Database<typeof schema>,
        tenantId?: string
    ) {
        this.resend = new Resend(apiKey);
        this.config = config;
        this.usageService = usageService;
        this.isByok = isByok;
        this.db = db;
        this.tenantId = tenantId;

        // Dynamic Sender Logic
        if (domainConfig?.customDomain) {
            this.fromEmail = `no-reply@${domainConfig.customDomain}`;
        } else if (domainConfig?.slug) {
            // Fallback to platform subdomain
            this.fromEmail = `no-reply@${domainConfig.slug}.studio-platform.com`;
        } else {
            // Default Fallback
            // Use configurable env var if available, else standard fallback
            const platformDomain = (domainConfig as any)?.platformDomain || 'studio-platform.com';
            this.fromEmail = `noreply@${platformDomain}`;
        }
    }

    private getEmailOptions() {
        const headers: Record<string, string> = {};
        const options: any = {
            from: this.fromEmail,
        };

        if (this.config?.branding?.emailReplyTo) {
            options.reply_to = this.config.branding.emailReplyTo;
        }

        // CAN-SPAM: Add List-Unsubscribe header if unsubscribe URL is configured
        if (this.config?.settings?.unsubscribeUrl) {
            headers['List-Unsubscribe'] = `<${this.config.settings.unsubscribeUrl}>`;
            headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
            options.headers = headers;
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


    /**
     * Retry an email from a log entry
     */
    async retryEmail(logId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.db) return { success: false, error: "Database not available" };

        const log = await this.db.select().from(emailLogs).where(eq(emailLogs.id, logId)).get();
        if (!log) return { success: false, error: "Log entry not found" };

        if (!log.data) return { success: false, error: "No payload data available for replay" };

        const payload = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
        const { templateId, args } = payload; // Assuming log.data stores { templateId, args }

        try {
            switch (templateId) {
                case 'invitation':
                    // Assuming args: { studioName: string, inviteUrl: string }
                    await this.sendInvitation(log.recipientEmail, args.studioName, args.inviteUrl);
                    break;
                case 'booking_confirmation':
                    // Assuming args: { title: string, startTime: Date, instructorName?: string, locationName?: string, zoomUrl?: string, bookedBy?: string }
                    await this.sendBookingConfirmation(log.recipientEmail, args);
                    break;
                case 'waiver_copy':
                    // Assuming args: { waiverTitle: string, pdfBuffer: ArrayBuffer }
                    // Note: pdfBuffer cannot be stored directly in JSON, this case might need special handling or re-fetching the PDF.
                    // For now, this will likely fail if pdfBuffer is not available or correctly reconstructed.
                    // A more robust solution would be to store a reference to the PDF.
                    if (!args.pdfBuffer) {
                        return { success: false, error: "PDF buffer not available for waiver retry" };
                    }
                    await this.sendWaiverCopy(log.recipientEmail, args.waiverTitle, args.pdfBuffer);
                    break;
                case 'welcome_member': // Renamed from 'welcome' in the original snippet to match existing method
                    // Assuming args: { name: string }
                    await this.sendWelcome(log.recipientEmail, args.name);
                    break;
                // Add other cases as needed, ensuring the 'args' match the method signatures
                /*
                case 'receipt':
                    await this.sendReceipt(log.recipientEmail, args.memberName, args.amount, args.currency, args.date, args.items, args.receiptUrl);
                    break;
                case 'generic':
                    await this.sendGenericEmail(log.recipientEmail, log.subject, args.html, args.isNotification);
                    break;
                case 'welcome_owner':
                    await this.sendWelcomeOwner(log.recipientEmail, args.name, args.studioName, args.loginLink);
                    break;
                case 'new_tenant_alert':
                    await this.sendNewTenantAlert(args.email, args.name, args.tenantName, args.plan);
                    break;
                case 'subscription_update_owner':
                    await this.sendSubscriptionUpdateOwner(log.recipientEmail, args.tenantName, args.plan, args.amount, args.nextBillingDate);
                    break;
                case 'tenant_upgrade_alert':
                    await this.sendTenantUpgradeAlert(args.tenantName, args.oldPlan, args.newPlan);
                    break;
                */
                default:
                    return { success: false, error: `Unknown or unsupported template ID for retry: ${templateId}` };
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    private async logEmail(to: string, subject: string, templateId: string, data: any, status: 'sent' | 'failed', error?: string) {
        if (!this.db || !this.tenantId) return;

        try {
            await this.db.insert(emailLogs).values({
                id: uuidv4(),
                tenantId: this.tenantId,
                recipientEmail: to,
                subject,
                templateId,
                data: JSON.stringify(data),
                status,
                error,
            });
        } catch (e) {
            console.error('Failed to log email:', e);
        }
    }

    private wrapHtml(content: string, title?: string): string {
        // If already full HTML, don't wrap
        if (content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html')) {
            return content;
        }

        const footerText = this.config?.branding?.emailFooterText;
        const physicalAddress = this.config?.branding?.physicalAddress;
        const unsubscribeUrl = this.config?.settings?.unsubscribeUrl;

        // Build CAN-SPAM compliant footer
        let footerHtml = '';

        if (footerText || physicalAddress || unsubscribeUrl) {
            footerHtml = `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666;">`;

            if (footerText) {
                footerHtml += `<div style="white-space: pre-wrap; margin-bottom: 10px;">${footerText}</div>`;
            }

            // CAN-SPAM: Physical address (required)
            if (physicalAddress) {
                footerHtml += `<div style="margin-bottom: 10px;">${physicalAddress}</div>`;
            }

            // CAN-SPAM: Unsubscribe link (required for marketing emails)
            if (unsubscribeUrl) {
                footerHtml += `<div><a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Unsubscribe or manage email preferences</a></div>`;
            }

            footerHtml += `</div>`;
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; }
                    .button { display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px; }
                    img { max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; }
                    a { color: #2563eb; text-decoration: underline; }
                    h1, h2, h3 { color: #111; margin-top: 24px; margin-bottom: 16px; }
                    p { margin-bottom: 16px; }
                    blockquote { border-left: 4px solid #e5e7eb; padding-left: 16px; color: #4b5563; font-style: italic; }
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
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, `Invitation to ${studioName}`, 'invitation', { studioName, inviteUrl }, 'failed', 'Usage limit reached');
            return;
        }

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
        const subject = `Invitation to ${studioName}`;

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'invitation', { studioName, inviteUrl }, 'sent');
            console.log(`Invitation email sent to ${to} from ${this.fromEmail}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'invitation', { studioName, inviteUrl }, 'failed', e.message);
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
        bookedBy?: string;
    }) {
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, `Booking Confirmed: ${classDetails.title}`, 'booking_confirmation', classDetails, 'failed', 'Usage limit reached');
            return;
        }

        const date = new Date(classDetails.startTime).toLocaleString();

        const htmlContent = `
            <h1>Booking Confirmed!</h1>
            <p>You are booked for <strong>${classDetails.title}</strong>.</p>
            <p><strong>Time:</strong> ${date}</p>
            ${classDetails.instructorName ? `<p><strong>Instructor:</strong> ${classDetails.instructorName}</p>` : ''}
            ${classDetails.locationName ? `<p><strong>Location:</strong> ${classDetails.locationName}</p>` : ''}
            ${classDetails.zoomUrl ? `<p><strong>Zoom Link:</strong> <a href="${classDetails.zoomUrl}">Join Meeting</a></p>` : ''}
            ${classDetails.bookedBy ? `<p style="font-size: 12px; color: #666; margin-top: 10px;">Booked by ${classDetails.bookedBy}</p>` : ''}
            <p>Can't wait to see you there!</p>
        `;

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();
        const subject = `Booking Confirmed: ${classDetails.title}`;

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject,
                html: this.wrapHtml(htmlContent, "Booking Confirmed")
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'booking_confirmation', classDetails, 'sent');
            console.log(`Booking email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'booking_confirmation', classDetails, 'failed', e.message);
            console.error("Failed to send booking email", e);
        }
    }

    async sendWaiverCopy(to: string, waiverTitle: string, pdfBuffer: ArrayBuffer) {
        const subject = `Signed Copy: ${waiverTitle}`;
        // Can't easily serialize pdfBuffer for logging, so we skip it in 'data' or send metadataStr
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'waiver_copy', { waiverTitle }, 'failed', 'Usage limit reached');
            return;
        }
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
                subject,
                html: this.wrapHtml(`<p>Attached is your signed copy of <strong>${waiverTitle}</strong>.</p>`),
                attachments: [
                    {
                        filename: `${waiverTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
                        content: buffer
                    }
                ]
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'waiver_copy', { waiverTitle }, 'sent');
            console.log(`Waiver email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'waiver_copy', { waiverTitle }, 'failed', e.message);
            console.error("Failed to send waiver email", e);
        }
    }

    async sendWelcome(to: string, name: string) {
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, 'Welcome to Studio Platform!', 'welcome_member', { name }, 'failed', 'Usage limit reached');
            return;
        }

        const htmlContent = `
            <h1>Welcome, ${name}!</h1>
            <p>We are thrilled to have you join us.</p>
            <p>Explore classes, book your spot, and start your journey today.</p>
        `;

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();
        const subject = `Welcome to Studio Platform!`;

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'welcome_member', { name }, 'sent');
            console.log(`Welcome email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'welcome_member', { name }, 'failed', e.message);
            console.error("Failed to send welcome email", e);
        }
    }

    async sendGenericEmail(to: string, subject: string, html: string, isNotification = false) {
        // Can't easily replay generic emails without storing full HTML which might be large.
        // We'll store a snippet or just indicate it was generic.
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'generic', { isNotification }, 'failed', 'Usage limit reached');
            return;
        }

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
            await this.logEmail(to, subject, 'generic', { isNotification }, 'sent');
            console.log(`Generic email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'generic', { isNotification }, 'failed', e.message);
            console.error("Failed to send generic email", e);
            throw e;
        }
    }

    async notifyOwnerNewStudent(ownerEmail: string, studentName: string) {
        const targetEmail = this.config?.settings?.notifications?.adminEmail || ownerEmail;

        if (!this.config?.settings?.notifications?.newStudentAlert) {
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

    async sendTemplate(to: string, templateId: string, data: any) {
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, `Template: ${templateId}`, templateId, data, 'failed', 'Usage limit reached');
            return;
        }

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                from: options.from,
                reply_to: options.reply_to,
                to,
                bcc,
                subject: ' ', // Placeholder
                template: {
                    id: templateId,
                    variables: data
                }
            } as any);

            await this.incrementUsage();
            await this.logEmail(to, `Template: ${templateId}`, templateId, data, 'sent');
            console.log(`Template email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, `Template: ${templateId}`, templateId, data, 'failed', e.message);
            console.error("Template Send Error", e);
        }
    }

    async sendReceipt(to: string, data: {
        amount: number;
        currency: string;
        description: string;
        date: Date;
        paymentMethod?: string; // 'Card ending in 4242'
        receiptUrl?: string;
    }) {
        const subject = `Receipt for ${data.description}`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'receipt', data, 'failed', 'Usage limit reached');
            return;
        }

        const dateStr = data.date.toLocaleString();
        const amountStr = (data.amount / 100).toFixed(2);

        const htmlContent = `
            <h1>Payment Receipt</h1>
            <p>Thank you for your purchase.</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0; font-size: 24px;">$${amountStr} <span style="font-size: 14px; color: #666;">${data.currency.toUpperCase()}</span></h2>
                <p style="margin-bottom: 5px;"><strong>${data.description}</strong></p>
                <p style="color: #666; font-size: 14px; margin: 0;">${dateStr}</p>
            </div>
            ${data.paymentMethod ? `<p><strong>Payment Method:</strong> ${data.paymentMethod}</p>` : ''}
            ${data.receiptUrl ? `<p><a href="${data.receiptUrl}" class="button">View Online Receipt</a></p>` : ''}
        `;

        const { bcc } = this.getRecipients(to, 'transactional');
        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                ...options,
                to,
                bcc,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'receipt', data, 'sent');
            console.log(`Receipt email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'receipt', data, 'failed', e.message);
            console.error("Failed to send receipt email", e);
        }
    }

    async sendWelcomeOwner(to: string, name: string, studioName: string, loginUrl: string) {
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, `Welcome to Studio Platform - ${studioName}`, 'welcome_owner', { name, studioName, loginUrl }, 'failed', 'Usage limit reached');
            return;
        }

        const htmlContent = `
            <h1>Welcome to Studio Platform!</h1>
            <p>Hello ${name},</p>
            <p>Your studio <strong>${studioName}</strong> has been successfully provisioned.</p>
            <p>You can now log in to your dashboard to start managing your schedule, members, and more.</p>
            <a href="${loginUrl}" class="button">Go to Dashboard</a>
        `;

        const options = this.getEmailOptions();
        const subject = `Welcome to Studio Platform - ${studioName}`;

        try {
            await this.resend.emails.send({
                ...options,
                to,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'welcome_owner', { name, studioName, loginUrl }, 'sent');
            console.log(`Welcome Owner email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'welcome_owner', { name, studioName, loginUrl }, 'failed', e.message);
            console.error("Failed to send welcome owner email", e);
        }
    }

    async sendNewTenantAlert(adminEmail: string, details: { name: string; slug: string; tier: string; ownerEmail: string }) {
        const options = this.getEmailOptions();
        const subject = `[New Tenant] ${details.name} (${details.tier})`;

        const htmlContent = `
            <h1>New Tenant Alert</h1>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px;">
                <p><strong>Studio:</strong> ${details.name}</p>
                <p><strong>Slug:</strong> ${details.slug}</p>
                <p><strong>Tier:</strong> ${details.tier.toUpperCase()}</p>
                <p><strong>Owner:</strong> ${details.ownerEmail}</p>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 10px;">Time: ${new Date().toLocaleString()}</p>
        `;

        try {
            await this.resend.emails.send({
                ...options,
                to: adminEmail,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(adminEmail, subject, 'alert_new_tenant', details, 'sent');
            console.log(`New Tenant Alert sent to ${adminEmail}`);
        } catch (e: any) {
            await this.logEmail(adminEmail, subject, 'alert_new_tenant', details, 'failed', e.message);
            console.error("Failed to send new tenant alert", e);
        }
    }

    async sendSubscriptionUpdateOwner(to: string, name: string, newTier: string) {
        const subject = `Your plan has been updated to ${newTier.toUpperCase()}`;

        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'subscription_update_owner', { name, newTier }, 'failed', 'Usage limit reached');
            return;
        }

        const htmlContent = `
            <h1>Plan Updated!</h1>
            <p>Hello ${name},</p>
            <p>Good news! Your studio plan has been updated to <strong>${newTier.toUpperCase()}</strong>.</p>
            <p>You now have access to all features included in this tier.</p>
        `;

        const options = this.getEmailOptions();

        try {
            await this.resend.emails.send({
                ...options,
                to,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'subscription_update_owner', { name, newTier }, 'sent');
            console.log(`Subscription update email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'subscription_update_owner', { name, newTier }, 'failed', e.message);
            console.error("Failed to send subscription update email", e);
        }
    }

    async sendTenantUpgradeAlert(adminEmail: string, details: { name: string; slug: string; oldTier?: string; newTier: string }) {
        const options = this.getEmailOptions();
        const subject = `[Upgrade] ${details.name} -> ${details.newTier.toUpperCase()}`;

        const htmlContent = `
            <h1>Tenant Upgrade Alert</h1>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px;">
                <p><strong>Studio:</strong> ${details.name}</p>
                <p><strong>Slug:</strong> ${details.slug}</p>
                <p><strong>Change:</strong> ${details.oldTier ? details.oldTier.toUpperCase() : '???'} &rarr; <strong>${details.newTier.toUpperCase()}</strong></p>
            </div>
        `;

        try {
            await this.resend.emails.send({
                ...options,
                to: adminEmail,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(adminEmail, subject, 'alert_tenant_upgrade', details, 'sent');
            console.log(`Upgrade Alert sent to ${adminEmail}`);
        } catch (e: any) {
            await this.logEmail(adminEmail, subject, 'alert_tenant_upgrade', details, 'failed', e.message);
            console.error("Failed to send upgrade alert", e);
        }
    }
    async sendSubRequestAlert(to: string, details: {
        classTitle: string;
        date: string;
        requestingInstructor: string;
        message?: string;
        link: string;
    }) {
        const subject = `Coverage Needed: ${details.classTitle}`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'sub_request_alert', details, 'failed', 'Usage limit reached');
            return;
        }

        const htmlContent = `
            <h1>Coverage Needed</h1>
            <p><strong>${details.requestingInstructor}</strong> needs a sub for:</p>
            <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${details.classTitle}</p>
                <p style="color: #666; margin-top: 0;">${details.date}</p>
                ${details.message ? `<p style="font-style: italic; color: #555; margin-top: 15px;">"${details.message}"</p>` : ''}
            </div>
            <a href="${details.link}" class="button">View & Accept Shift</a>
        `;

        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                to,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'sub_request_alert', details, 'sent');
            console.log(`Sub Alert sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'sub_request_alert', details, 'failed', e.message);
            console.error("Failed to send sub alert", e);
        }
    }

    async sendSubRequestFilled(to: string, details: {
        classTitle: string;
        date: string;
        coveringInstructor: string;
    }) {
        const subject = `Sub Found: ${details.classTitle}`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'sub_request_filled', details, 'failed', 'Usage limit reached');
            return;
        }

        const htmlContent = `
            <h1>Shift Covered!</h1>
            <p>Good news! <strong>${details.coveringInstructor}</strong> has accepted your request for:</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${details.classTitle}</p>
                <p style="color: #666; margin-top: 0;">${details.date}</p>
            </div>
            <p>The schedule has been updated automatically.</p>
        `;

        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                to,
                subject,
                html: this.wrapHtml(htmlContent)
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'sub_request_filled', details, 'sent');
            console.log(`Sub Filled email sent to ${to}`);
        } catch (e: any) {
            await this.logEmail(to, subject, 'sub_request_filled', details, 'failed', e.message);
            console.error("Failed to send sub filled email", e);
        }
    }
}
