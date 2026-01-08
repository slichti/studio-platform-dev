import { DrizzleD1Database } from 'drizzle-orm/d1';
import {
    bookings,
    classes,
    membershipPlans,
    posOrders,
    purchasedPacks,
    subscriptions,
    tenantMembers,
    users,
    waiverSignatures,
    waiverTemplates,
    activePackDefinitions,
    classPackDefinitions
} from 'db/src/schema'; // Ensure correct imports
import { and, between, eq, sql, desc, count, gte, lte } from 'drizzle-orm';

export class ReportService {
    constructor(private db: DrizzleD1Database<any>, private tenantId: string) { }

    async getRevenue(start: Date, end: Date) {
        // 1. POS Orders (Retail)
        const retailRevenue = await this.db.select({
            total: sql<number>`sum(${posOrders.totalAmount})`
        })
            .from(posOrders)
            .where(and(
                eq(posOrders.tenantId, this.tenantId),
                between(posOrders.createdAt, start, end),
                eq(posOrders.status, 'completed')
            ))
            .get();

        // 2. Class Packs
        const packsRevenue = await this.db.select({
            total: sql<number>`sum(${purchasedPacks.price})`
        })
            .from(purchasedPacks)
            .where(and(
                eq(purchasedPacks.tenantId, this.tenantId),
                between(purchasedPacks.createdAt, start, end)
            ))
            .get();

        // 3. Subscriptions (MRR - Snapshot of current active)
        const activeSubs = await this.db.select({
            price: membershipPlans.price
        })
            .from(subscriptions)
            .innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id))
            .where(and(
                eq(subscriptions.tenantId, this.tenantId),
                eq(subscriptions.status, 'active')
            ))
            .all();

        const mrr = activeSubs.reduce((sum, sub) => sum + (sub.price || 0), 0);

        // 4. Subscription Renewals (Estimated)
        const renewalsEstimate = activeSubs.reduce((sum, sub) => sum + (sub.price || 0), 0);

        const retailTotal = retailRevenue?.total || 0;
        const packsTotal = packsRevenue?.total || 0;
        const grossVolume = retailTotal + packsTotal + renewalsEstimate;

        const breakdown = {
            retail: retailTotal,
            packs: packsTotal,
            mrr: mrr,
            renewals: renewalsEstimate
        };

        // Chart Data (Time Series)
        const [retailItems, packItems] = await Promise.all([
            this.db.select({ date: posOrders.createdAt, amount: posOrders.totalAmount })
                .from(posOrders)
                .where(and(
                    eq(posOrders.tenantId, this.tenantId),
                    between(posOrders.createdAt, start, end),
                    eq(posOrders.status, 'completed')
                )).all(),

            this.db.select({ date: purchasedPacks.createdAt, amount: purchasedPacks.price })
                .from(purchasedPacks)
                .where(and(
                    eq(purchasedPacks.tenantId, this.tenantId),
                    between(purchasedPacks.createdAt, start, end)
                )).all()
        ]);

        const dayMap = new Map<string, number>();
        const cursor = new Date(start);
        while (cursor <= end) {
            dayMap.set(cursor.toISOString().split('T')[0], 0);
            cursor.setDate(cursor.getDate() + 1);
        }

        [...retailItems, ...packItems].forEach(item => {
            const d = new Date(item.date || new Date().toISOString());
            const key = d.toISOString().split('T')[0];
            if (dayMap.has(key)) {
                dayMap.set(key, (dayMap.get(key) || 0) + (item.amount || 0));
            }
        });

        const dailyMrr = mrr / 30;
        for (const [key, val] of dayMap.entries()) {
            dayMap.set(key, val + dailyMrr);
        }

        const chartData = Array.from(dayMap.entries())
            .map(([name, value]) => ({ name, value: value / 100 }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return {
            grossVolume,
            mrr,
            breakdown,
            chartData,
            period: { start: start.toISOString(), end: end.toISOString() }
        };
    }

    async getAttendance(start: Date, end: Date) {
        const totalBookings = await this.db.select({ count: count() })
            .from(bookings)
            .innerJoin(classes, eq(bookings.classId, classes.id))
            .where(and(
                eq(classes.tenantId, this.tenantId),
                between(classes.startTime, start, end),
                eq(bookings.status, 'confirmed')
            )).get();

        const totalCheckins = await this.db.select({ count: count() })
            .from(bookings)
            .innerJoin(classes, eq(bookings.classId, classes.id))
            .where(and(
                eq(classes.tenantId, this.tenantId),
                between(classes.startTime, start, end),
                eq(bookings.status, 'confirmed'),
                sql`${bookings.checkedInAt} IS NOT NULL`
            )).get();

        const topClasses = await this.db.select({
            title: classes.title,
            attendees: count(bookings.id)
        })
            .from(classes)
            .leftJoin(bookings, eq(classes.id, bookings.classId))
            .where(and(
                eq(classes.tenantId, this.tenantId),
                between(classes.startTime, start, end),
                eq(bookings.status, 'confirmed')
            ))
            .groupBy(classes.title)
            .orderBy(desc(count(bookings.id)))
            .limit(5)
            .all();

        const dailyData = await this.db.select({
            date: classes.startTime,
            count: count(bookings.id)
        })
            .from(classes)
            .leftJoin(bookings, eq(classes.id, bookings.classId))
            .where(and(
                eq(classes.tenantId, this.tenantId),
                between(classes.startTime, start, end),
                eq(bookings.status, 'confirmed')
            ))
            .groupBy(classes.startTime)
            .all();

        const dayMap = new Map<string, number>();
        const cursor = new Date(start);
        while (cursor <= end) {
            dayMap.set(cursor.toISOString().split('T')[0], 0);
            cursor.setDate(cursor.getDate() + 1);
        }

        dailyData.forEach(item => {
            const d = new Date(item.date);
            const key = d.toISOString().split('T')[0];
            if (dayMap.has(key)) {
                dayMap.set(key, (dayMap.get(key) || 0) + item.count);
            }
        });

        const chartData = Array.from(dayMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return {
            totalBookings: totalBookings?.count || 0,
            totalCheckins: totalCheckins?.count || 0,
            topClasses,
            chartData
        };
    }

    getProjection(studentCount: number, monthlyFee: number, costs: number) {
        const revenue = studentCount * monthlyFee;
        const tiers = [
            { id: 'basic', name: 'Launch', price: 0, fee: 0.05 },
            { id: 'growth', name: 'Growth', price: 49, fee: 0.015 },
            { id: 'scale', name: 'Scale', price: 129, fee: 0.0 }
        ];

        const projections = tiers.map(t => {
            const platformCost = t.price + (revenue * t.fee);
            const profit = revenue - platformCost - (costs || 0);
            return {
                tier: t.id,
                name: t.name,
                revenue,
                platformCost,
                estimatedProfit: profit,
                details: `Platform: $${platformCost.toFixed(2)} ($${t.price} fixed + ${(t.fee * 100)}% fees)`
            };
        });

        const recommended = [...projections].sort((a, b) => b.estimatedProfit - a.estimatedProfit)[0];

        return {
            inputs: { studentCount, monthlyFee, costs },
            projections,
            recommendation: recommended.tier
        };
    }

    async getJournal(start: Date, end: Date, format: string, currency: string) {
        // 1. Fetch POS Orders
        const orders = await this.db.select({
            id: posOrders.id,
            date: posOrders.createdAt,
            total: posOrders.totalAmount,
            tax: posOrders.taxAmount,
        }).from(posOrders)
            .where(and(
                eq(posOrders.tenantId, this.tenantId),
                gte(posOrders.createdAt, start),
                lte(posOrders.createdAt, end),
                eq(posOrders.status, 'completed')
            )).all();

        // 2. Fetch Pack Purchases
        const packs = await this.db.select({
            id: purchasedPacks.id,
            date: purchasedPacks.createdAt,
            name: classPackDefinitions.name,
            total: purchasedPacks.price
        }).from(purchasedPacks)
            .innerJoin(classPackDefinitions, eq(purchasedPacks.packDefinitionId, classPackDefinitions.id))
            .where(and(
                eq(purchasedPacks.tenantId, this.tenantId),
                gte(purchasedPacks.createdAt, start),
                lte(purchasedPacks.createdAt, end)
            )).all();

        const journal: any[] = [];

        // POS Revenue
        for (const o of orders) {
            journal.push({
                date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
                description: `POS Order #${o.id.slice(0, 8)}`,
                account: 'Revenue: Sales',
                debit: 0,
                credit: (o.total - (o.tax || 0)) / 100,
                currency: currency
            });

            if (o.tax && o.tax > 0) {
                journal.push({
                    date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
                    description: `Tax on Order #${o.id.slice(0, 8)}`,
                    account: 'Liability: Sales Tax',
                    debit: 0,
                    credit: o.tax / 100,
                    currency: currency
                });
            }

            journal.push({
                date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
                description: `Payment for Order #${o.id.slice(0, 8)}`,
                account: 'Assets: Stripe Clearing',
                debit: o.total / 100,
                credit: 0,
                currency: currency
            });
        }

        // Pack Revenue
        for (const p of packs) {
            journal.push({
                date: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
                description: `Class Pack: ${p.name}`,
                account: 'Revenue: Class Packs',
                debit: 0,
                credit: (p.total || 0) / 100,
                currency: currency
            });

            journal.push({
                date: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
                description: `Payment for Pack ${p.name}`,
                account: 'Assets: Stripe Clearing',
                debit: (p.total || 0) / 100,
                credit: 0,
                currency: currency
            });
        }

        if (format === 'csv') {
            const headers = "Date,Description,Account,Debit,Credit,Currency\n";
            const rows = journal.map(j =>
                `${j.date},"${j.description}","${j.account}",${j.debit},${j.credit},${j.currency}`
            ).join("\n");
            return rows;
        }

        return journal;
    }
}
