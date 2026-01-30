import { Hono } from 'hono';
import { createDb } from '../db';
import { refunds, posOrders, purchasedPacks, subscriptions } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { StripeService } from '../services/stripe';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /refunds
app.get('/', async (c) => {
    if (!c.get('can')('view_commerce') && !c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const { memberId, type } = c.req.query();
    const filters = [eq(refunds.tenantId, tenant.id)];
    if (memberId) filters.push(eq(refunds.memberId, memberId));
    if (type) filters.push(eq(refunds.type, type as any));

    const results = await db.query.refunds.findMany({
        where: and(...filters),
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        with: { member: { with: { user: { columns: { email: true, profile: true } } } } }
    });
    return c.json(results);
});

// POST /refunds
app.post('/', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Access Denied' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const auth = c.get('auth');
    if (!tenant || !auth?.userId) return c.json({ error: 'Context missing' }, 400);

    const { amount, reason, referenceId, type } = await c.req.json();
    if (!amount || !referenceId || !type) return c.json({ error: 'Missing fields' }, 400);

    let stripeId: string | undefined | null, memberId: string | undefined, payAmt = 0;

    try {
        if (type === 'pos') {
            const o = await db.query.posOrders.findFirst({ where: eq(posOrders.id, referenceId) });
            if (!o) throw new Error('Order not found');
            stripeId = o.stripePaymentIntentId; memberId = o.memberId || undefined; payAmt = o.totalAmount;
        } else if (type === 'pack') {
            const p = await db.query.purchasedPacks.findFirst({ where: eq(purchasedPacks.id, referenceId) });
            if (!p) throw new Error('Pack not found');
            stripeId = p.stripePaymentId; memberId = p.memberId; payAmt = p.price || 0;
        } else if (type === 'membership') {
            const s = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, referenceId) });
            if (!s) throw new Error("Sub not found");
            memberId = s.memberId || undefined;
            // Subscription refund logic... usually needs Stripe Invoice ID which isn't always direct in referenceId
        }

        let refId = null, finalStatus = 'pending';
        if (stripeId && tenant.stripeAccountId) {
            const s = new StripeService(c.env.STRIPE_SECRET_KEY);
            const r = await s.refundPayment(tenant.stripeAccountId, { paymentIntent: stripeId, amount, reason: 'requested_by_customer', metadata: { reason: reason || 'Refund', referenceId, type, performedBy: auth.userId } });
            refId = r.id; finalStatus = 'succeeded';
        } else {
            finalStatus = 'succeeded';
        }

        const refundId = crypto.randomUUID();
        await db.insert(refunds).values({ id: refundId, tenantId: tenant.id, amount, reason, status: finalStatus as any, type, referenceId, stripeRefundId: refId, memberId, performedBy: auth.userId });

        if (finalStatus === 'succeeded') {
            if (type === 'pos' && amount >= payAmt) await db.update(posOrders).set({ status: 'refunded' }).where(eq(posOrders.id, referenceId)).run();
            else if (type === 'pack' && amount >= payAmt) await db.update(purchasedPacks).set({ remainingCredits: 0 }).where(eq(purchasedPacks.id, referenceId)).run();
        }
        return c.json({ success: true, refundId, status: finalStatus });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
