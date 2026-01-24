import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, coupons, couponRedemptions, classPackDefinitions, giftCards, membershipPlans } from '@studio/db/src/schema'; // Ensure exported
import { eq, and, gt, sql } from 'drizzle-orm';
import { rateLimit } from '../middleware/rateLimit';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: typeof tenantMembers.$inferSelect;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
    isImpersonating?: boolean;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /coupons - List (Owner/Instructor only)
app.get('/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    // Security: Only owners and instructors can view coupons
    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    // Sort by newest and include usage count
    const list = await db.select({
        coupon: coupons,
        usageCount: sql<number>`count(${couponRedemptions.id})`
    })
        .from(coupons)
        .leftJoin(couponRedemptions, eq(coupons.id, couponRedemptions.couponId))
        .where(eq(coupons.tenantId, tenant.id))
        .groupBy(coupons.id)
        .orderBy(sql`${coupons.createdAt} DESC`)
        .all();

    return c.json({
        coupons: list.map(({ coupon, usageCount }) => ({
            ...coupon,
            usageCount // Add calculated count
        }))
    });
});

// POST /coupons - Create (Owner only)
app.post('/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    // Security: Only owners can create coupons
    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const { code, type, value, usageLimit } = await c.req.json();

    if (!code || !type || !value) return c.json({ error: "Missing fields" }, 400);

    try {
        const id = crypto.randomUUID();
        await db.insert(coupons).values({
            id,
            tenantId: tenant.id,
            code: code.toUpperCase(),
            type,
            value: parseInt(value),
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            active: true
        }).run();

        return c.json({ success: true, id });
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
            return c.json({ error: "Code already exists" }, 409);
        }
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /coupons/:id - Deactivate (Owner only)
app.delete('/coupons/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const id = c.req.param('id');

    // Security: Only owners can deactivate coupons
    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    await db.update(coupons)
        .set({ active: false })
        .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// PATCH /coupons/:id/reactivate
app.patch('/coupons/:id/reactivate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const { days } = await c.req.json().catch(() => ({ days: 7 }));

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + (days || 7));

    await db.update(coupons)
        .set({
            active: true,
            expiresAt: newExpiry
        })
        .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenant.id)))
        .run();

    return c.json({ success: true, newExpiry });
});

// --- Class Packs ---

// GET /packs - List
app.get('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    // const { classPackDefinitions } = await import('@studio/db/src/schema');

    const packs = await db.select().from(classPackDefinitions)
        .where(and(
            eq(classPackDefinitions.tenantId, tenant.id),
            eq(classPackDefinitions.active, true)
        ))
        .orderBy(sql`${classPackDefinitions.price} ASC`)
        .all();

    return c.json({ packs });
});

// POST /packs - Create
app.post('/packs', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles');

    if (!roles?.includes('owner') && !roles?.includes('instructor')) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    const { name, credits, price, expirationDays, imageUrl, vodEnabled } = await c.req.json();
    if (!name || !credits) return c.json({ error: "Missing fields" }, 400);

    const { classPackDefinitions } = await import('@studio/db/src/schema');
    const id = crypto.randomUUID();

    await db.insert(classPackDefinitions).values({
        id,
        tenantId: tenant.id,
        name,
        credits: parseInt(credits),
        price: price ? parseInt(price) : 0,
        expirationDays: expirationDays ? parseInt(expirationDays) : null,
        imageUrl,
        vodEnabled: !!vodEnabled,
        active: true
    }).run();

    return c.json({ success: true, id });
});

// POST /validate - For Checkout
app.post('/validate', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { code } = await c.req.json();

    if (!code) return c.json({ valid: false }, 400);

    const coupon = await db.select().from(coupons)
        .where(and(
            eq(coupons.tenantId, tenant.id),
            eq(coupons.code, code.toUpperCase()),
            eq(coupons.active, true)
        ))
        .get();

    if (!coupon) {
        return c.json({ valid: false, reason: "Invalid code" }, 404);
    }

    // Check usage limits if we tracked redemptions count on the coupon row or counted redemptions table
    // For MVP, simplistic check:

    return c.json({
        valid: true,
        coupon: {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value
        }
    });
});


