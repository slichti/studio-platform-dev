import { type LoaderFunctionArgs, type MetaFunction, Link, useLoaderData } from "react-router";
import { Render } from "@measured/puck"; // Use Render, not Puck directly
import { puckConfig } from "~/components/website/puck-config";
import { apiRequest } from "~/utils/api";
import { SignedIn, useUser } from "@clerk/react-router";
import { Edit2 } from "lucide-react";
import { ChatWidget } from "~/components/chat/ChatWidget";

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
    const { slug, pageSlug } = params;

    try {
        // Fetch page content (public endpoint)
        // We use the tenant slug header to identify the tenant
        // No auth token needed for public page viewing
        const page = await apiRequest<any>(`/website/pages/${pageSlug}`, null, {
            headers: {
                "X-Tenant-Slug": slug || ""
            }
        });

        return { page, tenantSlug: slug };
    } catch (e: any) {
        console.error("Failed to load page:", e);
        throw new Response("Page Not Found", { status: 404 });
    }
};

export default function WebsitePage() {
    const { page, tenantSlug } = useLoaderData<typeof loader>();
    const { user } = useUser();

    // Check if user is authorized to edit (Owner of the tenant)
    // We can check Clerk metadata or just show it if they are logged in and let the editor enforce perms
    const canEdit = user?.publicMetadata?.isSystemAdmin || true; // Simply show if logged in, editor will 403 if not active member

    return (
        <div className="min-h-screen bg-white relative">
            <Render config={puckConfig} data={page.content} />

            <ChatWidget
                roomId={user ? `support-${user.id}` : "support-guest"}
                tenantSlug={tenantSlug || ""}
                userId={user?.id}
                userName={user?.fullName || "Guest"}
            />

            <SignedIn>
                <div className="fixed bottom-6 left-6 z-50">
                    <Link
                        to={`/studio/${tenantSlug}/website/editor/${page.id}`}
                        className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-zinc-800 transition-transform hover:scale-105"
                    >
                        <Edit2 size={16} />
                        <span className="font-medium text-sm">Edit Page</span>
                    </Link>
                </div>
            </SignedIn>
        </div>
    );
}
