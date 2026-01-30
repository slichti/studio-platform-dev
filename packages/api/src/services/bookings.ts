import { eq, and } from 'drizzle-orm';
import { bookings, users, tenantMembers, classes, tenants } from '@studio/db/src/schema'; // adjustments needed for imports
import { EmailService } from './email';

export class BookingService {
    constructor(private db: any, private env: any) { }

    async markNoShow(bookingId: string) {
        // 1. Get Booking & Tenant Context
        const booking = await this.db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
        if (!booking) throw new Error("Booking not found");

        if (booking.status === 'no_show') return; // Already marked

        // Get Member & Tenant to check settings
        const member = await this.db.query.tenantMembers.findFirst({
            where: eq(tenantMembers.id, booking.memberId),
            with: {
                user: true,
                tenant: true
            }
        });

        if (!member || !member.tenant) throw new Error("Member or Tenant not found");

        const settings = (member.tenant.settings || {}) as any;

        // 2. Update Status
        await this.db.update(bookings)
            .set({ status: 'no_show' })
            .where(eq(bookings.id, bookingId))
            .run();

        // 3. Handle Logic (Fee & Notification)
        if (settings.noShowFeeEnabled && settings.noShowFeeAmount > 0) {
            const classInfo = await this.db.select({ title: classes.title }).from(classes).where(eq(classes.id, booking.classId)).get();

            // Trigger Notification
            if (this.env.RESEND_API_KEY && member.user) {
                // Pass branding/settings if available on tenant
                const emailConfig = {
                    branding: member.tenant?.branding as any,
                    settings: member.tenant?.settings as any
                };

                // Usage Service needed for SmsService?
                const { UsageService } = await import('./pricing');
                const usageService = new UsageService(this.db, member.tenantId);

                const emailService = new EmailService(
                    this.env.RESEND_API_KEY as string,
                    emailConfig,
                    undefined,
                    undefined,
                    false,
                    this.db,
                    member.tenantId
                );

                const { SmsService } = await import('./sms');
                const smsService = new SmsService(
                    member.tenant.twilioCredentials as any,
                    this.env,
                    usageService,
                    this.db,
                    member.tenantId
                );

                const { AutomationsService } = await import('./automations');
                const autoService = new AutomationsService(this.db, member.tenantId, emailService, smsService);

                // Dispatch Automation Trigger
                await autoService.dispatchTrigger('class_missed', {
                    userId: member.user.id,
                    email: member.user.email,
                    firstName: (member.user.profile as any)?.firstName,
                    data: {
                        classId: booking.classId,
                        classTitle: classInfo?.title || 'Class',
                        feeAmount: settings.noShowFeeAmount
                    }
                });

                // Fallback: Legacy Notification if no automation matched?
                // For now, let's keep the manual notification IF we want to ensure it goes out even without automation.
                // But usually automation replaces it. 
                // Let's assume the legacy behavior is "system notification" and automation is "marketing".
                // Actually, "No Show Fee" notification is transactional.
                // Let's keep the direct email for the FEE NOTICE, but use automation for "We missed you".

                await emailService.notifyNoShow(
                    member.user.email,
                    settings.noShowFeeAmount,
                    classInfo?.title || "Class"
                );
            }

            // Attempt Charge (Placeholder)
            const chargeDescription = `No Show [${classInfo?.title || 'Class'}]`;
            console.log(`[Mock Charge] Charging ${settings.noShowFeeAmount} to member ${booking.memberId} for ${chargeDescription}`);
        }
    }
}