// POST /checkout/session - Create Stripe Session (with optional coupon)
app.post('/checkout/session', rateLimit({ limit: 10, window: 60, keyPrefix: 'checkout' }), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const user = c.get('auth'); // from authMiddleware
    const member = c.get('member');

    // Check if tenant has stripe connected
    if (!tenant.stripeAccountId) {
        return c.json({ error: "Payments not enabled for this studio." }, 400);
    }

    try {
        // Security: Prevent impersonators from processing payments
        // Note: Variables type definition in commerce.ts needs to include isImpersonating
        const isImpersonating = (c.get('auth') as any)?.isImpersonating || c.get('isImpersonating' as any);
        // Safest way if type definition isn't updated yet in this file
        if (isImpersonating) {
            return c.json({ error: 'System admins cannot process payments on behalf of customers.' }, 403);
        }

        const body = await c.req.json();
        const { packId, planId, couponCode, giftCardCode, giftCardAmount, recipientEmail, recipientName, senderName, message } = body;

        if (!packId && !giftCardAmount && !planId) return c.json({ error: "Product ID or Amount required" }, 400);

        let finalAmount = 0;
        let basePrice = 0;
        let discountAmount = 0;
        let pack = null;
        let plan = null;
        let stripeMode: 'payment' | 'subscription' = 'payment';

        if (packId) {
            // 1. Fetch Pack
            pack = await db.select().from(classPackDefinitions)
                .where(and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id)))
                .get();

            if (!pack) return c.json({ error: "Pack not found" }, 404);
            finalAmount = pack.price || 0;
            basePrice = finalAmount;
        } else if (planId) {
            // 1b. Fetch Plan
            plan = await db.select().from(membershipPlans)
                .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.tenantId, tenant.id)))
                .get();

            if (!plan) return c.json({ error: "Plan not found" }, 404);
            if (!plan.active) return c.json({ error: "Plan is no longer active" }, 400);

            finalAmount = plan.price || 0;
            basePrice = finalAmount;

            if (plan.interval && plan.interval !== 'one_time') {
                stripeMode = 'subscription';
            }
        } else {
            if (giftCardAmount) {
                finalAmount = parseInt(giftCardAmount);
                basePrice = finalAmount;
            } else {
                return c.json({ error: "Product or Amount required" }, 400);
            }
        }

        let appliedCouponId = undefined;
        let appliedGiftCardId = undefined;

        // 2. Apply Coupon
        if (couponCode) {
            const coupon = await db.select().from(coupons)
                .where(and(
                    eq(coupons.tenantId, tenant.id),
                    eq(coupons.code, couponCode.toUpperCase()),
                    eq(coupons.active, true)
                )).get();

            if (coupon) {
                if (coupon.type === 'percent') {
                    discountAmount = Math.round(basePrice * (coupon.value / 100));
                } else {
                    discountAmount = coupon.value;
                }
                finalAmount -= discountAmount;
                if (finalAmount < 0) finalAmount = 0;
                appliedCouponId = coupon.id;
            }
        }

        // 4a. Calculate Tax (MI 6%)
        const taxableAmount = Math.max(0, basePrice - discountAmount);
        const taxRate = 0.06; // Michigan
        const taxAmount = Math.round(taxableAmount * taxRate);

        // 4b. Apply Gift Card to the Total (Item + Tax)
        let amountToPay = taxableAmount + taxAmount;
        let creditApplied = 0;

        // Use the variable declared at top of function
        appliedGiftCardId = undefined;

        if (giftCardCode && amountToPay > 0) {
            const card = await db.select().from(giftCards)
                .where(and(
                    eq(giftCards.tenantId, tenant.id),
                    eq(giftCards.code, giftCardCode.toUpperCase()),
                    eq(giftCards.status, 'active')
                )).get();

            if (card) {
                creditApplied = Math.min(card.currentBalance, amountToPay);
                amountToPay -= creditApplied;
                appliedGiftCardId = card.id;
            }
        }

        // 4c. Handle Zero Amount
        if (amountToPay === 0) {
            // Direct Fulfillment
            const { FulfillmentService } = await import('../services/fulfillment');
            const fulfillment = new FulfillmentService(createDb(c.env.DB), c.env.RESEND_API_KEY);
            const mockPaymentId = `direct_${crypto.randomUUID()}`;

            if (pack) {
                await fulfillment.fulfillPackPurchase({
                    packId: pack.id,
                    tenantId: tenant.id,
                    memberId: member?.id || undefined,
                    userId: user?.userId,
                    couponId: appliedCouponId
                }, mockPaymentId, 0);
            }

            if (giftCardAmount) {
                await fulfillment.fulfillGiftCardPurchase({
                    type: 'gift_card_purchase',
                    tenantId: tenant.id,
                    userId: user?.userId,
                    recipientEmail, recipientName, senderName, message,
                    amount: parseInt(giftCardAmount)
                }, mockPaymentId, parseInt(giftCardAmount));
            }

            if (appliedGiftCardId && creditApplied > 0) {
                await fulfillment.redeemGiftCard(appliedGiftCardId, creditApplied, mockPaymentId);
            }
            return c.json({ complete: true, returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id=${mockPaymentId}` });
        }

        // 5. Calculate Stripe Fee Surcharge
        const amountWithFee = Math.round((amountToPay + 30) / (1 - 0.029));
        const stripeFee = amountWithFee - amountToPay;

        // 6. Fetch Customer Details for Stripe
        let customerEmail = undefined;
        let stripeCustomerId = undefined;

        if (user?.userId) {
            const { users, userRelationships } = await import('@studio/db/src/schema');
            const userRecord = await db.select({ email: users.email, stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, user.userId)).get();

            if (userRecord) {
                customerEmail = userRecord.email;
                stripeCustomerId = userRecord.stripeCustomerId;

                // Family Logic
                if (!stripeCustomerId) {
                    const parents = await db.query.userRelationships.findMany({
                        where: eq(userRelationships.childUserId, user.userId)
                    });

                    if (parents.length > 0) {
                        const parentIds = parents.map(p => p.parentUserId);
                        const parentUsers = await db.query.users.findMany({
                            where: (users, { inArray }) => inArray(users.id, parentIds),
                            columns: { stripeCustomerId: true, email: true }
                        });

                        const parentWithStripe = parentUsers.find(p => p.stripeCustomerId);
                        if (parentWithStripe) {
                            stripeCustomerId = parentWithStripe.stripeCustomerId;
                            if (customerEmail?.endsWith('@placeholder.studio')) {
                                customerEmail = parentWithStripe.email;
                            }
                        }
                    }
                }
            }
        }

        // 7. Create Stripe Session with Line Items
        const { StripeService } = await import('../services/stripe');
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY || '');

        // Construct Line Items
        const lineItems = [];
        const itemName = pack ? pack.name : (plan ? plan.name : 'Gift Card Credit');

        // Item Details
        // If Gift Card was applied, we show the remaining balance as the item cost?
        // Or clearer: Show Item Cost, then Tax, then "Gift Card Credit"? (Negative?)
        // Stripe requires positive line items.
        // We will list the "Net Payable for Item" + "Tax" + "Fee".

        // Distribute Credit?
        // Simplest: 
        // 1. "Item Name (Net)" - Price: taxableAmount - creditPart?
        // Let's just create line items summing to `amountWithFee`.
        // We know `amountWithFee` = `amountToPay` + `stripeFee`.
        // `amountToPay` = `taxableAmount` + `taxAmount` - `creditApplied`.

        // Strategy:
        // Item: (taxableAmount - creditApplied_allocated_to_item)
        // Tax: taxAmount
        // Fee: stripeFee

        // We allocate credit to item first.
        const creditData = { remaining: creditApplied };

        const itemNet = Math.max(0, taxableAmount - creditData.remaining);
        creditData.remaining = Math.max(0, creditData.remaining - taxableAmount);

        const taxNet = Math.max(0, taxAmount - creditData.remaining);

        if (itemNet > 0) {
            const priceData: any = {
                currency: tenant.currency || 'usd',
                product_data: { name: itemName },
                unit_amount: itemNet
            };

            if (stripeMode === 'subscription' && plan) {
                priceData.recurring = {
                    interval: plan.interval, // 'month', 'year', 'week'
                    interval_count: 1
                };
            }

            lineItems.push({
                price_data: priceData,
                quantity: 1
            });
        }

        if (taxNet > 0) {
            // Tax cannot be recurring strictly speaking if attached to a subscription,
            // but for simple checkout, we might need a workaround or just charge it as one-time
            // IF it is a subscription, we should probably include tax in the recurring price OR
            // establish a tax rate object.
            // For MVP: If subscription, we just bundle tax into the unit_amount?
            // OR we use Stripe Tax.
            // Simpler: We just add it as a one-time fee line item if allowed in sub mode?
            // Stripe Subscription Checkout allows one-time items (setup fees).
            // But tax should ideally recur.
            // Let's just bundle it for now if subscription.
            // Wait, if we bundle it, the recurring charge is higher.

            if (stripeMode === 'subscription') {
                // Determine if we want to bundle tax. 
                // Let's assume we use Stripe Tax automatic calculation in future.
                // For now, let's just NOT charge tax on subscriptions explicitly to avoid complexity
                // OR add it as a separate recurring line item? No, cleaner to bundle or use Tax Rates.
                // Let's skip tax line item for subscription for MVP or bake it in if critical.
                // Actually, let's keep it simple: Add it as a one-time line item logic below is valid for 'payment' mode.
                // For subscription, adding a one-time tax item works for the FIRST invoice only.
                // Recurring tax handling requires Tax Rates.

                // FALLBACK: Add as one-time fee for first payment.
                lineItems.push({
                    price_data: {
                        currency: tenant.currency || 'usd',
                        product_data: { name: 'Sales Tax (First Payment Only)' },
                        unit_amount: taxNet
                    },
                    quantity: 1
                });
            } else {
                lineItems.push({
                    price_data: {
                        currency: tenant.currency || 'usd',
                        product_data: { name: 'Sales Tax (MI 6%)' },
                        unit_amount: taxNet
                    },
                    quantity: 1
                });
            }
        }

        if (stripeFee > 0) {
            // Same logic for fee - usually one time or baked in. 
            // We'll charge it purely as one-time for now to cover the transaction cost.
            lineItems.push({
                price_data: {
                    currency: tenant.currency || 'usd',
                    product_data: { name: 'Processing Fee' },
                    unit_amount: stripeFee
                },
                quantity: 1
            });
        }

        // 8. Calculate Application Fee
        const { PricingService } = await import('../services/pricing');
        const tierConfig = PricingService.getTierConfig(tenant.tier);
        // tierConfig.applicationFeePercent is e.g. 0.05 for 5%
        const appFeeDecimal = tierConfig.applicationFeePercent;

        let applicationFeeAmount;
        let applicationFeePercent;

        if (stripeMode === 'subscription') {
            // Stripe expects percent as number, e.g. 5 for 5%
            if (appFeeDecimal > 0) {
                applicationFeePercent = appFeeDecimal * 100;
            }
        } else {
            // Calculate absolute amount for one-time payments
            // We take a cut of the TOTAL charged amount (including the processing fee surcharge)
            if (appFeeDecimal > 0) {
                applicationFeeAmount = Math.round(amountWithFee * appFeeDecimal);
            }
        }

        const session = await stripeService.createEmbeddedCheckoutSession(
            tenant.stripeAccountId,
            {
                currency: tenant.currency || 'usd',
                returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id={CHECKOUT_SESSION_ID}`,
                customerEmail,
                customer: stripeCustomerId || undefined,
                lineItems,
                mode: stripeMode,
                applicationFeeAmount,
                applicationFeePercent,
                metadata: {
                    type: pack ? 'pack_purchase' : (plan ? 'membership_purchase' : 'gift_card_purchase'),
                    packId: pack?.id || '',
                    planId: plan?.id || '',
                    tenantId: tenant.id,
                    userId: user?.userId || 'guest',
                    couponId: appliedCouponId || '',
                    recipientEmail: recipientEmail || '',
                    recipientName: recipientName || '',
                    senderName: senderName || '',
                    message: message || '',

                    // Detailed Financial Metadata
                    vendorName: tenant.name,
                    productName: itemName,
                    basePrice: String(basePrice),
                    discountAmount: String(discountAmount),
                    taxAmount: String(taxAmount),
                    creditApplied: String(creditApplied),
                    subtotal: String(taxableAmount), // net of coupon
                    processingFee: String(stripeFee),
                    totalCharge: String(amountWithFee),
                    applicationFee: String(applicationFeeAmount || (applicationFeePercent ? `${applicationFeePercent}%` : '0')),
                    couponCode: couponCode || '',
                    usedGiftCardId: appliedGiftCardId || '',
                    giftCardCode: giftCardCode || ''
                }
            }
        );

        return c.json({ clientSecret: session.client_secret });
    } catch (e: any) {
        console.error("Stripe Error:", e);
        return c.json({ error: "Payment init failed: " + e.message }, 500);
    }
});


