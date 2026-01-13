import { type LoaderFunctionArgs, type MetaFunction, Link, useLoaderData } from "react-router";
import { Render } from "@measured/puck";
import { puckConfig } from "~/components/website/puck-config";
import { apiRequest } from "~/utils/api";
import { SignedIn, useUser } from "@clerk/react-router";
import { Edit2 } from "lucide-react";

export const meta: MetaFunction = ({ data }: any) => {
    if (!data?.page) {
        return [{ title: "Page Not Found" }];
    }
    return [
        { title: data.page.seoTitle || data.page.title },
        { name: "description", content: data.page.seoDescription || "" },
    ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const { pageSlug } = params;

    try {
        // Fetch platform page content (public endpoint)
        const page = await apiRequest<any>(`/platform-pages/pages/${pageSlug}`, null);
        return { page };
    } catch (e: any) {
        console.error("Failed to load platform page:", e);
        // Important: throw 404 to let other routes potentially match or show 404 page
        throw new Response("Page Not Found", { status: 404 });
    }
};

export default function PlatformPage() {
    const { page } = useLoaderData<typeof loader>();
    const { user } = useUser();
    const isSystemAdmin = !!user?.publicMetadata?.isSystemAdmin;

    return (
        <div className="min-h-screen bg-white">
            <Render config={puckConfig} data={page.content} />

            {/* Admin Edit Shortcut */}
            {isSystemAdmin && (
                <div className="fixed bottom-6 right-6 z-50">
                    <Link
                        to={`/admin/website/edit/${page.id}`}
                        className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-zinc-800 transition-transform hover:scale-105"
                    >
                        <Edit2 size={16} />
                        <span className="font-medium text-sm">Edit Platform Page</span>
                    </Link>
                </div>
            )}
        </div>
    );
}
