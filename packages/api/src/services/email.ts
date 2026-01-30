import { Resend } from 'resend';
import { UsageService } from './pricing';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@studio/db';
import { emailLogs } from '@studio/db';
import { eq } from 'drizzle-orm';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import * as React from 'react';
import {
    WelcomeEmail,
    BookingConfirmation,
    InvitationEmail,
    ReceiptEmail,
    BroadcastEmail
} from '@studio/emails';

export interface TenantEmailConfig {
    branding?: {
        emailReplyTo?: string;
        emailFooterText?: string;
        primaryColor?: string;
        logoUrl?: string;
        physicalAddress?: string;
    };
    settings?: {
        notifications?: {
            adminEmail?: string;
            enableBcc?: boolean;
            newStudentAlert?: boolean;
        };
        unsubscribeUrl?: string;
    };
    resendAudienceId?: string;
}

export class EmailService {
    private resend: Resend;
    private fromEmail: string;
    private config?: TenantEmailConfig;
    private usageService?: UsageService;
    private isByok: boolean = false;
    private db?: DrizzleD1Database<typeof schema>;
    private tenantId?: string;
    private studioName?: string;

    constructor(
        apiKey: string,
        db: DrizzleD1Database<typeof schema>,
        tenantId: string,
        config?: TenantEmailConfig & { slug?: string; name?: string; customDomain?: string | null },
        usageService?: UsageService,
        isByok = false
    ) {
        this.resend = new Resend(apiKey);
        this.db = db;
        this.tenantId = tenantId;
        this.config = config;
        this.usageService = usageService;
        this.isByok = isByok;
        this.studioName = config?.name || 'Studio Platform';

        if (isByok && config?.customDomain) {
            this.fromEmail = `notifications@${config.customDomain}`;
        } else if (isByok && config?.slug) {
            this.fromEmail = `notifications@${config.slug}.studio-platform.com`;
        } else {
            this.fromEmail = 'notifications@studio-platform.com';
        }
    }

    public get resendClient() {
        return this.resend;
    }

    private getEmailOptions() {
        const headers: Record<string, string> = {};
        const options: any = { from: this.fromEmail };

        if (this.config?.branding?.emailReplyTo) {
            options.reply_to = this.config.branding.emailReplyTo;
        }

        if (this.config?.settings?.unsubscribeUrl) {
            headers['List-Unsubscribe'] = `<${this.config.settings.unsubscribeUrl}>`;
            headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
            options.headers = headers;
        }

        return options;
    }

    private async checkAndTrackUsage() {
        if (!this.usageService || this.isByok) return true;
        const canSend = await this.usageService.canSend('email');
        if (!canSend) console.warn("Email blocked by usage limit");
        return canSend;
    }

