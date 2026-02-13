import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';
import {
    payrollConfig,
    payouts,
    payrollItems,
    classes,
    bookings,
    appointments,
    appointmentServices,
    tenantMembers,
    users
} from '@studio/db/src/schema';
import { and, eq, between, sql, inArray } from 'drizzle-orm';

export interface PayoutItem {
    type: 'class' | 'appointment';
    referenceId: string;
    title: string;
    date: Date;
    amount: number;
    details: string;
}

export interface PayoutResult {
    instructorId: string;
    amount: number;
    itemCount: number;
    items: PayoutItem[];
}

export class PayrollService {
    constructor(private db: DrizzleD1Database<typeof schema>, private tenantId: string) { }

    async generatePayoutData(start: Date, end: Date): Promise<PayoutResult[]> {
        const configs = await this.db.select().from(payrollConfig).where(eq(payrollConfig.tenantId, this.tenantId)).all();
        const results: PayoutResult[] = [];

        for (const config of configs) {
            let totalDue = 0;
            const items: PayoutItem[] = [];

            // 1. Classes
            const instructorClasses = await this.db.select()
                .from(classes)
                .where(and(
                    eq(classes.instructorId, config.memberId!),
                    between(classes.startTime, start, end),
                    eq(classes.status, 'active')
                )).all();

            for (const cls of instructorClasses) {
                const { amount, details } = await this.calculateClassPay(config, cls);
                if (amount > 0) {
                    totalDue += amount;
                    items.push({ type: 'class', referenceId: cls.id, title: cls.title, date: cls.startTime, amount, details });
                }
            }

            // 2. Appointments
            const instructorAppointments = await this.db.select({
                id: appointments.id, startTime: appointments.startTime, endTime: appointments.endTime,
                servicePrice: appointmentServices.price, serviceTitle: appointmentServices.title
            })
                .from(appointments)
                .innerJoin(appointmentServices, eq(appointments.serviceId, appointmentServices.id))
                .where(and(
                    eq(appointments.instructorId, config.memberId!),
                    between(appointments.startTime, start, end),
                    eq(appointments.status, 'completed')
                )).all();

            for (const apt of instructorAppointments) {
                const { amount, details } = await this.calculateAppointmentPay(config, apt);
                if (amount > 0) {
                    totalDue += amount;
                    items.push({ type: 'appointment', referenceId: apt.id, title: apt.serviceTitle, date: apt.startTime, amount, details });
                }
            }

            if (totalDue > 0) {
                results.push({ instructorId: config.memberId!, amount: totalDue, itemCount: items.length, items });
            }
        }

        return results;
    }

    private async calculateClassPay(config: any, cls: any) {
        let amount = 0, details = "";
        if (config.payModel === 'flat') {
            amount = config.rate;
            details = `Flat rate per class`;
        } else if (config.payModel === 'hourly') {
            amount = Math.round((config.rate * cls.durationMinutes) / 60);
            details = `${cls.durationMinutes} mins @ $${(config.rate / 100).toFixed(2)}/hr`;
        } else if (config.payModel === 'percentage') {
            const classBookings = await this.db.query.bookings.findMany({
                where: and(eq(bookings.classId, cls.id), eq(bookings.status, 'confirmed')),
                with: { usedPack: true }
            });
            let totalRevenueCents = 0;
            for (const b of classBookings) {
                if (b.paymentMethod === 'drop_in') totalRevenueCents += (cls.price || 0);
                else if (b.paymentMethod === 'credit' && b.usedPack) {
                    totalRevenueCents += (b.usedPack.price || 0) / (b.usedPack.initialCredits || 1);
                }
            }
            const revenue = Math.round(totalRevenueCents);
            let basisAmount = revenue, basisLabel = "Gross Revenue";
            if (config.payoutBasis === 'net') {
                const estimatedFees = Math.floor(revenue * 0.029) + (classBookings.filter((b: any) => b.paymentMethod === 'drop_in').length * 30);
                basisAmount = Math.max(0, revenue - estimatedFees);
                basisLabel = "Net Revenue (Est.)";
            }
            amount = Math.round(basisAmount * (config.rate / 10000));
            details = `${(config.rate / 100)}% of $${(basisAmount / 100).toFixed(2)} (${basisLabel})`;
        }
        return { amount, details };
    }

    private async calculateAppointmentPay(config: any, apt: any) {
        let amount = 0, details = "";
        const durationMinutes = (apt.endTime.getTime() - apt.startTime.getTime()) / (1000 * 60);
        if (config.payModel === 'flat') {
            amount = config.rate;
            details = `Flat rate per appointment`;
        } else if (config.payModel === 'hourly') {
            amount = Math.round((config.rate * durationMinutes) / 60);
            details = `${durationMinutes} mins @ $${(config.rate / 100).toFixed(2)}/hr`;
        } else if (config.payModel === 'percentage') {
            const revenue = apt.servicePrice || 0;
            amount = Math.round(revenue * (config.rate / 10000));
            details = `${(config.rate / 100)}% of $${(revenue / 100).toFixed(2)} service price`;
        }
        return { amount, details };
    }

