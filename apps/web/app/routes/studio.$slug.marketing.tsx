
import { useLoaderData } from "react-router";
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { lazy } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const MarketingPageComponent = lazy(() => import("~/components/routes/MarketingPage"));

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    let campaigns = [];
    let automations = [];
    try {
        const [campRes, autoRes] = await Promise.all([
            apiRequest("/marketing", token, { headers: { 'X-Tenant-Slug': slug } }) as Promise<any>,
            apiRequest("/marketing/automations", token, { headers: { 'X-Tenant-Slug': slug } }) as Promise<any>
        ]);
        campaigns = campRes.campaigns || [];
        automations = autoRes.automations || [];
    } catch (e) {
        console.error("Failed to load marketing data", e);
    }

    return { campaigns, automations, slug };
};

export default function MarketingPage() {
    const { campaigns, automations, slug } = useLoaderData<any>();

    return (
        <ClientOnly fallback={<div className="p-8 animate-pulse bg-zinc-50 dark:bg-zinc-900 rounded-xl h-96" />}>
            <MarketingPageComponent campaigns={campaigns} automations={automations} slug={slug} />
        </ClientOnly>
    );
}
