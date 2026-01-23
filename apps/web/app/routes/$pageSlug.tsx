import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router";
import { getStudioPage, getSubdomain } from "~/utils/subdomain.server";
import { PublicPageRenderer } from "~/components/website/PublicPageRenderer";

export const meta: MetaFunction = ({ data }: any) => {
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
    const { page, tenantSlug } = useLoaderData<typeof loader>();

    return <PublicPageRenderer page={page} tenantSlug={tenantSlug} />;
}