    async commitPayouts(results: PayoutResult[], start: Date, end: Date) {
        for (const res of results) {
            const payoutId = crypto.randomUUID();
            await this.db.insert(payouts).values({
                id: payoutId,
                tenantId: this.tenantId,
                instructorId: res.instructorId,
                amount: res.amount,
                periodStart: start,
                periodEnd: end,
                status: 'processing',
                createdAt: new Date()
            }).run();

            for (const item of res.items) {
                await this.db.insert(payrollItems).values({
                    id: crypto.randomUUID(),
                    payoutId,
                    type: item.type,
                    referenceId: item.referenceId,
                    amount: item.amount,
                    details: JSON.stringify({ note: item.details, title: item.title, date: item.date })
                }).run();
            }
        }
    }

    async getInstructorProfitability(start: Date, end: Date) {
        // Implementation for ROI reporting
        const instructors = await this.db.select({
            id: tenantMembers.id,
            firstName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`,
            lastName: sql<string>`json_extract(${tenantMembers.profile}, '$.lastName')`
        })
            .from(tenantMembers)
            .where(eq(tenantMembers.tenantId, this.tenantId))
            .all();

        const stats = [];
        for (const inst of instructors) {
            // Calculate Total Revenue Generated
            const instructorClasses = await this.db.select({ id: classes.id, price: classes.price })
                .from(classes)
                .where(and(eq(classes.instructorId, inst.id), between(classes.startTime, start, end), eq(classes.status, 'active')))
                .all();

            let totalRev = 0;
            for (const cls of instructorClasses) {
                const classBookings = await this.db.query.bookings.findMany({
                    where: and(eq(bookings.classId, cls.id), eq(bookings.status, 'confirmed')),
                    with: { usedPack: true }
                });
                for (const b of classBookings) {
                    if (b.paymentMethod === 'drop_in') totalRev += (cls.price || 0);
                    else if (b.paymentMethod === 'credit' && b.usedPack) {
                        totalRev += (b.usedPack.price || 0) / (b.usedPack.initialCredits || 1);
                    }
                }
            }

            // Calculate Total Payouts (Cost)
            const payoutSum = await this.db.select({ total: sql<number>`sum(${payouts.amount})` })
                .from(payouts)
                .where(and(eq(payouts.instructorId, inst.id), between(payouts.periodStart, start, end)))
                .get();

            const cost = payoutSum?.total || 0;
            stats.push({
                instructorId: inst.id,
                name: `${inst.firstName} ${inst.lastName}`,
                revenue: totalRev,
                cost: cost,
                profit: totalRev - cost,
                margin: totalRev > 0 ? ((totalRev - cost) / totalRev) * 100 : 0
            });
        }
        return stats;
    }

    async bulkApprove(payoutIds: string[]) {
        if (payoutIds.length === 0) return;
        await this.db.update(payouts)
            .set({ status: 'paid', paidAt: new Date(), notes: 'Bulk approved' })
            .where(and(
                inArray(payouts.id, payoutIds),
                eq(payouts.tenantId, this.tenantId)
            )).run();
    }

    async generateExportCsv(start: Date, end: Date) {
        const history = await this.db.select({
            id: payouts.id,
            amount: payouts.amount,
            status: payouts.status,
            periodStart: payouts.periodStart,
            periodEnd: payouts.periodEnd,
            paidAt: payouts.paidAt,
            firstName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`,
            lastName: sql<string>`json_extract(${tenantMembers.profile}, '$.lastName')`
        })
            .from(payouts)
            .innerJoin(tenantMembers, eq(payouts.instructorId, tenantMembers.id))
            .where(and(
                eq(payouts.tenantId, this.tenantId),
                between(payouts.createdAt, start, end)
            ))
            .orderBy(sql`${payouts.createdAt} DESC`)
            .all();

        const headers = ['ID', 'Instructor', 'Amount', 'Status', 'Period Start', 'Period End', 'Paid At'];
        const rows = history.map(p => [
            p.id,
            `${p.firstName} ${p.lastName}`,
            (p.amount / 100).toFixed(2),
            p.status,
            p.periodStart.toISOString().split('T')[0],
            p.periodEnd.toISOString().split('T')[0],
            p.paidAt ? p.paidAt.toISOString() : ''
        ].join(','));

        return [headers.join(','), ...rows].join('\n');
    }
}
