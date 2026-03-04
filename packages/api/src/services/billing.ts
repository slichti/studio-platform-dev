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
        const { subscription, overages, totalRevenue } = await usageService.calculateBillableUsage() as any;

        if (totalRevenue <= 0) return { total: 0, items: [] };

        // Get Tenant Stripe Customer ID (Platform Level)
        const tenant = await this.db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
        if (!tenant) return { error: 'Tenant not found', total: totalRevenue };

        let customerId = tenant.stripeCustomerId;
        if (!customerId) {
            console.log(`Creating new Stripe customer for tenant ${tenant.name} (${tenantId})...`);
            try {
                // Try to find the owner's email
                const { tenantMembers, tenantRoles, users } = await import('@studio/db/src/schema');
                const owner = await this.db.select({ email: users.email })
                    .from(tenantMembers)
                    .innerJoin(users, eq(tenantMembers.userId, users.id))
                    .innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
                    .where(eq(tenantMembers.tenantId, tenantId))
                    .where(eq(tenantRoles.role, 'owner'))
                    .get();

                const customer = await this.stripe.createCustomer({
                    email: owner?.email || `admin@${tenant.slug}.com`,
                    name: tenant.name,
                    metadata: { tenantId }
                });
                customerId = customer.id;
                // Save back to DB
                await this.db.update(tenants)
                    .set({ stripeCustomerId: customerId })
                    .where(eq(tenants.id, tenantId))
                    .run();
            } catch (stripeErr: any) {
                console.error(`Failed to create Stripe customer for ${tenantId}:`, stripeErr);
                return { error: `Stripe Customer Creation Failed: ${stripeErr.message}`, total: totalRevenue };
            }
        }

        const itemsCreated = [];

        // 1. Create Invoice Item for Base Subscription (if > 0)
        const subAmountCents = Math.round(subscription.amount * 100);
        if (subAmountCents > 0) {
            const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
            const subDesc = `Platform Subscription: ${subscription.name} - ${currentMonth}`;
            await this.createInvoiceItem(customerId, subAmountCents, subDesc);
            itemsCreated.push({ key: 'subscription', amountCents: subAmountCents, desc: subDesc });
        }

        // 2. Create Invoice Items for Overages
        for (const [key, cost] of Object.entries(overages) as [string, any][]) {
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
                const metricLabel = key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
                const desc = `Usage Overage: ${metricLabel} Service`;
                await this.createInvoiceItem(customerId, amountCents, desc);
                itemsCreated.push({ key, amountCents, desc });
            }
        }

        // Update lastBilledAt
        await this.db.update(tenants)
            .set({ lastBilledAt: new Date() })
            .where(eq(tenants.id, tenantId))
            .run();

        // 3. Create and Finalize the Invoice to trigger payment & receipt
        try {
            const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
            console.log(`Finalizing invoice for customer ${customerId}...`);

            const invoice = await this.stripe.createInvoice(customerId, {
                description: `Studio Platform Subscription & Usage - ${currentMonth}`,
                metadata: {
                    tenantId,
                    billingPeriod: currentMonth
                }
            });
            await this.stripe.finalizeInvoice(invoice.id);
            return { total: totalRevenue, items: itemsCreated, invoiceId: invoice.id };
        } catch (invErr: any) {
            console.error(`Failed to finalize invoice for ${tenantId}:`, invErr);
            return { total: totalRevenue, items: itemsCreated, error: `Invoice Finalization Failed: ${invErr.message}` };
        }
    }
}
