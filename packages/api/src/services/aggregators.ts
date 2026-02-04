import { eq, and, sql, gte, lte } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { BookingService } from './bookings';
import { AuditService } from './audit'; // [NEW] Audit

export interface AggregatorFeedItem {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    duration: number;
    capacity: number | null;
    spots_remaining: number;
    instructor_name: string;
    location_name: string;
    price: number;
    currency: string;
}

export class AggregatorService {
    private bookingService: BookingService;
    private audit: AuditService;

    constructor(private db: any, private env: any, private tenantId: string) {
        this.bookingService = new BookingService(db, env);
        this.audit = new AuditService(db);
    }

    /**
     * Generate a JSON feed of upcoming classes for aggregators.
     */
    async getScheduleFeed(daysAhead: number = 14): Promise<AggregatorFeedItem[]> {
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + daysAhead);

        const classes = await this.db.query.classes.findMany({
            where: and(
                eq(schema.classes.tenantId, this.tenantId),
                eq(schema.classes.status, 'active'),
                gte(schema.classes.startTime, start),
                lte(schema.classes.startTime, end)
            ),
            with: {
                instructor: { with: { user: true } },
                location: true
            },
            orderBy: (c: any) => [sql`${c.startTime} ASC`]
        });

        const feed: AggregatorFeedItem[] = [];

        for (const cls of classes) {
            // Get booking counts
            const bookings = await this.db.select({ count: sql<number>`count(*)` })
                .from(schema.bookings)
                .where(and(
                    eq(schema.bookings.classId, cls.id),
                    eq(schema.bookings.status, 'confirmed')
                ))
                .get();

            const booked = bookings?.count || 0;
            const remaining = cls.capacity ? Math.max(0, cls.capacity - booked) : 99;

            feed.push({
                id: cls.id,
                title: cls.title,
                description: cls.description,
                start_time: cls.startTime.toISOString(),
                duration: cls.durationMinutes,
                capacity: cls.capacity,
                spots_remaining: remaining,
                instructor_name: `${(cls.instructor?.user?.profile as any)?.firstName || ''} ${(cls.instructor?.user?.profile as any)?.lastName || ''}`.trim() || 'Staff',
                location_name: cls.location?.name || 'Main Studio',
                price: cls.price || 0,
                currency: 'USD' // Default
            });
        }

        return feed;
    }

    /**
     * Maps an external booking (from ClassPass/Gympass) to a local member.
     * Creates the user and tenant relationship if they don't exist.
     */
    async findOrCreateMember(email: string, firstName: string, lastName: string) {
        // 1. Find or Create User
        let user = await this.db.query.users.findFirst({
            where: eq(schema.users.email, email.toLowerCase())
        });

        if (!user) {
            const userId = crypto.randomUUID();
            user = await this.db.insert(schema.users).values({
                id: userId,
                email: email.toLowerCase(),
                profile: { firstName, lastName },
                createdAt: new Date()
            }).returning().get();
        }

        // 2. Find or Create Tenant Member
        let member = await this.db.query.tenantMembers.findFirst({
            where: and(
                eq(schema.tenantMembers.userId, user!.id),
                eq(schema.tenantMembers.tenantId, this.tenantId)
            )
        });

        if (!member) {
            const memberId = crypto.randomUUID();
            member = await this.db.insert(schema.tenantMembers).values({
                id: memberId,
                tenantId: this.tenantId,
                userId: user!.id,
                status: 'active',
                joinedAt: new Date()
            }).returning().get();
        }

        return member;
    }

    /**
     * Process an inbound partner booking.
     */
    async processPartnerBooking(params: {
        classId: string;
        externalSource: string;
        externalId: string;
        userEmail: string;
        userFirstName: string;
        userLastName: string;
    }) {
        const member = await this.findOrCreateMember(params.userEmail, params.userFirstName, params.userLastName);

        // Use BookingService for core logic (capacity checks, etc)
        const booking = await this.bookingService.createBooking(params.classId, member!.id);

        // Tag with aggregator info
        await this.db.update(schema.bookings).set({
            externalSource: params.externalSource,
            externalId: params.externalId,
            paymentMethod: 'free' // Usually handled by aggregator billing split later
        }).where(eq(schema.bookings.id, booking.id)).run();

        // [NEW] Audit Log
        await this.audit.log({
            actorId: 'system',
            action: `aggregator.booking_created`,
            targetId: booking.id,
            tenantId: this.tenantId,
            details: {
                source: params.externalSource,
                externalId: params.externalId,
                email: params.userEmail
            }
        });

        return booking;
    }

    /**
     * Process an inbound partner cancellation.
     */
    async processPartnerCancellation(externalSource: string, externalId: string) {
        const booking = await this.db.query.bookings.findFirst({
            where: and(
                eq(schema.bookings.externalSource, externalSource),
                eq(schema.bookings.externalId, externalId),
                eq(schema.bookings.status, 'confirmed')
            )
        });

        if (!booking) {
            throw new Error(`Booking not found for ${externalSource} ID: ${externalId}`);
        }

        await this.bookingService.cancelBooking(booking.id);

        // [NEW] Audit Log
        await this.audit.log({
            actorId: 'system',
            action: `aggregator.booking_cancelled`,
            targetId: booking.id,
            tenantId: this.tenantId,
            details: {
                source: externalSource,
                externalId: externalId
            }
        });

        return { success: true };
    }
}
