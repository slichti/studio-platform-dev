
import type { LoaderFunctionArgs } from "react-router";

import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const sessionId = url.searchParams.get("session_id");

    let needsWaiver = false;
    try {
        const waiverRes: any = await apiRequest(`/waivers/status`, token, {
            headers: { 'X-Tenant-Slug': args.params.slug! }
        });
        needsWaiver = waiverRes.needsSignature;
    } catch (e) {
        console.error("Failed to check waiver status", e);
    }

    return { sessionId, slug: args.params.slug, needsWaiver };
};

export default function CheckoutReturn() {
    const { sessionId, slug, needsWaiver } = useLoaderData<any>();

    return (
        <div className="max-w-md mx-auto py-16 px-4 text-center">
            <div className="bg-green-50 text-green-800 p-8 rounded-2xl mb-8 border border-green-100">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    ✓
                </div>
                <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
                <p className="text-green-700 mb-4">
                    Thank you for your purchase. Your credits have been added to your account.
                </p>
                {sessionId && (
                    <p className="text-xs text-green-600/60 font-mono break-all">
                        Reference: {sessionId}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-3">
                {needsWaiver && (
                    <Link
                        to={`/studio/${slug}/waivers`}
                        className="w-full py-4 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-all shadow-lg animate-bounce flex items-center justify-center gap-2"
                    >
                        <span>✍️</span> Sign Your Waiver
                    </Link>
                )}
                <Link
                    to={`/studio/${slug}`}
                    className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
                >
                    Return to Studio
                </Link>
                <Link
                    to={`/studio/${slug}/profile`}
                    className="w-full py-3 bg-white text-zinc-900 border border-zinc-200 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
                >
                    View My Profile & Credits
                </Link>
            </div>
        </div>
    );
}
