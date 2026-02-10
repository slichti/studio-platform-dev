
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const GiftCardsPage = lazy(() => import("../components/routes/GiftCardsPage"));

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const giftCardsRes: any = await apiRequest("/gift-cards", token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return { giftCards: giftCardsRes.giftCards || [], token };
    } catch (e) {
        return { giftCards: [], token };
    }
}

export default function GiftCards() {
    return (
        <ClientOnly fallback={
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <Suspense fallback={
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            }>
                <GiftCardsPage />
            </Suspense>
        </ClientOnly>
    );
}
