import { useParams } from "react-router";
import { GuestChatWidget } from "../components/chat/GuestChatWidget";

export default function PublicSupportPage() {
    const { slug } = useParams();
    const apiUrl = import.meta.env.VITE_API_URL || '';

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 flex items-center justify-center p-8">
            <div className="text-center max-w-lg">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                    Need Help?
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                    Click the chat button in the bottom right corner to start a conversation with our support team.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Support is online
                </div>
            </div>

            {slug && (
                <GuestChatWidget
                    tenantSlug={slug}
                    apiUrl={apiUrl}
                    brandColor="#3B82F6"
                />
            )}
        </div>
    );
}
