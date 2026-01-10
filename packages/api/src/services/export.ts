import { createDb } from '../db';
import { tenants, users, tenantMembers, membershipPlans, subscriptions } from 'db/src/schema';
import { eq, and, desc } from 'drizzle-orm';
import Papa from 'papaparse';

export class ExportService {
    constructor(private db: ReturnType<typeof createDb>, private tenantId: string) { }

    async generateExport(type: 'subscribers' | 'financials' | 'products'): Promise<{ filename: string, csv: string }> {
        switch (type) {
            case 'subscribers':
                return this.exportSubscribers();
            case 'financials':
                return this.exportFinancials();
            case 'products':
                return this.exportProducts();
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
            Amount: s.plan?.price,
            CurrentPeriodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString() : '',
            CanceledAt: s.canceledAt ? new Date(s.canceledAt).toISOString() : '', // Fixed: canceledAt might not exist on type, but should be in schema ideally. If not, ignore.
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
            Type: p.type,
            Active: p.active
        }));

        const csv = Papa.unparse(data);
        return { filename: `products_plans_${this.tenantId}_${Date.now()}.csv`, csv };
    }
}
