import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, redirect } from "react-router";
import { getStudioPage, getSubdomain } from "~/utils/subdomain.server";
import { lazy, Suspense } from "react";
const PublicPageRenderer = lazy(() => import("~/components/website/PublicPageRenderer.client").then(m => ({ default: m.PublicPageRenderer })));
const PublicScheduleView = lazy(() => import("~/components/PublicScheduleView").then(m => ({ default: m.PublicScheduleView })));
import { ClientOnly } from "~/components/ClientOnly";

function getApiUrl(): string {
    const env = (import.meta as any).env;
    if (env?.VITE_API_URL && typeof env.VITE_API_URL === "string") return env.VITE_API_URL;
    return env?.PROD ? "https://api.slichti.org" : "http://localhost:8787";
}

export const meta: MetaFunction = ({ data }: any) => {
    if (data?.isPublicSchedule && data?.tenant) {
        return [
            { title: `${data.tenant.name} – Class Schedule` },
            { name: "description", content: `View and book classes at ${data.tenant.name}.` },
        ];
    }
    if (!data?.page) {
        return [{ title: "Page Not Found" }];
    }
    return [
        { title: data.page.seoTitle || data.page.title },
        { name: "description", content: data.page.seoDescription || "" },

        // Open Graph / Social
        { property: "og:title", content: data.page.seoTitle || data.page.title },
        { property: "og:description", content: data.page.seoDescription || "" },
        { property: "og:type", content: "website" },
        // If the page has a hero image or main image, we could pull it? 
        // For now, let's look for a generic ogImage if available, or fallback.
        ...(data.page.ogImage ? [{ property: "og:image", content: data.page.ogImage }] : [])
    ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
    const subdomain = getSubdomain(request);
    const { pageSlug } = params;

    if (!subdomain) {
        // Platform domain doesn't have dynamic page routing at root level yet
        throw new Response("Not Found", { status: 404 });
    }

    if (!pageSlug) {
        throw new Response("Not Found", { status: 404 });
    }

    // Public schedule: no login required, uses guest API
    if (pageSlug === "schedule") {
        const apiUrl = getApiUrl();
        try {
            const res = await fetch(`${apiUrl}/guest/schedule/${subdomain}`);
            if (!res.ok) throw new Response("Studio not found", { status: 404 });
            const data = await res.json() as { tenant: { name: string; id: string; currency?: string }; classes: any[] };
            return {
                isPublicSchedule: true,
                tenant: data.tenant,
                classes: data.classes || [],
                tenantSlug: subdomain,
            };
        } catch (e) {
            if (e instanceof Response) throw e;
            throw new Response("Page Not Found", { status: 404 });
        }
    }
    if (pageSlug === "portal") {
        return redirect(`/portal/${subdomain}`);
    }

    // info: /classes, /about, etc.
    const page = await getStudioPage(subdomain, pageSlug);

    if (!page) {
        throw new Response("Page Not Found", { status: 404 });
    }

    return {
        page,
        tenantSlug: subdomain
    };
}

export default function DynamicPage() {
    const data = useLoaderData<typeof loader>();

    if (data.isPublicSchedule && data.tenant && data.tenantSlug) {
        return (
            <ClientOnly>
                <Suspense fallback={
                    <div className="flex h-screen items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-black border-r-2" />
                    </div>
                }>
                    <PublicScheduleView
                        tenant={data.tenant}
                        classes={data.classes}
                        tenantSlug={data.tenantSlug}
                    />
                </Suspense>
            </ClientOnly>
        );
    }

    const { page, tenantSlug } = data as { page: any; tenantSlug: string };
    return (
        <ClientOnly>
            <Suspense fallback={
                <div className="flex h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-black border-r-2" />
                </div>
            }>
                <PublicPageRenderer page={page} tenantSlug={tenantSlug} />
            </Suspense>
        </ClientOnly>
    );
}
