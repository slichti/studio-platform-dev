import { createDb } from '../db';
import { tenants, users, tenantMembers, membershipPlans, subscriptions, classes, usageLogs } from 'db/src/schema';
import { eq, and, desc } from 'drizzle-orm';
import Papa from 'papaparse';

export class ExportService {
    constructor(private db: ReturnType<typeof createDb>, private tenantId: string) { }

    async generateExport(type: 'subscribers' | 'financials' | 'products' | 'classes' | 'memberships' | 'vod'): Promise<{ filename: string, csv: string }> {
        switch (type) {
            case 'subscribers':
                return this.exportSubscribers();
            case 'financials':
                return this.exportFinancials();
            case 'products':
                return this.exportProducts();
            case 'classes':
                return this.exportClasses();
            case 'memberships':
                return this.exportFinancials(); // Alias for now, or use exportMemberships if we differ the view
            case 'vod':
                return this.exportVodConsumption();
            default:
                throw new Error("Invalid export type");
        }
    }

    private async exportSubscribers() {
        const members = await this.db.query.tenantMembers.findMany({
            where: eq(tenantMembers.tenantId, this.tenantId),
            with: {
                user: true
            }
        });

        const data = members.map((m: any) => ({
            MemberID: m.id,
            Status: m.status,
            JoinedDate: m.joinedAt ? new Date(m.joinedAt).toISOString() : '',
            ExtMemberId: m.externalMemberId || '',
            FirstName: m.user?.profile?.firstName || '',
            LastName: m.user?.profile?.lastName || '',
            Email: m.user?.email || '',
            Phone: m.user?.phone || '',
            Address: typeof m.user?.address === 'string' ? m.user?.address : JSON.stringify(m.user?.address || {}),
        }));

        const csv = Papa.unparse(data);
        return { filename: `subscribers_${this.tenantId}_${Date.now()}.csv`, csv };
    }

    private async exportFinancials() {
        // Exports Subscriptions (revenue source)
        const subs = await this.db.query.subscriptions.findMany({
            where: eq(subscriptions.tenantId, this.tenantId),
            with: {
                user: true,
                plan: true
            }
        });

        const data = subs.map((s: any) => ({
            SubscriptionID: s.id,
            UserEmail: s.user?.email,
            PlanName: s.plan?.title,
            Status: s.status,
            Interval: s.plan?.interval,
            Amount: (s.plan?.price || 0) / 100,
            Currency: s.plan?.currency || 'usd',
            CurrentPeriodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString() : '',
            Created: s.createdAt ? new Date(s.createdAt).toISOString() : ''
        }));

        const csv = Papa.unparse(data);
        return { filename: `financials_subscriptions_${this.tenantId}_${Date.now()}.csv`, csv };
    }

    private async exportProducts() {
        const plans = await this.db.select().from(membershipPlans).where(eq(membershipPlans.tenantId, this.tenantId)).all();

        const data = plans.map((p: any) => ({
            PlanID: p.id,
            Title: p.title,
            Price: p.price,
            Interval: p.interval,
            Type: 'membership_plan',
            Active: p.active
        }));

        const csv = Papa.unparse(data);
        return { filename: `products_plans_${this.tenantId}_${Date.now()}.csv`, csv };
    }

    private async exportClasses() {
        const classList = await this.db.query.classes.findMany({
            where: eq(classes.tenantId, this.tenantId),
            orderBy: desc(classes.startTime)
        });

        const data = classList.map((c: any) => ({
            ClassID: c.id,
            Title: c.title,
            StartTime: c.startTime ? new Date(c.startTime).toISOString() : '',
            Duration: c.durationMinutes,
            Capacity: c.capacity,
            Status: c.status,
            InstructorID: c.instructorId
        }));

        const csv = Papa.unparse(data);
        return { filename: `classes_${this.tenantId}_${Date.now()}.csv`, csv };
    }

    private async exportVodConsumption() {
        // Fetch usage logs for VOD metrics
        // In sqlite, `or` condition needed for multiple metrics
        // I will just fetch all logs for this tenant and filter in JS if needed, or query specifically.
        // Actually, `pkg/db` schema exports usually don't include logic.
        // Let's rely on standard `findMany` with `inArray` if possible?
        // simple `eq` on metric if I do separate reports or fetch all.
        // Let's fetch 'vod_storage' and 'vod_minutes'.

        const logs = await this.db.select().from(usageLogs)
            .where(and(
                eq(usageLogs.tenantId, this.tenantId),
                // sql`metric IN ('vod_storage', 'vod_minutes', 'streaming_usage')`
            ))
            .orderBy(desc(usageLogs.timestamp))
            .all();

        // Filter for VOD related
        const vodLogs = logs.filter((l: any) => ['vod_storage', 'vod_minutes', 'streaming_usage', 'vod_storage_gb'].includes(l.metric));

        const data = vodLogs.map((l: any) => ({
            LogID: l.id,
            Metric: l.metric,
            Value: l.value,
            Timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : '',
            Meta: l.meta ? JSON.stringify(l.meta) : ''
        }));

        const csv = Papa.unparse(data);
        return { filename: `vod_usage_${this.tenantId}_${Date.now()}.csv`, csv };
    }
}
