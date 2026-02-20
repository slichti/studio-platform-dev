import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router";
import { lazy, Suspense } from "react";
// Lazy load the renderer to prevent heavy modules from bloating the server worker bundle
const PublicPageRenderer = lazy(() => import("~/components/website/PublicPageRenderer.client").then(m => ({ default: m.PublicPageRenderer })));
import { ClientOnly } from "~/components/ClientOnly";
import { getStudioPage } from "~/utils/subdomain.server";

export const meta: MetaFunction = ({ data }: any) => {
    if (!data?.page) {
        return [{ title: "Page Not Found" }];
    }

    const title = data.page.seoTitle || data.page.title;
    const description = data.page.seoDescription || "";

    return [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
    ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const { slug } = params;
    if (!slug) throw new Response("Not Found", { status: 404 });

    const page = await getStudioPage(slug, 'home');
    if (!page) {
        throw new Response("Page Not Found", { status: 404 });
    }

    return { page, tenantSlug: slug || "" };
};

export default function WebsiteIndex() {
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
