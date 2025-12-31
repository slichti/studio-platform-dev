// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const packId = url.searchParams.get("packId");

    return { token, packId, slug: args.params.slug };
};

export default function CheckoutPage() {
    const { token, packId, slug } = useLoaderData<{ token: string | null, packId: string | null, slug: string }>();
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
        if (!packId || !token) return;
        createSession(); // Load initial session without coupon
    }, [packId, token, slug]);

    const createSession = (code?: string) => {
        setLoadingSession(true);
        apiRequest(`/commerce/checkout/session`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ packId, couponCode: code })
        })
            .then((res: any) => {
                if (res.error) {
                    setError(res.error);
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
                Back
            </button>
            
            <div className="mb-6 bg-white p-4 rounded-lg border border-zinc-200 shadow-sm flex items-center justify-between">
                <div className="flex-1 max-w-sm flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Promo Code" 
                        className="flex-1 border border-zinc-300 rounded px-3 py-2 text-sm uppercase font-mono"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                    <button 
                        onClick={applyCoupon}
                        disabled={loadingSession || !couponCode}
                        className="bg-zinc-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                    >
                        Apply
                    </button>
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
