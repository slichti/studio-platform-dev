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

        // Base pay calculation
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

            let totalGrossRevenue = 0;
            let dropInCount = 0;

            for (const b of classBookings) {
                if (b.paymentMethod === 'drop_in') {
                    totalGrossRevenue += (cls.price || 0);
                    dropInCount++;
                } else if (b.paymentMethod === 'credit' && b.usedPack) {
                    // Calculate per-credit value: Pack Price / Credits
                    totalGrossRevenue += (b.usedPack.price || 0) / (b.usedPack.initialCredits || 1);
                }
            }

            // Subtract Specific Class Refunds (if any)
            const refundedAmount = await this.db.select({ total: sql<number>`sum(${schema.refunds.amount})` })
                .from(schema.refunds)
                .where(and(
                    eq(schema.refunds.tenantId, this.tenantId),
                    eq(schema.refunds.referenceId, cls.id)
                ))
                .get();

            let revenue = Math.round(totalGrossRevenue - (refundedAmount?.total || 0));
            let basisAmount = revenue, basisLabel = "Gross Revenue";

            // If Net Payout Basis: Subtract estimated transaction fees
            if (config.payoutBasis === 'net') {
                // Standard Stripe Fee: 2.9% + 30c per individual transaction (drop-ins)
                // Note: We only apply fixed 30c to drop-ins as they are direct transactions.
                // Credits are technically part of a larger pack purchase whose fees are already processed.
                const estimatedFees = Math.floor(totalGrossRevenue * 0.029) + (dropInCount * 30);
                basisAmount = Math.max(0, basisAmount - estimatedFees);
                basisLabel = "Net Revenue (Est.)";
            }

            // Apply Fixed Deduction (e.g., Room Fee, Admin Fee)
            const fixedDeduction = (config.metadata as any)?.fixedDeduction || 0;
            basisAmount = Math.max(0, basisAmount - fixedDeduction);

            // Calculate Final Payout (Rate is basis points, e.g., 5000 = 50%)
            amount = Math.round(basisAmount * (config.rate / 10000));

            const basisStr = (basisAmount / 100).toFixed(2);
            const ratePct = (config.rate / 100).toFixed(1);
            details = `${ratePct}% of $${basisStr} (${basisLabel}${fixedDeduction > 0 ? ` - $${(fixedDeduction / 100).toFixed(2)} fee` : ''})`;
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
            let basisAmount = revenue, basisLabel = "Service Price";

            // If Net Payout Basis: Subtract 2.9% + 30c
            if (config.payoutBasis === 'net') {
                const estimatedFees = Math.floor(revenue * 0.029) + 30;
                basisAmount = Math.max(0, basisAmount - estimatedFees);
                basisLabel = "Net Revenue (Est.)";
            }

            // Apply Fixed Deduction (e.g. platform fee)
            const fixedDeduction = (config.metadata as any)?.fixedDeduction || 0;
            basisAmount = Math.max(0, basisAmount - fixedDeduction);

            amount = Math.round(basisAmount * (config.rate / 10000));

            const basisStr = (basisAmount / 100).toFixed(2);
            const ratePct = (config.rate / 100).toFixed(1);
            details = `${ratePct}% of $${basisStr} (${basisLabel}${fixedDeduction > 0 ? ` - $${(fixedDeduction / 100).toFixed(2)} fee` : ''})`;
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
