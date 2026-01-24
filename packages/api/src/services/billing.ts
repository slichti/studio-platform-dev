import { StripeService } from './stripe';
import { UsageService } from './pricing';
import { tenants } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';
import { createDb } from '../db'; // Assuming access to db factory or we pass it in

export class BillingService {
    private db: any;
    private stripe: StripeService;

    constructor(db: any, stripeApiKey: string) {
        this.db = db;
        this.stripe = new StripeService(stripeApiKey);
    }

    async createInvoiceItem(customerId: string, amount: number, description: string, currency: string = 'usd', metadata?: any) {
        // Stripe API: Invoice Items are pending until next invoice
        // We use StripeService helper if it existed, or direct client access
        // StripeService doesn't have createInvoiceItem, let's add it or use raw client
        // Since StripeService is a wrapper, we might need to expose client or add method
        // Let's check StripeService capabilities or extend it.
        // For now, I'll access the client via a new method in StripeService or cast it?
        // Better: Add createInvoiceItem to StripeService.
        // But I am in BillingService file. I should update StripeService first?
        // Or I can just instantiate Stripe client here if I had the key?
        // StripeService takes the key in constructor.

        // Let's UPDATE StripeService to support invoice items first?
        // OR simpler: use the StripeService instance if I can access the client.
        // StripeService has private `stripe`.

        // I will update StripeService to have `createInvoiceItem`.
        return this.stripe.createInvoiceItem(customerId, {
            amount,
            currency,
            description,
            metadata
        });
    }

    async syncUsageToStripe(tenantId: string) {
        const usageService = new UsageService(this.db, tenantId);
        const { costs, total } = await usageService.calculateBillableUsage() as any;

        if (total <= 0) return { total: 0, items: [] };

        // Get Tenant Stripe Customer ID (Platform Level)
        // Tenant table has `stripeCustomerId`.
        const tenant = await this.db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
        if (!tenant || !tenant.stripeCustomerId) {
            console.error(`Tenant ${tenantId} has no Platform Stripe Customer ID. Cannot bill.`);
            return { error: 'No Stripe Customer', total };
        }

        const itemsCreated = [];

        // Create Invoice Items
        for (const [key, cost] of Object.entries(costs) as [string, any][]) {
            const amountCents = Math.round(cost.amount * 100); // Cost is in dollars/cents?
            // PricingService unit costs: 0.0075 (Dollars?)
            // Usually Stripe takes integer cents.
            // If unit cost is 0.0075 USD, that is 0.75 cents.
            // We should sum up and round? Or round each item?
            // Let's assume Unit Costs are in DOLLARS in `pricing.ts`?
            // "price: 0" in TIERSConfig says "Monthly in cents" (line 9).
            // But UNIT_COSTS?
            // "0.0075" looks like dollars (less than a cent).
            // "streaming: 0.05" -> 5 cents?
            // "storage: 0.02" -> 2 cents?
            // If it was cents, 0.0075 cents is tiny.
            // Let's assume UNIT COSTS are DOLLARS.

            if (amountCents > 0) {
                const desc = `Overage: ${key.charAt(0).toUpperCase() + key.slice(1)} (${cost.quantity} units)`;
                await this.createInvoiceItem(tenant.stripeCustomerId, amountCents, desc);
                itemsCreated.push({ key, amountCents, desc });
            }
        }

        // Update lastBilledAt
        await this.db.update(tenants)
            .set({ lastBilledAt: new Date() })
            .where(eq(tenants.id, tenantId))
            .run();

        return { total, items: itemsCreated };
    }
}
