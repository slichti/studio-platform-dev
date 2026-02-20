// Platform Website Editor - Puck visual editor for platform pages

import { useLoaderData, useNavigate, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, lazy, Suspense } from "react";
import { useAuth } from "@clerk/react-router";
// Lazy load Puck to avoid Cloudflare Worker global scope side-effects
const PuckEditorWrapper = lazy(() => import("../components/website/PuckEditorWrapper.client").then(m => ({ default: m.PuckEditorWrapper })));
import { Save, ArrowLeft, Eye, Loader2 } from "lucide-react";
import { ErrorDialog } from "~/components/Dialogs";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const pageId = args.params.pageId;

    try {
        const pages = await apiRequest<any[]>("/platform-pages/pages", token);
        const page = pages.find((p: any) => p.id === pageId);

        if (!page) {
            throw new Error("Page not found");
        }

        return { page, error: null };
    } catch (e: any) {
        return { page: null, error: e.message };
    }
};

export default function PlatformWebsiteEditor() {
    const { page: initialPage, error } = useLoaderData<any>();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [data, setData] = useState(initialPage?.content || { root: { props: {} }, content: [] });
    const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });

    const handleSave = async (puckData: any) => {
        setSaving(true);
        try {
            const token = await getToken();
            await apiRequest(`/platform-pages/pages/${params.pageId}`, token, {
                method: "PUT",
                body: JSON.stringify({ content: puckData }),
            });
            setLastSaved(new Date());
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: "Failed to save: " + e.message });
        } finally {
            setSaving(false);
        }
    };

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    Error: {error}
                </div>
                <button
                    onClick={() => navigate("/admin/website")}
                    className="mt-4 text-blue-600 hover:underline flex items-center gap-2"
                >
                    <ArrowLeft size={16} /> Back to Pages
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            <ErrorDialog
                isOpen={errorDialog.isOpen}
                onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })}
                message={errorDialog.message}
            />
            {/* Editor Header */}
            <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/admin/website")}
                        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900"
                    >
                        <ArrowLeft size={18} />
                        <span className="text-sm">Back</span>
                    </button>
                    <div className="h-6 w-px bg-zinc-200" />
                    <div>
                        <h1 className="font-medium text-zinc-900">{initialPage?.title}</h1>
                        <p className="text-xs text-zinc-500">/{initialPage?.slug} • Platform Page</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastSaved && (
                        <span className="text-xs text-zinc-400">
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={() => {
                            const url = initialPage?.slug === 'home' ? '/' : `/${initialPage?.slug}`;
                            window.open(url, '_blank');
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg"
                    >
                        <Eye size={16} />
                        Preview
                    </button>
                    <button
                        onClick={() => handleSave(data)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {/* Puck Editor */}
            <div className="flex-1 overflow-hidden">
                <Suspense fallback={
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                    </div>
                }>
                    <PuckEditorWrapper
                        data={data}
                        onPublish={handleSave}
                        onChange={setData}
                    />
                </Suspense>
            </div>
        </div>
    );
}
