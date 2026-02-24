import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router";
import { apiRequest } from "~/utils/api";
import { lazy, Suspense } from "react";
// Lazy load the renderer to prevent Puck/recharts from bloating the server worker bundle
const PublicPageRenderer = lazy(() => import("~/components/website/PublicPageRenderer.client").then(m => ({ default: m.PublicPageRenderer })));
import { ClientOnly } from "~/components/ClientOnly";

export const meta: MetaFunction = ({ data }: any) => {
    if (!data?.page) {
        return [{ title: "Page Not Found" }];
    }

    const seo = data.page.tenantSettings?.seo || {};
    const title = data.page.seoTitle || seo.defaultTitle || data.page.title;
    const description = data.page.seoDescription || seo.defaultDescription || "";
    // Assuming page object might eventually have an `image` or `ogImage` field
    const image = data.page.seoImage || data.page.ogImage || "https://studio-platform.com/og-default.png"; // Fallback
    const url = typeof window !== "undefined" ? window.location.href : "";

    return [
        { title },
        { name: "description", content: description },

        // OpenGraph
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },

        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
    ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const { slug, pageSlug } = params;

    try {
        // Fetch page content (public endpoint - no auth required)
        // We use the tenant slug header to identify the tenant
        const page = await apiRequest<any>(`/website/public/pages/${pageSlug}`, null, {
            headers: {
                "X-Tenant-Slug": slug || ""
            }
        });

        return { page, tenantSlug: slug || "" };
    } catch (e: any) {
        console.error("Failed to load page:", e);
        throw new Response("Page Not Found", { status: 404 });
    }
};

export default function WebsitePage() {
    const { page, tenantSlug } = useLoaderData<typeof loader>();
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
