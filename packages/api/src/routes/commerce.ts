import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, coupons, couponRedemptions, classPackDefinitions, giftCards } from 'db/src/schema'; // Ensure exported
import { eq, and, gt, sql } from 'drizzle-orm';

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

// GET /coupons - List (Admin)
app.get('/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

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

// POST /coupons - Create
app.post('/coupons', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
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

// DELETE /coupons/:id - Deactivate
app.delete('/coupons/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');

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
    // const { classPackDefinitions } = await import('db/src/schema');

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

    const { classPackDefinitions } = await import('db/src/schema');
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
app.post('/checkout/session', async (c) => {
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
        const { packId, couponCode, giftCardCode, giftCardAmount, recipientEmail, recipientName, senderName, message } = body;

        if (!packId && !giftCardAmount) return c.json({ error: "Pack ID or Amount required" }, 400);

        let finalAmount = 0;
        let basePrice = 0;
        let discountAmount = 0;
        let pack = null;

        if (packId) {
            // 1. Fetch Pack
            pack = await db.select().from(classPackDefinitions)
                .where(and(eq(classPackDefinitions.id, packId), eq(classPackDefinitions.tenantId, tenant.id)))
                .get();

            if (!pack) return c.json({ error: "Pack not found" }, 404);
            finalAmount = pack.price || 0;
            basePrice = finalAmount;
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
            const { users, userRelationships } = await import('db/src/schema');
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
        const itemName = pack ? pack.name : 'Gift Card Credit';

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
            lineItems.push({
                price_data: {
                    currency: tenant.currency || 'usd',
                    product_data: { name: itemName },
                    unit_amount: itemNet
                },
                quantity: 1
            });
        }

        if (taxNet > 0) {
            lineItems.push({
                price_data: {
                    currency: tenant.currency || 'usd',
                    product_data: { name: 'Sales Tax (MI 6%)' },
                    unit_amount: taxNet
                },
                quantity: 1
            });
        }

        if (stripeFee > 0) {
            lineItems.push({
                price_data: {
                    currency: tenant.currency || 'usd',
                    product_data: { name: 'Processing Fee' },
                    unit_amount: stripeFee
                },
                quantity: 1
            });
        }

        const session = await stripeService.createEmbeddedCheckoutSession(
            tenant.stripeAccountId,
            {
                currency: tenant.currency || 'usd',
                returnUrl: `${new URL(c.req.url).origin}/studio/${tenant.slug}/return?session_id={CHECKOUT_SESSION_ID}`,
                customerEmail,
                customer: stripeCustomerId || undefined,
                lineItems,
                metadata: {
                    type: pack ? 'pack_purchase' : 'gift_card_purchase',
                    packId: pack?.id || '',
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


export default app;
