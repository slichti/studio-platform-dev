import { Link } from "react-router";
import { Render, Data } from "@puckeditor/core";
import { puckConfig } from "~/components/website/puck-config";
import { SignedIn, useUser } from "@clerk/react-router";
import { Edit2 } from "lucide-react";
import { ChatWidget } from "~/components/chat/ChatWidget";

interface PublicPageRendererProps {
    page: any;
    tenantSlug: string;
}

export function PublicPageRenderer({ page, tenantSlug }: PublicPageRendererProps) {
    const { user } = useUser();

    return (
        <div className="min-h-screen bg-white relative">
            <Render config={puckConfig} data={page.content} />

            <ChatWidget
                roomId={user ? `support-${user.id}` : "support-guest"}
                tenantId={tenantSlug || ""}
                userId={user?.id}
                userName={user?.fullName || "Guest"}
                enabled={
                    page.tenantSettings?.chatEnabled !== false &&
                    page.content?.root?.props?.chatEnabled !== false
                }
                chatConfig={page.tenantSettings?.chatConfig}
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
