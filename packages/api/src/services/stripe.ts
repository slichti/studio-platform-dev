import Stripe from 'stripe';

export class StripeService {
    private stripe: Stripe;

    constructor(apiKey: string) {
        this.stripe = new Stripe(apiKey, {
            apiVersion: '2025-12-15.clover' as any, // Silence TS error for beta version
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
                client: new Stripe(accountIdOrKey, { apiVersion: '2025-12-15.clover' as any }),
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
            title: string;
            amount: number; // cents
            currency: string;
            successUrl: string;
            cancelUrl: string;
            metadata: Record<string, string>;
            customerEmail?: string;
        }
    ) {
        const { client, options } = this.getClient(connectedAccountId);

        return client.checkout.sessions.create({
            payment_method_types: ['card', 'us_bank_account'],
            payment_method_options: {
                us_bank_account: {
                    financial_connections: {
                        permissions: ['payment_method'],
                    },
                },
            },
            line_items: [{
                price_data: {
                    currency: params.currency,
                    product_data: {
                        name: params.title,
                    },
                    unit_amount: params.amount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata,
            customer_email: params.customerEmail,
        }, options);
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
            title: string;
            amount: number;
            currency: string;
            returnUrl: string;
            metadata: Record<string, string>;
            customerEmail?: string;
        }
    ) {
        const { client, options } = this.getClient(connectedAccountId);

        return client.checkout.sessions.create({
            ui_mode: 'embedded',
            payment_method_types: ['card', 'us_bank_account'],
            payment_method_options: {
                us_bank_account: {
                    financial_connections: {
                        permissions: ['payment_method'],
                    },
                },
            },
            line_items: [{
                price_data: {
                    currency: params.currency,
                    product_data: {
                        name: params.title,
                    },
                    unit_amount: params.amount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            return_url: params.returnUrl,
            metadata: params.metadata,
            customer_email: params.customerEmail,
        }, options);
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
     * Create Platform Customer (for SaaS Billing)
     */
    async createCustomer(email: string, name: string) {
        return this.stripe.customers.create({
            email,
            name,
        });
    }

    /**
     * Create Subscription (SaaS)
     */
    async createSubscription(customerId: string, priceId: string, trialDays?: number) {
        return this.stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            trial_period_days: trialDays,
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        });
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
        sourceAccountId: string; // The Studio's Stripe Account ID
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
    async createProduct(params: { name: string; description?: string; images?: string[]; active?: boolean; metadata?: Record<string, string> }, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.products.create({
            name: params.name,
            description: params.description,
            images: params.images,
            active: params.active,
            metadata: params.metadata
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

    async updateProduct(id: string, params: { name?: string; description?: string; images?: string[]; active?: boolean; metadata?: Record<string, string> }, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        return client.products.update(id, {
            name: params.name,
            description: params.description,
            images: params.images,
            active: params.active,
            metadata: params.metadata
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

    async searchCustomers(query: string, connectedAccountId?: string) {
        const { client, options } = connectedAccountId ? this.getClient(connectedAccountId) : { client: this.stripe, options: {} };
        // Use search API for better filtering
        return client.customers.search({
            query: `name~"${query}" OR email~"${query}"`,
            limit: 10
        }, options);
    }
}
