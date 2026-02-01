// Puck Editor Page - Visual editor for building website pages

import { useLoaderData, useNavigate, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { Puck, Data } from "@puckeditor/core";
import "@puckeditor/core/dist/index.css";
import { puckConfig } from "../components/website/puck-config";
import { Save, ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;
    const pageId = args.params.pageId;

    try {
        // Fetch page by ID (need to add this endpoint or use slug)
        const pages = await apiRequest<any[]>("/website/pages", token, {
            headers: { "X-Tenant-Slug": slug }
        });
        const page = pages.find((p: any) => p.id === pageId);

        if (!page) {
            throw new Error("Page not found");
        }

        return { page, error: null, slug };
    } catch (e: any) {
        return { page: null, error: e.message, slug };
    }
};

export default function WebsiteEditor() {
    const { page: initialPage, error, slug } = useLoaderData<any>();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [data, setData] = useState(initialPage?.content || { root: { props: {} }, content: [] });

    const handleSave = async (puckData: any) => {
        setSaving(true);
        try {
            const token = await getToken();
            await apiRequest(`/website/pages/${params.pageId}`, token, {
                method: "PUT",
                headers: { "X-Tenant-Slug": slug },
                body: JSON.stringify({ content: puckData }),
            });
            setLastSaved(new Date());
            toast.success("Page saved");
        } catch (e: any) {
            toast.error("Failed to save: " + e.message);
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
                    onClick={() => navigate(`/studio/${slug}/website/pages`)}
                    className="mt-4 text-blue-600 hover:underline flex items-center gap-2"
                >
                    <ArrowLeft size={16} /> Back to Pages
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            {/* Editor Header */}
            <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/studio/${slug}/website/pages`)}
                        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900"
                    >
                        <ArrowLeft size={18} />
                        <span className="text-sm">Back</span>
                    </button>
                    <div className="h-6 w-px bg-zinc-200" />
                    <div>
                        <h1 className="font-medium text-zinc-900">{initialPage?.title}</h1>
                        <p className="text-xs text-zinc-500">/{initialPage?.slug}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastSaved && (
                        <span className="text-xs text-zinc-400">
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={() => window.open(`/site/${slug}/${initialPage?.slug}`, '_blank')}
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
                <Puck
                    config={puckConfig}
                    data={data}
                    onPublish={handleSave}
                    onChange={setData}
                />
            </div>
        </div>
    );
}
