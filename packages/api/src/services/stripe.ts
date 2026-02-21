import Stripe from 'stripe';

export class StripeService {
    private stripe: Stripe;

    constructor(apiKey: string) {
        this.stripe = new Stripe(apiKey, {
            apiVersion: '2026-01-28.clover' as any
        });
    }

    /**
     * Generate OAuth link for Standard Connect
     */
    getConnectUrl(clientId: string, redirectUri: string, state: string) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            scope: 'read_write',
            redirect_uri: redirectUri,
            state: state
        });
        return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange auth code for Account ID
     */
    async connectAccount(code: string) {
        const response = await this.stripe.oauth.token({
            grant_type: 'authorization_code',
            code,
        });
        return response.stripe_user_id;
    }

    private getClient(accountIdOrKey: string) {
        if (accountIdOrKey.startsWith('sk_') || accountIdOrKey.startsWith('rk_')) {
            return {
                client: new Stripe(accountIdOrKey, { apiVersion: '2026-01-28.clover' as any }),
                options: {}
            };
        }
        return {
            client: this.stripe,
            options: { stripeAccount: accountIdOrKey }
        };
    }

    /**
     * Create Checkout Session for a Class
     */
    async createCheckoutSession(
        connectedAccountId: string,
        params: {
            title?: string;
            amount?: number; // cents
            currency: string;
            successUrl: string;
            cancelUrl: string;
            metadata: Record<string, string>;
            customerEmail?: string;
            customer?: string;
            lineItems?: Stripe.Checkout.SessionCreateParams.LineItem[];
            mode?: 'payment' | 'subscription';
            applicationFeeAmount?: number;
            applicationFeePercent?: number;
            automaticTax?: boolean;
        }
    ) {
        const { client, options } = this.getClient(connectedAccountId);

        const sessionParams: any = {
            payment_method_types: ['card', 'us_bank_account'],
            payment_method_options: {
                us_bank_account: {
                    financial_connections: {
                        permissions: ['payment_method'],
                    },
                },
            },
            mode: params.mode || 'payment',
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata,
        };

        if (params.customer) {
            sessionParams.customer = params.customer;
        } else if (params.customerEmail) {
            sessionParams.customer_email = params.customerEmail;
        }

        if (params.automaticTax) {
            sessionParams.automatic_tax = { enabled: true };
        }

        if (params.mode === 'subscription' && params.applicationFeePercent) {
            sessionParams.subscription_data = {
                application_fee_percent: params.applicationFeePercent
            };
        }

        if (params.mode !== 'subscription' && params.applicationFeeAmount) {
            sessionParams.payment_intent_data = {
                application_fee_amount: params.applicationFeeAmount
            };
        }

        if (params.lineItems && params.lineItems.length > 0) {
            sessionParams.line_items = params.lineItems;
        } else if (params.amount && params.title) {
            sessionParams.line_items = [{
                price_data: {
                    currency: params.currency,
                    product_data: {
                        name: params.title,
                    },
                    unit_amount: params.amount,
                },
                quantity: 1,
            }];
        } else {
            throw new Error("Either lineItems or (amount + title) must be provided");
        }

        return client.checkout.sessions.create(sessionParams, options);
    }

    /**
     * Get Balance for Connected Account
     */
    async getBalance(connectedAccountId: string) {
        const { client, options } = this.getClient(connectedAccountId);
        return client.balance.retrieve(options);
    }

    /**
     * Create Embedded Checkout Session
     */
    async createEmbeddedCheckoutSession(
        connectedAccountId: string,
        params: {
            title?: string; // Optional if lineItems used
            amount?: number; // Optional if lineItems used
            currency: string;
            returnUrl: string;
            metadata: Record<string, string>;
            customerEmail?: string;
            customer?: string;
            lineItems?: Stripe.Checkout.SessionCreateParams.LineItem[];
            mode?: 'payment' | 'subscription';
            applicationFeeAmount?: number;
            applicationFeePercent?: number;
            automaticTax?: boolean;
        }
    ) {
        const { client, options } = this.getClient(connectedAccountId);

        const sessionParams: any = {
            ui_mode: 'embedded',
            payment_method_types: ['card', 'us_bank_account'],
            payment_method_options: {
                us_bank_account: {
                    financial_connections: {
                        permissions: ['payment_method'],
                    },
                },
            },
            mode: params.mode || 'payment',
            return_url: params.returnUrl,
            metadata: params.metadata,
        };

        if (params.automaticTax) {
            sessionParams.automatic_tax = { enabled: true };
        }

        if (params.mode === 'subscription' && params.applicationFeePercent) {
            sessionParams.subscription_data = {
                application_fee_percent: params.applicationFeePercent
            };
        }

        if (params.mode !== 'subscription' && params.applicationFeeAmount) {
            sessionParams.payment_intent_data = {
                application_fee_amount: params.applicationFeeAmount
            };
        }

        if (params.lineItems && params.lineItems.length > 0) {
            sessionParams.line_items = params.lineItems;
        } else if (params.amount && params.title) {
            sessionParams.line_items = [{
                price_data: {
                    currency: params.currency,
                    product_data: {
                        name: params.title,
                    },
                    unit_amount: params.amount,
                },
                quantity: 1,
            }];
        } else {
            throw new Error("Either lineItems or (amount + title) must be provided");
        }

        if (params.customer) {
            sessionParams.customer = params.customer;
        } else if (params.customerEmail) {
            sessionParams.customer_email = params.customerEmail;
        }

        return client.checkout.sessions.create(sessionParams, options);
    }

    /**
     * Charge a Customer (Off-Session / Late Fee)
     * Note: Requires Customer ID and Payment Method attached to that customer in Stripe.
     */
    async chargeCustomer(
        connectedAccountId: string,
        params: {
            customerId: string;
            amount: number;
            currency: string;
            description: string;
            metadata?: Record<string, string>;
        }
    ) {
        const { client, options } = this.getClient(connectedAccountId);

        // Create PaymentIntent with confirm: true and automatic_payment_methods
        // This attempts to charge the customer's default payment method.
        return client.paymentIntents.create({
            amount: params.amount,
            currency: params.currency,
            customer: params.customerId,
            description: params.description,
            metadata: params.metadata,
            off_session: true,
            confirm: true,
            payment_method_types: ['card', 'us_bank_account'],
        }, options);
    }



    /**
     * Create Subscription (SaaS)
     */
    async createSubscription(customerId: string, priceId: string, trialDays?: number, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            trial_period_days: trialDays,
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        }, options);
    }

    /**
     * Cancel Subscription
     */
    async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        if (atPeriodEnd) {
            return client.subscriptions.update(subscriptionId, { cancel_at_period_end: true }, options);
        } else {
            return client.subscriptions.cancel(subscriptionId, {}, options);
        }
    }

    /**
     * Update Subscription (Change Price/Interval)
     * Note: This assumes swapping the single item in the subscription.
     */
    async updateSubscription(subscriptionId: string, newPriceId: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        // 1. Get subscription to find item ID
        const subscription = await client.subscriptions.retrieve(subscriptionId, {}, options);
        const itemId = subscription.items.data[0].id;

        // 2. Update the item
        return client.subscriptions.update(subscriptionId, {
            items: [{
                id: itemId,
                price: newPriceId,
            }],
            proration_behavior: 'create_prorations', // Default behavior
        }, options);
    }

    /**
     * Get Subscription Details
     */
    /**
     * Get Subscription Details
     */
    /**
     * Get Subscription Details
     */
    async getSubscription(subscriptionId: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        // Expand latest_invoice to get payment_intent
        return client.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price.product', 'latest_invoice.payment_intent']
        }, options);
    }

    /**
     * List Active Subscriptions for a Customer
     */
    async listActiveSubscriptions(customerId: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 100
        }, options);
    }

    async listInvoices(customerId: string, limit = 20, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.invoices.list({
            customer: customerId,
            limit,
            status: 'paid', // Or all? Usually paid for history.
            expand: ['data.payment_intent']
        }, options);
    }

    /**
     * Create a Transfer (for Payouts to Instructors)
     * Moves funds from the Studio's connected account to the Platform, 
     * then potentially onwards or as a direct transfer from the Studio's balance.
     * For "Direct" payouts: we use 'transfer_data' in PaymentIntent OR a manual Transfer.
     */
    async createTransfer(params: {
        amount: number;
        currency: string;
        destination: string; // The Instructor's Stripe Account ID
        sourceAccountId?: string; // The Studio's Stripe Account ID (Optional)
        description?: string;
    }) {
        // This moves funds from the Platform's balance to the destination account.
        // If the Studio's funds are already in the Platform's balance (e.g. from app fee), 
        // we can just transfer.
        // If we need to move from Studio -> Platform -> Instructor, we usually use 
        // Stripe's "Transfers" API on the Platform account.
        return this.stripe.transfers.create({
            amount: params.amount,
            currency: params.currency,
            destination: params.destination,
            description: params.description,
            // source_transaction: ... // If linked to a specific payment
        }, {
            // We usually transfer FROM the platform account's balance which was collected via application fees.
        });
    }

    /**
     * Create Terminal Connection Token
     */
    async createTerminalConnectionToken(connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.terminal.connectionTokens.create({}, options);
    }

    /**
     * Product Management
     */
    async createProduct(params: { name: string; description?: string; images?: string[]; active?: boolean; metadata?: Record<string, string>; taxCode?: string }, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.products.create({
            name: params.name,
            description: params.description,
            images: params.images,
            active: params.active,
            metadata: params.metadata,
            tax_code: params.taxCode
        }, options);
    }

    async createPrice(params: { productId: string; unitAmount: number; currency: string; recurring?: Stripe.PriceCreateParams.Recurring }, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.prices.create({
            product: params.productId,
            unit_amount: params.unitAmount,
            currency: params.currency,
            recurring: params.recurring
        }, options);
    }

    async retrievePrice(priceId: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.prices.retrieve(priceId, options);
    }

    async updateProduct(id: string, params: { name?: string; description?: string; images?: string[]; active?: boolean; metadata?: Record<string, string>; taxCode?: string }, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.products.update(id, {
            name: params.name,
            description: params.description,
            images: params.images,
            active: params.active,
            metadata: params.metadata,
            tax_code: params.taxCode
        }, options);
    }

    async archiveProduct(id: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.products.update(id, { active: false }, options);
    }

    /**
     * Customer Management
     */
    async createCustomer(params: { email: string; name: string; phone?: string; metadata?: Record<string, string> }, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.customers.create({
            email: params.email,
            name: params.name,
            phone: params.phone,
            metadata: params.metadata
        }, options);
    }

    async updateCustomer(
        customerId: string,
        params: { email?: string; name?: string; phone?: string; address?: Stripe.AddressParam },
        connectedAccountId?: string
    ) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.customers.update(customerId, params as Stripe.CustomerUpdateParams, options);
    }

    async searchCustomers(query: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        // Sanitize query to prevent injection into Stripe search syntax.
        // Stripe search uses Lucene-like operators; strip quotes and backslashes.
        const safe = query.replace(/["\\]/g, '').trim().slice(0, 200);
        if (!safe) return { data: [] };
        return client.customers.search({
            query: `name~"${safe}" OR email~"${safe}"`,
            limit: 10
        }, options);
    }

    /**
     * Refund a PaymentIntent or Charge
     */
    async refundPayment(
        connectedAccountId: string,
        params: {
            paymentIntent?: string;
            charge?: string;
            amount?: number; // Optional partial refund amount in cents
            reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
            metadata?: Record<string, string>;
        }
    ) {
        const { client, options } = this.getClient(connectedAccountId);
        return client.refunds.create({
            payment_intent: params.paymentIntent,
            charge: params.charge,
            amount: params.amount,
            reason: params.reason,
            metadata: params.metadata,
        }, options);
    }
    /**
     * Terminal Hardware Orders
     */
    async listHardwareSkus(connectedAccountId?: string) {
        // SKUs are usually platform-level or accessible via standard API?
        // Actually, Stripe Terminal Hardware Orders are often for the platform to ship to users, 
        // OR for the user to buy if they have full access. 
        // But usually Connect Platforms buy hardware and ship it, or use dropshipping via Stripe.
        // Let's assume we use the API to order ON BEHALF or FOR the connected account?
        // Stripe docs say: "You can use the API to purchase readers..."
        // The options: 
        // 1. Platform buys, sends to Connect Account address.
        // 2. Connect Account buys directly (if allowed).

        // Let's assume Platform buys it (using Platform API keys) but ships to Tenant?
        // Or simpler: Just list SKUs for now.

        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        // Note: terminal.hardwareSkus might not be in the typed defs if too old, but should be there in recent versions.
        // Using 'any' cast if needed.
        return (client.terminal as any).hardwareSkus.list({}, options);
    }

    async createHardwareOrder(
        params: {
            skuId: string;
            quantity: number;
            shipping: {
                name: string;
                address: Stripe.Address; // { line1, city, country, postal_code, state }
                phone?: string;
            };
        },
        connectedAccountId?: string
    ) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return (client.terminal as any).hardwareOrders.create({
            items: [{
                sku: params.skuId,
                quantity: params.quantity,
            }],
            shipping: params.shipping,
        }, options);
    }

    /**
     * Create Billing Portal Session
     */
    async createBillingPortalSession(customerId: string, returnUrl: string) {
        return this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
    }

    /**
     * Create Invoice Item (Pending Invoice Item for next billing cycle)
     */
    async createInvoiceItem(
        customerId: string,
        params: {
            amount: number;
            currency: string;
            description: string;
            metadata?: Record<string, string>;
        }
    ) {
        return this.stripe.invoiceItems.create({
            customer: customerId,
            amount: params.amount,
            currency: params.currency,
            description: params.description,
            metadata: params.metadata
        });
    }

    /**
     * Pay an Invoice immediately (Retry Payment)
     */
    async payInvoice(connectedAccountId: string, invoiceId: string) {
        const { client, options } = this.getClient(connectedAccountId);
        return client.invoices.pay(invoiceId, {}, options);
    }

    /**
     * Coupon Management (Platform Level)
     */
    async listCoupons(limit = 100) {
        return this.stripe.coupons.list({ limit });
    }

    async createCoupon(params: Stripe.CouponCreateParams) {
        return this.stripe.coupons.create(params);
    }

    async deleteCoupon(couponId: string) {
        return this.stripe.coupons.del(couponId);
    }
}
