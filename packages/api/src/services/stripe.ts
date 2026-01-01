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
        return this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
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
        }, {
            stripeAccount: connectedAccountId, // DIRECT CHARGE on behalf of Connected Account
        });
    }

    /**
     * Get Balance for Connected Account
     */
    async getBalance(connectedAccountId: string) {
        return this.stripe.balance.retrieve({
            stripeAccount: connectedAccountId
        });
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
        return this.stripe.checkout.sessions.create({
            ui_mode: 'embedded',
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
        }, {
            stripeAccount: connectedAccountId,
        });
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
        // Create PaymentIntent with confirm: true and automatic_payment_methods
        // This attempts to charge the customer's default payment method.
        return this.stripe.paymentIntents.create({
            amount: params.amount,
            currency: params.currency,
            customer: params.customerId,
            description: params.description,
            metadata: params.metadata,
            off_session: true,
            confirm: true,
            payment_method_types: ['card'],
        }, {
            stripeAccount: connectedAccountId,
        });
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
}