    private async incrementUsage() {
        if (this.usageService && !this.isByok) {
            await this.usageService.incrementUsage('email');
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

    private getBaseProps() {
        return {
            studioName: this.studioName || 'Studio Platform',
            logoUrl: this.config?.branding?.logoUrl,
            primaryColor: this.config?.branding?.primaryColor,
            physicalAddress: this.config?.branding?.physicalAddress,
            unsubscribeUrl: this.config?.settings?.unsubscribeUrl,
            footerText: this.config?.branding?.emailFooterText,
        };
    }

    private getRecipients(to: string, type: 'transactional' | 'notification'): { to: string; bcc?: string } {
        const result: { to: string; bcc?: string } = { to };
        if (type === 'transactional' && this.config?.settings?.notifications?.enableBcc && this.config?.settings?.notifications?.adminEmail) {
            result.bcc = this.config.settings.notifications.adminEmail;
        }
        return result;
    }

    async sendWelcome(to: string, name: string) {
        const subject = `Welcome to ${this.studioName}!`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'welcome_member', { name }, 'failed', 'Usage limit reached');
            return;
        }

        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                ...this.getRecipients(to, 'transactional'),
                subject,
                react: React.createElement(WelcomeEmail, { ...this.getBaseProps(), name, studioUrl: `https://${this.tenantId}.studio-platform.com` })
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'welcome_member', { name }, 'sent');
        } catch (e: any) {
            await this.logEmail(to, subject, 'welcome_member', { name }, 'failed', e.message);
        }
    }

    async sendBookingConfirmation(to: string, classDetails: {
        title: string;
        startTime: Date;
        instructorName?: string;
        locationName?: string;
        zoomUrl?: string;
        bookedBy?: string;
    }) {
        const subject = `Booking Confirmed: ${classDetails.title}`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'booking_confirmation', classDetails, 'failed', 'Usage limit reached');
            return;
        }

        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                ...this.getRecipients(to, 'transactional'),
                subject,
                react: React.createElement(BookingConfirmation, {
                    ...this.getBaseProps(),
                    name: '', // We don't have member name here easily, could be added to args
                    title: classDetails.title,
                    startTime: classDetails.startTime.toLocaleString(),
                    instructorName: classDetails.instructorName,
                    locationName: classDetails.locationName,
                    zoomUrl: classDetails.zoomUrl,
                    bookedBy: classDetails.bookedBy
                })
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'booking_confirmation', classDetails, 'sent');
        } catch (e: any) {
            await this.logEmail(to, subject, 'booking_confirmation', classDetails, 'failed', e.message);
        }
    }

    async sendInvitation(to: string, inviteUrl: string) {
        const subject = `Invitation to ${this.studioName}`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'invitation', { inviteUrl }, 'failed', 'Usage limit reached');
            return;
        }

        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                ...this.getRecipients(to, 'transactional'),
                subject,
                react: React.createElement(InvitationEmail, { ...this.getBaseProps(), inviteUrl })
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'invitation', { inviteUrl }, 'sent');
        } catch (e: any) {
            await this.logEmail(to, subject, 'invitation', { inviteUrl }, 'failed', e.message);
        }
    }

    async sendReceipt(to: string, data: {
        amount: number;
        currency: string;
        description: string;
        date: Date;
        paymentMethod?: string;
        receiptUrl?: string;
    }) {
        const subject = `Receipt for ${data.description}`;
        if (!await this.checkAndTrackUsage()) {
            await this.logEmail(to, subject, 'receipt', data, 'failed', 'Usage limit reached');
            return;
        }

        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                ...this.getRecipients(to, 'transactional'),
                subject,
                react: React.createElement(ReceiptEmail, {
                    ...this.getBaseProps(),
                    name: '',
                    amount: `${(data.amount / 100).toFixed(2)}`,
                    currency: data.currency,
                    description: data.description,
                    date: data.date.toLocaleString(),
                    paymentMethod: data.paymentMethod,
                    receiptUrl: data.receiptUrl
                })
            });
            await this.incrementUsage();
            await this.logEmail(to, subject, 'receipt', data, 'sent');
        } catch (e: any) {
            await this.logEmail(to, subject, 'receipt', data, 'failed', e.message);
        }
    }

    async sendBroadcast(audienceId: string, subject: string, content: string) {
        if (!await this.checkAndTrackUsage()) return;
        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                to: audienceId, // In Resend, you can send to an audience ID
                subject,
                react: React.createElement(BroadcastEmail, { ...this.getBaseProps(), subject, content })
            });
            await this.incrementUsage();
        } catch (e: any) {
            console.error("Broadcast failed", e);
            throw e;
        }
    }

    async syncContact(email: string, firstName?: string, lastName?: string, metadata?: any) {
        if (!this.config?.resendAudienceId) return;
        try {
            await this.resend.contacts.create({
                email,
                firstName,
                lastName,
                unsubscribed: false,
                audienceId: this.config.resendAudienceId,
            });
        } catch (e) {
            // Already exists likely, update it
            try {
                await this.resend.contacts.update({
                    email,
                    firstName,
                    lastName,
                    audienceId: this.config.resendAudienceId,
                });
            } catch (err) {
                console.error("Failed to sync contact", err);
            }
        }
    }

    // Legacy support for plain HTML generic emails
    async sendGenericEmail(to: string, subject: string, html: string, isNotification = false) {
        if (!await this.checkAndTrackUsage()) return;
        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                ...this.getRecipients(to, isNotification ? 'notification' : 'transactional'),
                subject,
                html
            });
            await this.incrementUsage();
        } catch (e: any) {
            console.error("Generic email failed", e);
            throw e;
        }
    }

    async sendWaiverCopy(to: string, waiverTitle: string, pdfBuffer: ArrayBuffer) {
        const subject = `Signed Copy: ${waiverTitle}`;
        if (!await this.checkAndTrackUsage()) return;
        try {
            await this.resend.emails.send({
                ...this.getEmailOptions(),
                ...this.getRecipients(to, 'transactional'),
                subject,
                html: `<p>Attached is your signed copy of <strong>${waiverTitle}</strong>.</p>`,
                attachments: [{ filename: `${waiverTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`, content: Buffer.from(pdfBuffer) }]
            });
            await this.incrementUsage();
        } catch (e: any) {
            console.error("Waiver email failed", e);
        }
    }
}
