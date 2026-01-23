import { DrizzleD1Database } from 'drizzle-orm/d1';
import {
    products,
    posOrders,
    posOrderItems,
    users,
    tenantMembers,
    giftCards,
    coupons,
    couponRedemptions
} from 'db/src/schema'; // Ensure correct imports
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { StripeService } from './stripe';
import { WebhookService } from './webhooks';
import { FulfillmentService } from './fulfillment';
import { AutomationsService } from './automations';
import { EmailService } from './email';
import { SmsService } from './sms';
import { UsageService } from './pricing';

interface CartItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

import * as schema from 'db/src/schema';

export class PosService {
    private db: DrizzleD1Database<typeof schema>;
    private tenantId: string;
    private stripeService?: StripeService;
    private env: any; // Ideally typed Env

    constructor(db: DrizzleD1Database<typeof schema>, tenantId: string, env: any, stripeService?: StripeService) {
        this.db = db;
        this.tenantId = tenantId;
        this.env = env;
        this.stripeService = stripeService;
    }

    // --- Products ---

    async listProducts() {
        return this.db.select().from(products)
            .where(eq(products.tenantId, this.tenantId))
            .orderBy(desc(products.createdAt))
            .all();
    }

    async createProduct(data: {
        name: string,
        description?: string,
        category?: string,
        sku?: string,
        price: number,
        stockQuantity: number,
        imageUrl?: string,
        isActive: boolean
    }, tenantStripeAccountId?: string | null, currency = 'usd') {
        const id = crypto.randomUUID();
        let stripeProductId = null;
        let stripePriceId = null;

        // Stripe Sync
        if (this.stripeService && tenantStripeAccountId) {
            try {
                const prod = await this.stripeService.createProduct({
                    name: data.name,
                    description: data.description,
                    images: data.imageUrl ? [data.imageUrl] : [],
                    metadata: { tenantId: this.tenantId, localId: id }
                }, tenantStripeAccountId);
                stripeProductId = prod.id;

                if (data.price > 0) {
                    const price = await this.stripeService.createPrice({
                        productId: prod.id,
                        unitAmount: data.price,
                        currency: currency
                    }, tenantStripeAccountId);
                    stripePriceId = price.id;
                }
            } catch (e) {
                console.error("Stripe Product Sync Failed", e);
            }
        }

        await this.db.insert(products).values({
            id,
            tenantId: this.tenantId,
            name: data.name,
            description: data.description,
            category: data.category,
            sku: data.sku,
            price: data.price,
            currency: currency,
            stockQuantity: data.stockQuantity,
            imageUrl: data.imageUrl,
            isActive: data.isActive,
            stripeProductId: stripeProductId || undefined,
            stripePriceId: stripePriceId || undefined,
            createdAt: new Date(),
            updatedAt: new Date()
        }).run();

        return id;
    }