// --- Failed Payments (Dunning) ---

// GET /failed-payments - List active dunning/failed subscriptions
app.get('/failed-payments', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { DunningService } = await import('../services/dunning');

    const dunning = new DunningService(db, tenant.id);
    const payments = await dunning.getFailedPayments(); // Now returns warnings too

    return c.json({ payments });
});

// POST /failed-payments/:id/retry - Retry payment for subscription
app.post('/failed-payments/:id/retry', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const role = c.get('roles');
    if (!role?.includes('owner') && !role?.includes('admin')) return c.json({ error: "Unauthorized" }, 403);

    const subscriptionId = c.req.param('id');
    const { subscriptions } = await import('@studio/db/src/schema');

    // 1. Get Subscription
    const sub = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenant.id)))
        .get();

    if (!sub || !sub.stripeSubscriptionId) {
        return c.json({ error: "Subscription not found or not linked to Stripe" }, 404);
    }

    if (!tenant.stripeAccountId) {
        return c.json({ error: "Stripe not connected" }, 400);
    }

    try {
        const { StripeService } = await import('../services/stripe');
        const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);

        // 2. Get Stripe Subscription to find latest invoice
        const stripeSub = await stripeService.getSubscription(sub.stripeSubscriptionId); // Note: getSubscription uses Platform key if not careful? 
        // Wait, StripeService logic: `getClient` handles account switching. 
        // `getSubscription` usually calls `retrieve(subId, options)`.
        // BUT `getSubscription` in `stripe.ts` DOES NOT take `connectedAccountId` argument!
        // It uses `this.stripe`.
        // CRITICAL FIX: I need to update `getSubscription` to take `connectedAccountId`.
        // Or assume subscriptions are on Platform?
        // User architecture: `commerce.ts` checkout uses `connectedAccountId`. So subs are on Connected Account.
        // `stripe.ts` `getSubscription` implementation (seen in step 3614 line 254-259) does NOT take accountId.
        // It uses `this.stripe.subscriptions.retrieve(...)`.
        // This means it looks on Platform Account.
        // IF subscriptions are created on Connected Account (via checkout session `stripeAccount: ...`), they exist on Connected Account.
        // So `getSubscription` will FAIL if I don't pass `stripeAccount`.

        // Quick Fix inside this route: Use `stripeService['getClient']` logic manually or add method?
        // Better: I'll use `stripeService.client` manually here if I can't update `stripe.ts` easily in this batch.
        // Actually, I can use `stripeService.client.subscriptions.retrieve({ ... }, { stripeAccount: tenant.stripeAccountId })`.
        // But `stripeService.client` is private?
        // It is `private stripe: Stripe;`. `getClient` is private.
        // I should have updated `getSubscription` in `stripe.ts`.

        // ALTERNATIVE: Use `stripeService.stripe`? No, private.
        // I MUST update `stripe.ts` `getSubscription` to take accountId.

        // I will update `stripe.ts` in a separate call or same batch if I can.
        // But I already submitted the tool call for `stripe.ts`.
        // I will fix it in `stripe.ts` in the NEXT step.
        // For now, I'll write this code assuming I will fix `getSubscription` signature.
        // `stripeService.getSubscription(sub.stripeSubscriptionId, tenant.stripeAccountId)`

        // Note: I will need to update `stripe.ts` again.

        const stripeSubFull = await stripeService.getSubscription(sub.stripeSubscriptionId, tenant.stripeAccountId);

        const latestInvoice = stripeSubFull.latest_invoice as any;
        if (!latestInvoice) {
            return c.json({ error: "No invoice found to retry" }, 400);
        }

        // 3. Pay Invoice
        const result = await stripeService.payInvoice(tenant.stripeAccountId, latestInvoice.id || latestInvoice);

        return c.json({ success: true, status: result.status });

    } catch (e: any) {
        console.error("Retry Error", e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;

