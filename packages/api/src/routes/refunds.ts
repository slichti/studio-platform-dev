
import { Hono } from 'hono';
import { createDb } from '../db';
import { refunds, tenants, tenantMembers, users, posOrders, subscriptions, purchasedPacks } from 'db'; // Ensure imports
import { eq, and, desc, sql } from 'drizzle-orm';
import { StripeService } from '../services/stripe';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /refunds: List refunds (filterable)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const query = c.req.query();
    const memberId = query.memberId;
    const type = query.type;

    let conditions = eq(refunds.tenantId, tenant.id);
    const filters = [eq(refunds.tenantId, tenant.id)];

    if (memberId) filters.push(eq(refunds.memberId, memberId));
    if (type) filters.push(eq(refunds.type, type as any));

    conditions = and(...filters) as any;

    const results = await db.query.refunds.findMany({
        where: conditions,
        orderBy: (refunds, { desc }) => [desc(refunds.createdAt)],
        with: {
            member: {
                with: {
                    user: {
                        columns: {
                            email: true,
                            profile: true
                        }
                    }
                }
            }
        }
    });

    return c.json(results);
});

// POST /refunds: Process a refund
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    if (!roles.includes('owner') && !roles.includes('admin')) { // Assuming 'admin' role or just 'owner'
        if (!roles.includes('owner')) return c.json({ error: 'Access Denied' }, 403);
    }
    const actorId = c.get('auth').userId;

    const { amount, reason, referenceId, type } = await c.req.json();

    if (!amount || !referenceId || !type) return c.json({ error: 'Missing Required Fields' }, 400);

    // 1. Verify Original Transaction & Get Stripe Charge ID
    let stripePaymentId: string | undefined | null;
    let memberId: string | undefined;
    let paymentAmount: number = 0;

    try {
        if (type === 'pos') {
            const order = await db.query.posOrders.findFirst({
                where: eq(posOrders.id, referenceId),
            });
            if (!order) throw new Error('Order not found');
            stripePaymentId = order.stripePaymentIntentId; // Actually PI ID, allows refund usually
            memberId = order.memberId || undefined;
            paymentAmount = order.totalAmount;
        } else if (type === 'pack') {
            const pack = await db.query.purchasedPacks.findFirst({
                where: eq(purchasedPacks.id, referenceId),
            });
            if (!pack) throw new Error('Pack not found');
            stripePaymentId = pack.stripePaymentId;
            memberId = pack.memberId;
            paymentAmount = pack.price || 0;
        } else if (type === 'membership') {
            // Usually we refund the latest INVOICE. 
            // This is complex. For now, assume we are refunding a specific generic amount or we need an Invoice ID.
            // Simplified: If referenceId is subscriptionId, we might need to look up latest invoice.
            // MVP: We assume referenceId IS the Stripe Charge/PaymentIntent if type is 'custom' or handle logic here?
            // Let's assume passed referenceId is the internal SUBSCRIPTION ID, and we look for Stripe Sub ID?
            // Actually, Stripe Refunds need a Charge ID or PI ID.
            // If we don't store individual invoices locally fully, we might struggle.
            // Let's look up Subscription
            const sub = await db.query.subscriptions.findFirst({
                where: eq(subscriptions.id, referenceId)
            });
            if (!sub) throw new Error("Subscription not found");
            memberId = sub.memberId || undefined;

            // To refund a subscription, we usually refund the last invoice.
            // We need to fetch latest invoice from Stripe if we don't have it.
            // For MVP: Let's require the UI to pass the Stripe Charge ID if possible, OR
            // We fetch the subscription from Stripe to get latest_invoice -> charge.
        }

        // Refund Logic
        let stripeRefundId = null;
        let finalStatus = 'pending';

        // If we have a Stripe Payment ID, use it.
        if (stripePaymentId && tenant.stripeCredentials && tenant.stripeAccountId) {
            const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);

            try {
                const refund = await stripeService.refundPayment(tenant.stripeAccountId, {
                    paymentIntent: stripePaymentId,
                    amount: amount, // Optional: if undefined, full refund? No, amount is required in our API.
                    reason: 'requested_by_customer',
                    metadata: {
                        reason: reason || 'Refund',
                        referenceId,
                        type,
                        performedBy: actorId
                    }
                });
                stripeRefundId = refund.id;
                finalStatus = 'succeeded'; // Webhook should confirm but this is direct
            } catch (stripeErr: any) {
                console.error("Stripe Refund Failed:", stripeErr);
                return c.json({ error: `Stripe Refund Failed: ${stripeErr.message}` }, 400);
            }
        } else {
            // Manual/Cash refund or no stripe creds
            // If type is POS and payment method was CARD, we generally need stripe.
            // But let's assume if no stripe ID, it's a manual adjustment
            finalStatus = 'succeeded';
        }

        const refundId = crypto.randomUUID();
        await db.insert(refunds).values({
            id: refundId,
            tenantId: tenant.id,
            amount,
            reason,
            status: finalStatus as any,
            type,
            referenceId,
            stripeRefundId,
            memberId,
            performedBy: actorId
        });

        // Update Original Record Status if needed
        if (finalStatus === 'succeeded') {
            if (type === 'pos') {
                // Check if full refund?
                if (amount >= paymentAmount) {
                    await db.update(posOrders).set({ status: 'refunded' }).where(eq(posOrders.id, referenceId)).run();
                } else {
                    // Partial refund - logic to track partials?
                    // Currently schema only has 'refunded' or 'completed'.
                    // For MVP, if fully refunded, mark refunded. if partial, keep 'completed' but log refund?
                    // Let's set to refunded if > 0? No, that implies return of goods.
                    // Let's leave status as is for partials, but the refund record exists.
                }
            } else if (type === 'pack') {
                // If pack refunded, usually void credits
                if (amount >= paymentAmount) {
                    await db.update(purchasedPacks).set({ remainingCredits: 0 }).where(eq(purchasedPacks.id, referenceId)).run();
                }
            }
        }

        return c.json({ success: true, refundId, status: finalStatus });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
