import { Resend } from 'resend';

export class EmailService {
    private resend: Resend;
    private fromEmail = 'noreply@studio-platform.com'; // Dynamic based on tenant later?

    constructor(apiKey: string) {
        this.resend = new Resend(apiKey);
    }

    async sendBookingConfirmation(to: string, classDetails: {
        title: string;
        startTime: Date;
        instructorName?: string;
        locationName?: string;
        zoomUrl?: string;
    }) {
        const date = new Date(classDetails.startTime).toLocaleString();

        // Simple Text/HTML for now
        const html = `
            <h1>Booking Confirmed!</h1>
            <p>You are booked for <strong>${classDetails.title}</strong>.</p>
            <p><strong>Time:</strong> ${date}</p>
            ${classDetails.instructorName ? `<p><strong>Instructor:</strong> ${classDetails.instructorName}</p>` : ''}
            ${classDetails.locationName ? `<p><strong>Location:</strong> ${classDetails.locationName}</p>` : ''}
            ${classDetails.zoomUrl ? `<p><strong>Zoom Link:</strong> <a href="${classDetails.zoomUrl}">Join Meeting</a></p>` : ''}
            <p>Can't wait to see you there!</p>
        `;

        try {
            await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: `Booking Confirmed: ${classDetails.title}`,
                html
            });
            console.log(`Booking email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send booking email", e);
        }
    }

    async sendWaiverCopy(to: string, waiverTitle: string, pdfBuffer: ArrayBuffer) {
        try {
            // Convert ArrayBuffer to Buffer for Resend (if node) or use array of bytes? 
            // Resend attachments usually take content as Buffer or base64 string.
            // In Cloudflare Workers, we might need to convert ArrayBuffer to Buffer.
            const buffer = Buffer.from(pdfBuffer);

            await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: `Signed Copy: ${waiverTitle}`,
                html: `<p>Attached is your signed copy of <strong>${waiverTitle}</strong>.</p>`,
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
        try {
            await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: `Welcome to Studio Platform!`,
                html: `
                    <h1>Welcome, ${name}!</h1>
                    <p>We are thrilled to have you join us.</p>
                    <p>Explore classes, book your spot, and start your journey today.</p>
                `
            });
            console.log(`Welcome email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send welcome email", e);
        }
    }


    async sendGenericEmail(to: string, subject: string, html: string) {
        try {
            await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject,
                html
            });
            console.log(`Generic email sent to ${to}`);
        } catch (e) {
            console.error("Failed to send generic email", e);
            throw e; // Rethrow to let caller know
        }
    }
}