    async updateProduct(id: string, data: {
        name?: string,
        description?: string,
        price?: number,
        stockQuantity?: number,
        imageUrl?: string,
        category?: string,
        sku?: string,
        isActive?: boolean
    }, tenantStripeAccountId?: string | null) {
        const product = await this.db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, this.tenantId))).get();
        if (!product) throw new Error('Product not found');

        await this.db.update(products).set({
            ...data,
            updatedAt: new Date()
        }).where(eq(products.id, id)).run();

        // Sync Stripe
        if (this.stripeService && tenantStripeAccountId && product.stripeProductId) {
            try {
                await this.stripeService.updateProduct(product.stripeProductId, {
                    name: data.name,
                    description: data.description,
                    active: data.isActive,
                    images: data.imageUrl ? [data.imageUrl] : []
                }, tenantStripeAccountId);
            } catch (e) { console.error("Stripe Sync Error", e); }
        }
    }

    async archiveProduct(id: string, tenantStripeAccountId?: string | null) {
        const product = await this.db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, this.tenantId))).get();
        if (!product) throw new Error('Product not found');

        await this.db.update(products).set({ isActive: false }).where(eq(products.id, id)).run();

        if (this.stripeService && tenantStripeAccountId && product.stripeProductId) {
            try {
                await this.stripeService.archiveProduct(product.stripeProductId, tenantStripeAccountId);
            } catch (e) { console.error("Stripe Archive Error", e); }
        }
    }

    // --- Orders ---

    async createOrder(
        items: CartItem[],
        totalAmount: number,
        memberId?: string,
        staffId?: string,
        paymentMethod: string = 'card',
        redeemGiftCardCode?: string,
        redeemAmount?: number,
        tenantContext?: any, // passed for automation context usage
        couponCode?: string
    ) {
        if (!items || items.length === 0) throw new Error("No items in order");

        const orderId = crypto.randomUUID();

        let finalTotal = totalAmount;
        let appliedCouponId: string | null = null;

        // 0. Coupon Validation
        if (couponCode) {
            const validation = await this.validateCoupon(couponCode, totalAmount);
            if (validation.valid && validation.discountAmount) {
                finalTotal = Math.max(0, totalAmount - validation.discountAmount);
                appliedCouponId = validation.couponId || null;
            } else {
                if (validation.error) throw new Error(validation.error);
            }
        }

        // 1. Gift Card Redemption
        if (redeemGiftCardCode && redeemAmount && redeemAmount > 0) {
            const fulfillment = new FulfillmentService(this.db, this.env.RESEND_API_KEY);
            const card = await this.db.select().from(giftCards).where(and(
                eq(giftCards.tenantId, this.tenantId),
                eq(giftCards.code, redeemGiftCardCode),
                eq(giftCards.status, 'active')
            )).get();

            if (!card) throw new Error("Invalid Gift Card Code");
            if (card.currentBalance < redeemAmount) throw new Error("Insufficient Gift Card Balance");

            if (card.currentBalance < redeemAmount) throw new Error("Insufficient Gift Card Balance");

            await fulfillment.redeemGiftCard(card.id, redeemAmount, orderId);

            // Adjust total for order record if gift card was used? 
            // Usually Gift Card is a payment method, not a price reduction. 
            // But if we want to track "Amount Paid by Customer", we might keep totalAmount as is.
            // However, Coupon IS a price reduction.
        }

        // 2. Create Order
        const orderValues = {
            id: orderId,
            tenantId: this.tenantId,
            memberId: memberId || null,
            staffId: staffId || null,
            totalAmount: finalTotal, // Updated total
            status: 'completed' as const,
            paymentMethod: paymentMethod as "card" | "cash" | "account" | "other",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await this.db.insert(posOrders).values(orderValues).run();

        // 2b. Record Coupon Redemption
        if (appliedCouponId && memberId) { // Coupons usually linked to a user usage, or just count global
            await this.db.insert(couponRedemptions).values({
                id: crypto.randomUUID(),
                tenantId: this.tenantId,
                couponId: appliedCouponId,
                userId: memberId, // If guest, might be null? Schema says not null.
                // If memberId is null (Guest), we might need to handle this.
                // For now, let's assume POS requires a "User" even if guest created ad-hoc, or schema allows null.
                // checking schema: userId is references(()=>users.id).
                // If guest has no user ID, we can't track?
                // Let's check if we can insert with dummy user or if we should make user_id nullable in schema.
                // For now, only redeem if memberId exists.
                orderId: orderId,
                redeemedAt: new Date()
            }).run();
        }

        const itemInserts = items.map((it) => ({
            id: crypto.randomUUID(),
            orderId: orderId,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.unitPrice * it.quantity
        }));

        for (const item of itemInserts) {
            await this.db.insert(posOrderItems).values(item).run();
        }

        // 3. Stock Deduction
        for (const item of items) {
            await this.db.run(sql`UPDATE products SET stock_quantity = stock_quantity - ${item.quantity} WHERE id = ${item.productId} AND tenant_id = ${this.tenantId}`);
        }

        // 4. Async Side Effects (Webhooks & Automations)
        return {
            orderId, asyncTask: async () => {
                // Webhook
                try {
                    const hook = new WebhookService(this.db);
                    await hook.dispatch(this.tenantId, 'order.completed', {
                        orderId: orderId,
                        total: totalAmount,
                        memberId: staffId,
                        items: items.map((i) => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            price: i.unitPrice
                        }))
                    });
                } catch (e) {
                    console.error("Webhook dispatch failed", e);
                }

                // Automations
                try {
                    await this.triggerOrderAutomation(orderId, totalAmount, memberId, tenantContext);
                } catch (e) {
                    console.error("Automation dispatch failed", e);
                }
            }
        };
    }

    private async triggerOrderAutomation(orderId: string, totalAmount: number, memberId?: string, tenantContext?: any) {
        if (!memberId) return; // Guest automation skipped for now unless email captured

        let userContext = { userId: memberId, email: '', firstName: 'Guest', phone: undefined as string | undefined };

        const memberData = await this.db.query.tenantMembers.findFirst({
            where: eq(tenantMembers.id, memberId),
            with: { user: true }
        });

        if (memberData && memberData.user) {
            userContext = {
                userId: memberData.user.id,
                email: memberData.user.email,
                firstName: (memberData.user.profile as any)?.firstName || 'Member',
                phone: memberData.user.phone || undefined
            };
        }

        const usageService = new UsageService(this.db, this.tenantId);
        const resendKey = (tenantContext?.resendCredentials as any)?.apiKey || this.env.RESEND_API_KEY;
        const isByokEmail = !!(tenantContext?.resendCredentials as any)?.apiKey;

        const emailService = new EmailService(
            resendKey,
            { branding: tenantContext?.branding as any, settings: tenantContext?.settings as any },
            { slug: tenantContext?.slug },
            usageService,
            isByokEmail
        );

        const smsService = new SmsService(tenantContext?.twilioCredentials as any, this.env, usageService, this.db, this.tenantId);
        const autoService = new AutomationsService(this.db, this.tenantId, emailService, smsService);

        await autoService.dispatchTrigger('order_completed', {
            ...userContext,
            data: { orderId, amount: totalAmount }
        });
    }

    async getOrderHistory() {
        return this.db.query.posOrders.findMany({
            where: eq(posOrders.tenantId, this.tenantId),
            with: {
                items: {
                    with: { product: true }
                },
                member: {
                    with: { user: { columns: { profile: true } } }
                }
            },
            orderBy: [desc(posOrders.createdAt)]
        });
    }

    async validatePaymentItems(items: { productId: string; quantity: number }[]) {
        let totalAmount = 0;
        const itemDetails = [];

        for (const item of items) {
            const product = await this.db.select().from(products)
                .where(and(eq(products.id, item.productId), eq(products.tenantId, this.tenantId)))
                .get();

            if (!product) continue;

            totalAmount += (product.price * item.quantity);
            itemDetails.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }
        return { totalAmount, itemDetails };
    }

    async searchCustomers(query: string, tenantStripeAccountId?: string | null) {
        // Local Match
        const localMatches = await this.db.select({
            id: tenantMembers.id,
            userId: users.id,
            email: users.email,
            profile: users.profile,
            stripeCustomerId: users.stripeCustomerId
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                or(like(users.email, `%${query}%`))
            ))
            .limit(5)
            .all();

        // Stripe Match
        let stripeMatches: any[] = [];
        if (this.stripeService && tenantStripeAccountId) {
            try {
                const result = await this.stripeService.searchCustomers(query, tenantStripeAccountId);
                stripeMatches = result.data.map((cus) => ({
                    id: 'stripe_guest',
                    stripeCustomerId: cus.id,
                    email: cus.email,
                    profile: { firstName: cus.name || 'Guest', lastName: '' },
                    isStripeGuest: true
                }));
            } catch (e) { console.error("Stripe Search Error", e); }
        }

        return [...localMatches, ...stripeMatches];
    }

    async validateCoupon(code: string, cartTotal: number) {
        const coupon = await this.db.select().from(coupons).where(and(
            eq(coupons.tenantId, this.tenantId),
            eq(coupons.code, code),
            eq(coupons.active, true)
        )).get();

        if (!coupon) return { valid: false, error: 'Invalid coupon code' };

        // Check Expiry
        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            return { valid: false, error: 'Coupon expired' };
        }

        // Check Usage Limit
        if (coupon.usageLimit !== null) {
            const usage = await this.db.select({ count: sql<number>`count(*)` })
                .from(couponRedemptions)
                .where(eq(couponRedemptions.couponId, coupon.id))
                .get();

            if ((usage?.count || 0) >= coupon.usageLimit) {
                return { valid: false, error: 'Coupon usage limit reached' };
            }
        }

        // Calculate Discount
        let discountAmount = 0;
        if (coupon.type === 'percent') {
            discountAmount = Math.round(cartTotal * (coupon.value / 100));
        } else {
            discountAmount = coupon.value; // Amount in cents
        }

        // Prevent negative total logic handled by caller, but generally we max out at cartTotal
        discountAmount = Math.min(discountAmount, cartTotal);

        return {
            valid: true,
            couponId: coupon.id,
            discountAmount,
            newTotal: cartTotal - discountAmount
        };
    }
}
