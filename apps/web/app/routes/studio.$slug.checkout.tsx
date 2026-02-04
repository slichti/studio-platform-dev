
import type { LoaderFunctionArgs } from "react-router";

import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { GiftCardInput } from "../components/GiftCardInput";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const packId = url.searchParams.get("packId");
    const planId = url.searchParams.get("planId");

    // Gift Card Params
    const giftCardAmount = url.searchParams.get("giftCardAmount");
    const recipientEmail = url.searchParams.get("recipientEmail");
    const recipientName = url.searchParams.get("recipientName");
    const senderName = url.searchParams.get("senderName");
    const message = url.searchParams.get("message");

    return { token, packId, planId, giftCardAmount, recipientEmail, recipientName, senderName, message, slug: args.params.slug };
};

export default function CheckoutPage() {
    const { token, packId, planId, giftCardAmount, recipientEmail, recipientName, senderName, message, slug } = useLoaderData<any>();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const [couponCode, setCouponCode] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string, type: string, value: number } | null>(null);
    const [loadingSession, setLoadingSession] = useState(false);

    // Initial load? No, we wait for user to confirm or just load default
    // Let's load default session immediately, but allow refreshing with coupon?
    // Efficient way: Load session ONLY when "Pay" is clicked?
    // Better UX: Show "Order Summary" first.
    // So split view: Summary -> Payment.

    const [step, setStep] = useState<'summary' | 'payment'>('summary');
    const [packDetails, setPackDetails] = useState<any>(null); // Fetch pack details first? 
    // Wait, fetching pack details requires an endpoint. 
    // We can reuse the `checkout/session` call to get just the session which contains the amount, 
    // but we can't easily see the broken down price unless we fetch pack separately.
    // Let's assume we proceed to payment immediately but offer a "Add Promo Code" field above the Stripe Element?
    // Embedded Checkout *can* support discounts if passed, but updating it requires replacing the session.

    // SIMPLEST FLOW MVP:
    // 1. Enter Code [Apply]. 
    // 2. We call /validate. If valid, we store it.
    // 3. We call /checkout/session with code.

    useEffect(() => {
        if ((!packId && !giftCardAmount && !planId) || !token) return;

        // Check for pending coupon
        const pending = sessionStorage.getItem('pending_coupon');
        if (pending) {
            setCouponCode(pending);
            createSession(pending);
            // Optional: Remove it? 
            // sessionStorage.removeItem('pending_coupon'); // Keep it until success?
            // If createSession fails with invalid coupon, user sees error.
            // Let's keep it simply in state. If they reload, it re-applies.
        } else {
            createSession();
        }
    }, [packId, giftCardAmount, planId, token, slug]);

    const createSession = (code?: string, giftCode?: string) => {
        setLoadingSession(true);
        const payload: any = {
            packId,
            planId,
            couponCode: code,
            giftCardAmount,
            recipientEmail,
            recipientName,
            senderName,
            message
        };
        if (giftCode) payload.giftCardCode = giftCode;

        apiRequest(`/commerce/checkout/session`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify(payload)
        })
            .then((res: any) => {
                if (res.error) {
                    setError(res.error);
                } else if (res.complete && res.returnUrl) {
                    // Direct completion (e.g. 100% discount)
                    window.location.href = res.returnUrl;
                } else {
                    setClientSecret(res.clientSecret);
                    setError(null);
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to initialize checkout.");
            })
            .finally(() => setLoadingSession(false));
    };

    const applyCoupon = async () => {
        if (!couponCode) return;
        // Optional: Validate first or just try to create session?
        // Let's just recreate session
        createSession(couponCode);
    };

    if (error) {
        return (
            <div className="max-w-md mx-auto py-12 text-center">
                <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-4">
                    {error}
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:underline"
                >
                    Go Back
                </button>
            </div>
        );
    }

    if (!clientSecret) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 mb-6"
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
            </button>


            <div className="mb-6 space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Apply Promotion</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Promo Code"
                            className="flex-1 border-none bg-zinc-100 rounded-xl px-4 py-3 text-sm uppercase font-mono outline-none focus:ring-2 focus:ring-blue-500"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                            onClick={applyCoupon}
                            disabled={loadingSession || !couponCode}
                            className="bg-zinc-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 transition-all"
                        >
                            Apply
                        </button>
                    </div>

                    <div className="pt-2 border-t border-zinc-50">
                        <GiftCardInput
                            token={token!}
                            slug={slug}
                            onApply={(card) => createSession(couponCode, card.code)}
                            onRemove={() => createSession(couponCode)}
                        />
                    </div>
                </div>
            </div>

            <div id="checkout" className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                >
                    <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
            </div>
        </div >
    );
}
