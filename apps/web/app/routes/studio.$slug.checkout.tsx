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

    useEffect(() => {
        if (!packId || !token) {
            setError("Invalid checkout session.");
            return;
        }

        // Fetch Client Secret
        apiRequest(`/commerce/checkout/session`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ packId })
        })
            .then((res: any) => {
                if (res.error) {
                    setError(res.error);
                } else {
                    setClientSecret(res.clientSecret);
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to initialize checkout.");
            });
    }, [packId, token, slug]);

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
            <div id="checkout" className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                >
                    <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
            </div>
        </div>
    );
}
