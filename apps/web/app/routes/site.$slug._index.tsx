import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router";
import { PublicPageRenderer } from "~/components/website/PublicPageRenderer";
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
    return <PublicPageRenderer page={page} tenantSlug={tenantSlug} />;
}
