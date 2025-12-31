// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const sessionId = url.searchParams.get("session_id");

    return { sessionId, slug: args.params.slug };
};

export default function CheckoutReturn() {
    const { sessionId, slug } = useLoaderData<any>();

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
