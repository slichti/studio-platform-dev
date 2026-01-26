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
    classPackDefinitions
} from '@studio/db/src/schema'; // Ensure correct imports
import { and, between, eq, sql, desc, count, gte, lte, inArray } from 'drizzle-orm';

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
    async query(options: {
        metrics: string[]; // ['revenue', 'attendance', 'bookings']
        dimensions: string[]; // ['date' | 'instructor' | 'payment_method' | 'class_type']
        filters: {
            startDate: Date;
            endDate: Date;
            instructorId?: string;
        };
    }) {
        const { metrics, dimensions, filters } = options;
        const result: any = {
            chartData: [],
            summary: {}
        };

        const groupByDay = dimensions.includes('date');
        const groupByInstructor = dimensions.includes('instructor');

        // REVENUE METRIC
        if (metrics.includes('revenue')) {
            // POS Revenue
            const posQuery = this.db.select({
                amount: posOrders.totalAmount,
                date: posOrders.createdAt
            })
                .from(posOrders)
                .where(and(
                    eq(posOrders.tenantId, this.tenantId),
                    between(posOrders.createdAt, filters.startDate, filters.endDate),
                    eq(posOrders.status, 'completed')
                ));

            // Pack Revenue
            const packQuery = this.db.select({
                amount: purchasedPacks.price,
                date: purchasedPacks.createdAt
            })
                .from(purchasedPacks)
                .where(and(
                    eq(purchasedPacks.tenantId, this.tenantId),
                    between(purchasedPacks.createdAt, filters.startDate, filters.endDate)
                ));

            const [pos, packs] = await Promise.all([posQuery.all(), packQuery.all()]);

            // Aggregation
            let totalRevenue = 0;
            const dataMap = new Map<string, number>();

            [...pos, ...packs].forEach(item => {
                totalRevenue += item.amount || 0;
                if (groupByDay) {
                    const key = new Date(item.date || '').toISOString().split('T')[0];
                    dataMap.set(key, (dataMap.get(key) || 0) + (item.amount || 0));
                }
            });

            result.summary.revenue = totalRevenue / 100;

            if (groupByDay) {
                // Merge into chartData
                // Initialize map if needed
                if (!result.chartData.length) {
                    const cursor = new Date(filters.startDate);
                    while (cursor <= filters.endDate) {
                        const key = cursor.toISOString().split('T')[0];
                        result.chartData.push({ name: key, revenue: 0 });
                        cursor.setDate(cursor.getDate() + 1);
                    }
                }

                result.chartData = result.chartData.map((d: any) => ({
                    ...d,
                    revenue: (dataMap.get(d.name) || 0) / 100
                }));
            }
        }

        // ATTENDANCE METRIC
        if (metrics.includes('attendance')) {
            const conditions = [
                eq(classes.tenantId, this.tenantId),
                between(classes.startTime, filters.startDate, filters.endDate),
                eq(bookings.status, 'confirmed')
            ];

            if (filters.instructorId) {
                conditions.push(eq(classes.instructorId, filters.instructorId));
            }

            const query = this.db.select({
                id: bookings.id,
                date: classes.startTime,
                instructorId: classes.instructorId,
                // We'll join users to get instructor name if needed, but often ID is enough for aggregation,
                // or we join here. Let's do a simple join to get name if grouping.
                firstName: users.profile, // We need to parse profile JSON or just get ID. 
                // Creating a proper join for name is better.
            })
                .from(bookings)
                .innerJoin(classes, eq(bookings.classId, classes.id))
                .where(and(...conditions));

            const filteredData = await query.all();

            result.summary.attendance = filteredData.length;

            if (groupByDay) {
                const dataMap = new Map<string, number>();
                filteredData.forEach(item => {
                    const key = new Date(item.date).toISOString().split('T')[0];
                    dataMap.set(key, (dataMap.get(key) || 0) + 1);
                });

                // Merge
                if (!result.chartData.length) {
                    const cursor = new Date(filters.startDate);
                    while (cursor <= filters.endDate) {
                        const key = cursor.toISOString().split('T')[0];
                        result.chartData.push({ name: key, attendance: 0 });
                        cursor.setDate(cursor.getDate() + 1);
                    }
                }

                result.chartData = result.chartData.map((d: any) => ({
                    ...d,
                    attendance: (dataMap.get(d.name) || 0)
                }));
            } else if (groupByInstructor) {
                // Fetch instructor names for enrichment
                // This is a bit inefficient (N+1-ish) but for a report on filtered data usually fine. 
                // Better to group in SQL but profile is JSON.
                // Let's aggregate in memory.
                const instructorMap = new Map<string, number>();
                filteredData.forEach(item => {
                    const key = item.instructorId || 'Unassigned';
                    instructorMap.set(key, (instructorMap.get(key) || 0) + 1);
                });

                // Resolve Names
                const instructorIds = Array.from(instructorMap.keys()).filter(id => id !== 'Unassigned');
                let names: Record<string, string> = {};

                if (instructorIds.length > 0) {
                    // We need to import 'inArray'
                    // For now, simpler to just map IDs to names if we can.
                    // Or return IDs and let frontend resolve? 
                    // Frontend likely expects names for chart.
                    // Let's do a quick fetch.
                    const instructors = await this.db.select({ id: users.id, profile: users.profile, email: users.email }).from(users).where(inArray(users.id, instructorIds)).all();
                    instructors.forEach(u => {
                        const p = u.profile as any || {};
                        names[u.id] = (p.firstName && p.lastName) ? `${p.firstName} ${p.lastName}` : (u.email || 'Unknown');
                    });
                }

                result.chartData = Array.from(instructorMap.entries()).map(([id, count]) => ({
                    name: names[id] || (id === 'Unassigned' ? 'Unassigned' : 'Unknown'),
                    attendance: count
                })).sort((a, b) => b.attendance - a.attendance);
            }
        }

        // NEW SIGNUPS METRIC
        if (metrics.includes('new_signups')) {
            const memberQuery = this.db.select({
                id: tenantMembers.id,
                joinedAt: tenantMembers.joinedAt
            })
                .from(tenantMembers)
                .where(and(
                    eq(tenantMembers.tenantId, this.tenantId),
                    between(tenantMembers.joinedAt, filters.startDate, filters.endDate)
                ));

            const members = await memberQuery.all();
            result.summary.new_signups = members.length;

            if (groupByDay) {
                const dataMap = new Map<string, number>();
                members.forEach(m => {
                    const key = new Date(m.joinedAt || '').toISOString().split('T')[0];
                    dataMap.set(key, (dataMap.get(key) || 0) + 1);
                });

                // Merge
                if (!result.chartData.length) {
                    const cursor = new Date(filters.startDate);
                    while (cursor <= filters.endDate) {
                        const key = cursor.toISOString().split('T')[0];
                        result.chartData.push({ name: key, new_signups: 0 });
                        cursor.setDate(cursor.getDate() + 1);
                    }
                }

                result.chartData = result.chartData.map((d: any) => ({
                    ...d,
                    new_signups: (dataMap.get(d.name) || 0)
                }));
            }
        }

        // CSV EXPORT LOGIC
        // If a special 'format' option was passed (need to pass it in options first)
        // Since the user asked for CSV, and I need to return string.
        // I will rely on the caller to output CSV, OR I can handle it here if I change the signature/return type.
        // Let's assume the router handles format check, but I provide a specific method or return data structure that helps.
        // Actually, `result.chartData` is an array of objects which is easy to convert to CSV.

        return result;
    }

    // Helper for CSV output
    generateCsv(data: any[], metrics: string[]) {
        if (!data || data.length === 0) return '';
        const headers = ['Date', ...metrics].join(',');
        const rows = data.map(row => {
            return [
                row.name,
                ...metrics.map(m => row[m] || 0)
            ].join(',');
        }).join('\n');
        return `${headers}\n${rows}`;
    }

    async generateEmailSummary(reportType: 'revenue' | 'attendance' | 'journal') {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7); // Default to last 7 days for summary

        if (reportType === 'revenue') {
            const data = await this.getRevenue(start, end);
            return `
                <h2 style="color: #111827;">Revenue Summary</h2>
                <p style="font-size: 24px; font-weight: bold; color: #059669;">$${(data.grossVolume / 100).toFixed(2)}</p>
                <p style="color: #6B7280; font-size: 14px;">Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                <ul style="color: #374151; font-size: 14px; padding-left: 20px;">
                    <li>Retail: $${(data.breakdown.retail / 100).toFixed(2)}</li>
                    <li>Packs: $${(data.breakdown.packs / 100).toFixed(2)}</li>
                    <li>MRR: $${(data.mrr / 100).toFixed(2)}</li>
                </ul>
            `;
        } else if (reportType === 'attendance') {
            const data = await this.getAttendance(start, end);
            return `
                <h2 style="color: #111827;">Attendance Summary</h2>
                <p style="font-size: 24px; font-weight: bold; color: #2563EB;">${data.totalBookings} Bookings</p>
                <p style="color: #6B7280; font-size: 14px;">Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                <ul style="color: #374151; font-size: 14px; padding-left: 20px;">
                    <li>Check-ins: ${data.totalCheckins} (${((data.totalCheckins / (data.totalBookings || 1)) * 100).toFixed(0)}%)</li>
                    <li>Top Class: ${data.topClasses[0]?.title || 'N/A'} (${data.topClasses[0]?.attendees || 0} attendees)</li>
                </ul>
            `;
        } else if (reportType === 'journal') {
            const data = await this.getJournal(start, end, 'json', 'USD') as any[];
            const debits = data.reduce((sum, item) => sum + (item.debit || 0), 0);
            const credits = data.reduce((sum, item) => sum + (item.credit || 0), 0);
            return `
                <h2 style="color: #111827;">Accounting Journal Summary</h2>
                <p style="color: #6B7280; font-size: 14px;">Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                <div style="background: #F9FAFB; padding: 15px; border-radius: 8px;">
                     <p style="margin: 0; font-size: 14px;"><strong>Total Debits:</strong> $${debits.toFixed(2)}</p>
                     <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Total Credits:</strong> $${credits.toFixed(2)}</p>
                </div>
                <p style="font-size: 12px; color: #9CA3AF; margin-top: 10px;">Login to the platform to download the full CSV export.</p>
            `;
        }
        return `<p>Report summary generated.</p>`;
    }
}
