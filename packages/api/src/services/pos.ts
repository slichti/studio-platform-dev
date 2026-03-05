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
} from '@studio/db/src/schema'; // Ensure correct imports
import { eq, and, desc, like, or, sql, isNull } from 'drizzle-orm';
import { StripeService } from './stripe';
import { WebhookService } from './webhooks';
import { FulfillmentService } from './fulfillment';
import { AutomationsService } from './automations';
import { EmailService } from './email';
import { SmsService } from './sms';
import { UsageService } from './pricing';
import { InventoryService } from './inventory';
import { AuditService } from './audit';
import { PushService } from './push';

interface CartItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

import * as schema from '@studio/db/src/schema';

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

    async listProducts(tenantStripeAccountId?: string | null) {
        await this.syncProductsFromStripe(tenantStripeAccountId);
        return this.db.select().from(products)
            .where(eq(products.tenantId, this.tenantId))
            .orderBy(desc(products.createdAt))
            .all();
    }

    async syncProductsFromStripe(tenantStripeAccountId?: string | null) {
        if (!this.stripeService) return;
        try {
            const stripeData = await this.stripeService.searchProductsByTenant(this.tenantId, tenantStripeAccountId || undefined);
            for (const prod of stripeData.data) {
                if (!prod.active) continue;

                // Check if exists locally
                const existing = await this.db.select().from(products)
                    .where(and(eq(products.stripeProductId, prod.id), eq(products.tenantId, this.tenantId)))
                    .get();

                if (!existing) {
                    // Find price
                    let priceCents = 0;
                    let currency = 'usd';
                    let stripePriceId = prod.default_price as string | undefined;

                    if (stripePriceId && typeof stripePriceId === 'string') {
                        try {
                            const priceObj = await this.stripeService.retrievePrice(stripePriceId, tenantStripeAccountId || undefined);
                            priceCents = priceObj.unit_amount || 0;
                            currency = priceObj.currency;
                        } catch (e) { console.error("Could not fetch price", e); }
                    }

                    await this.db.insert(products).values({
                        id: crypto.randomUUID(),
                        tenantId: this.tenantId,
                        name: prod.name,
                        description: prod.description || undefined,
                        price: priceCents,
                        currency,
                        stockQuantity: 9999, // default
                        isActive: true,
                        stripeProductId: prod.id,
                        stripePriceId: stripePriceId || undefined,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }).run();
                }
            }
        } catch (e) {
            console.error("Failed to sync products from stripe", e);
        }
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
    }, tenantStripeAccountId?: string | null, currency = 'usd', tenantName?: string) {
        const id = crypto.randomUUID();
        let stripeProductId = null;
        let stripePriceId = null;

        // Stripe Sync
        if (this.stripeService) {
            try {
                console.log(`[PosService] Syncing product to Stripe for tenant ${this.tenantId}: ${data.name}`);
                const prod = await this.stripeService.createProduct({
                    name: tenantName ? `${tenantName} - ${data.name}` : data.name,
                    description: data.description,
                    images: data.imageUrl ? [data.imageUrl] : [],
                    metadata: { tenantId: this.tenantId, localId: id }
                }, tenantStripeAccountId || undefined);
                stripeProductId = prod.id;
                console.log(`[PosService] Successfully created Stripe product: ${stripeProductId}`);

                if (data.price > 0) {
                    const price = await this.stripeService.createPrice({
                        productId: prod.id,
                        unitAmount: data.price,
                        currency: currency
                    }, tenantStripeAccountId || undefined);
                    stripePriceId = price.id;
                    console.log(`[PosService] Successfully created Stripe price: ${stripePriceId}`);
                }
            } catch (e: any) {
                console.error(`[PosService] Stripe Product Sync Failed for tenant ${this.tenantId}:`, e.message || e);
                // We continue so the product is at least created locally
            }
        } else {
            console.warn(`[PosService] No StripeService available for tenant ${this.tenantId}, skipping sync.`);
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

    async repairMissingStripeIds(tenantStripeAccountId?: string | null, tenantName?: string) {
        if (!this.stripeService) return;

        try {
            // Find active products for this tenant that lack a stripeProductId
            const orphanedProducts = await this.db.select().from(products)
                .where(and(
                    eq(products.tenantId, this.tenantId),
                    eq(products.isActive, true),
                    isNull(products.stripeProductId)
                ))
                .all();

            if (orphanedProducts.length === 0) return;

            console.log(`[PosService] Found ${orphanedProducts.length} orphaned products for tenant ${this.tenantId}. Attempting repair...`);

            for (const prod of orphanedProducts) {
                try {
                    console.log(`[PosService] Repairing sync for product: ${prod.name} (${prod.id})`);

                    const stripeProd = await this.stripeService.createProduct({
                        name: tenantName ? `${tenantName} - ${prod.name}` : prod.name,
                        description: prod.description || undefined,
                        images: prod.imageUrl ? [prod.imageUrl] : [],
                        metadata: { tenantId: this.tenantId, localId: prod.id }
                    }, tenantStripeAccountId || undefined);

                    let stripePriceId = undefined;
                    if (prod.price > 0) {
                        const priceObj = await this.stripeService.createPrice({
                            productId: stripeProd.id,
                            unitAmount: prod.price,
                            currency: prod.currency || 'usd'
                        }, tenantStripeAccountId || undefined);
                        stripePriceId = priceObj.id;
                    }

                    // Update local record
                    await this.db.update(products)
                        .set({
                            stripeProductId: stripeProd.id,
                            stripePriceId: stripePriceId,
                            updatedAt: new Date()
                        })
                        .where(eq(products.id, prod.id))
                        .run();

                    console.log(`[PosService] Successfully repaired product ${prod.id}. Stripe ID: ${stripeProd.id}`);
                } catch (err: any) {
                    console.error(`[PosService] Failed to repair product ${prod.id}:`, err.message || err);
                }
            }
        } catch (e: any) {
            console.error(`[PosService] Error during repairMissingStripeIds:`, e.message || e);
        }
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
    }, tenantStripeAccountId?: string | null, tenantName?: string) {
        const product = await this.db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, this.tenantId))).get();
        if (!product) throw new Error('Product not found');

        let newStripePriceId: string | undefined;
        if (data.price !== undefined && this.stripeService && product.stripeProductId) {
            try {
                const currency = product.currency || 'usd';
                const price = await this.stripeService.createPrice({
                    productId: product.stripeProductId,
                    unitAmount: data.price,
                    currency
                }, tenantStripeAccountId || undefined);
                newStripePriceId = price.id;
            } catch (e) { console.error("Stripe Price Create Error", e); }
        }

        await this.db.update(products).set({
            ...data,
            ...(newStripePriceId && { stripePriceId: newStripePriceId }),
            updatedAt: new Date()
        }).where(eq(products.id, id)).run();

        // Sync Stripe product metadata (verapose pattern: create new price on price change)
        if (this.stripeService && product.stripeProductId) {
            try {
                await this.stripeService.updateProduct(product.stripeProductId, {
                    name: (tenantName && data.name) ? `${tenantName} - ${data.name}` : data.name,
                    description: data.description,
                    active: data.isActive,
                    images: data.imageUrl ? [data.imageUrl] : []
                }, tenantStripeAccountId || undefined);
            } catch (e) { console.error("Stripe Sync Error", e); }
        }
    }

    async archiveProduct(id: string, tenantStripeAccountId?: string | null) {
        const product = await this.db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, this.tenantId))).get();
        if (!product) throw new Error('Product not found');

        await this.db.update(products).set({ isActive: false }).where(eq(products.id, id)).run();

        if (this.stripeService && product.stripeProductId) {
            try {
                await this.stripeService.archiveProduct(product.stripeProductId, tenantStripeAccountId || undefined);
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
        stripePaymentIntentId?: string | null,
        couponCode?: string
    ) {
        if (!items || items.length === 0) throw new Error("No items in order");

        const orderId = crypto.randomUUID();

        // 0. Recalculate Total from DB (Security Fix)
        let calculatedTotal = 0;
        const itemInserts = [];

        for (const item of items) {
            const product = await this.db.select().from(products)
                .where(and(eq(products.id, item.productId), eq(products.tenantId, this.tenantId)))
                .get();

            if (!product) throw new Error(`Product not found: ${item.productId}`);

            // Check Stock
            if (product.stockQuantity < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }

            const lineTotal = product.price * item.quantity;
            calculatedTotal += lineTotal;

            itemInserts.push({
                id: crypto.randomUUID(),
                orderId: orderId,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price, // Use DB price
                totalPrice: lineTotal
            });
        }

        let finalTotal = calculatedTotal;
        let appliedCouponId: string | null = null;

        // 1. Coupon Validation
        if (couponCode) {
            const validation = await this.validateCoupon(couponCode, calculatedTotal);
            if (validation.valid && validation.discountAmount) {
                finalTotal = Math.max(0, calculatedTotal - validation.discountAmount);
                appliedCouponId = validation.couponId || null;
            } else {
                if (validation.error) throw new Error(validation.error);
            }
        }

        // 2. Gift Card Redemption
        if (redeemGiftCardCode && redeemAmount && redeemAmount > 0) {
            const fulfillment = new FulfillmentService(this.db, this.env.RESEND_API_KEY);
            // Verify card exists first for better error message, but rely on atomic redeem
            const card = await this.db.select().from(giftCards).where(and(
                eq(giftCards.tenantId, this.tenantId),
                eq(giftCards.code, redeemGiftCardCode),
                eq(giftCards.status, 'active')
            )).get();

            if (!card) throw new Error("Invalid Gift Card Code");

            // Atomic redemption handled in FulfillmentService
            await fulfillment.redeemGiftCard(card.id, redeemAmount, orderId);
        }

        // 3. Create Order
        const orderValues = {
            id: orderId,
            tenantId: this.tenantId,
            memberId: memberId || null,
            staffId: staffId || null,
            totalAmount: finalTotal,
            status: 'completed' as const,
            paymentMethod: paymentMethod as "card" | "cash" | "account" | "other",
            stripePaymentIntentId: stripePaymentIntentId || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await this.db.insert(posOrders).values(orderValues).run();

        // 3b. Record Coupon
        if (appliedCouponId && memberId) {
            await this.db.insert(couponRedemptions).values({
                id: crypto.randomUUID(),
                tenantId: this.tenantId,
                couponId: appliedCouponId,
                userId: memberId,
                orderId: orderId,
                redeemedAt: new Date()
            }).run();
        }

        for (const item of itemInserts) {
            await this.db.insert(posOrderItems).values(item).run();
        }

        // 3. Stock Deduction (Audit Logged)
        const inventory = new InventoryService(this.db, this.tenantId);
        for (const item of items) {
            await inventory.adjustStock(
                item.productId,
                -item.quantity,
                'sale',
                `POS Sale: ${orderId}`,
                staffId
            );
        }

        // 4. Async Side Effects (Webhooks & Automations)
        return {
            orderId, asyncTask: async () => {
                // Webhook
                try {
                    const hook = new WebhookService(this.db, this.env.SVIX_AUTH_TOKEN);
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
        const pushService = new PushService(this.db, this.tenantId);
        const autoService = new AutomationsService(this.db, this.tenantId, emailService, smsService, pushService);

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
            stripeCustomerId: tenantMembers.stripeCustomerId
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
