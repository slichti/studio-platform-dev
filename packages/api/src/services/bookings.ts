import { eq, and } from 'drizzle-orm';
import { bookings, users, tenantMembers, classes, tenants } from 'db/src/schema'; // adjustments needed for imports
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

            // Trigger Notification
            if (this.env.RESEND_API_KEY && member.user) {
                const emailService = new EmailService(this.env.RESEND_API_KEY);
                const classInfo = await this.db.select({ title: classes.title }).from(classes).where(eq(classes.id, booking.classId)).get();

                // Using waitUntil if available, otherwise await (Cron context might wait)
                // specific context handling might be needed if passed in, but for service just await or let caller handle
                await emailService.notifyNoShow(
                    member.user.email,
                    settings.noShowFeeAmount,
                    classInfo?.title || "Class"
                );
            }

            // Attempt Charge (Placeholder)
            console.log(`[Mock Charge] Charging ${settings.noShowFeeAmount} to member ${booking.memberId} for No-Show`);
        }
    }
}
