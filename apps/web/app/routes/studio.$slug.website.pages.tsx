// Website Pages Manager - List and manage website pages for a studio

import { useLoaderData, Link, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Plus, Edit2, Trash2, Eye, EyeOff, Globe, FileText } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const pages = await apiRequest<any[]>("/website/pages", token, {
            headers: { "X-Tenant-Slug": slug }
        });
        return { pages, error: null, slug };
    } catch (e: any) {
        return { pages: [], error: e.message, slug };
    }
};

export default function WebsitePagesManager() {
    const { pages: initialPages, error, slug } = useLoaderData<any>();
    const [pages, setPages] = useState<any[]>(initialPages || []);
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [creating, setCreating] = useState(false);
    const [newPage, setNewPage] = useState({ title: "", slug: "" });

    const handleCreate = async () => {
        if (!newPage.title || !newPage.slug) return;

        try {
            const token = await getToken();
            const created = await apiRequest<any>("/website/pages", token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug },
                body: JSON.stringify(newPage),
            });
            setPages([...pages, created]);
            setCreating(false);
            setNewPage({ title: "", slug: "" });
        } catch (e: any) {
            alert("Failed to create page: " + e.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this page?")) return;

        try {
            const token = await getToken();
            await apiRequest(`/website/pages/${id}`, token, {
                method: "DELETE",
                headers: { "X-Tenant-Slug": slug },
            });
            setPages(pages.filter(p => p.id !== id));
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    const handleTogglePublish = async (page: any) => {
        try {
            const token = await getToken();
            await apiRequest(`/website/pages/${page.id}/publish`, token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug },
                body: JSON.stringify({ isPublished: !page.isPublished }),
            });
            setPages(pages.map(p => p.id === page.id ? { ...p, isPublished: !p.isPublished } : p));
        } catch (e: any) {
            alert("Failed to update: " + e.message);
        }
    };

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                        <Globe className="text-blue-600" />
                        Website Builder
                    </h1>
                    <p className="text-zinc-500 mt-1">Create and manage your studio website pages</p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    New Page
                </button>
            </div>

            {/* Create Modal */}
            {creating && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-lg font-semibold mb-4">Create New Page</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Page Title</label>
                                <input
                                    type="text"
                                    value={newPage.title}
                                    onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                                    className="w-full border border-zinc-300 rounded-lg px-3 py-2"
                                    placeholder="e.g., About Us"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">URL Slug</label>
                                <input
                                    type="text"
                                    value={newPage.slug}
                                    onChange={(e) => setNewPage({ ...newPage, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                    className="w-full border border-zinc-300 rounded-lg px-3 py-2"
                                    placeholder="e.g., about"
                                />
                                <p className="text-xs text-zinc-400 mt-1">yoursite.com/{newPage.slug || "slug"}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setCreating(false)} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Create Page
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pages List */}
            {pages.length === 0 ? (
                <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center">
                    <FileText size={48} className="mx-auto text-zinc-300 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-700 mb-2">No pages yet</h3>
                    <p className="text-zinc-500 mb-4">Create your first page to start building your website</p>
                    <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
                    >
                        <Plus size={18} />
                        Create First Page
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-zinc-200 divide-y">
                    {pages.map((page) => (
                        <div key={page.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${page.isPublished ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-zinc-900">{page.title}</h3>
                                    <p className="text-sm text-zinc-500">/{page.slug}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${page.isPublished ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                    {page.isPublished ? 'Published' : 'Draft'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTogglePublish(page)}
                                    className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600"
                                    title={page.isPublished ? 'Unpublish' : 'Publish'}
                                >
                                    {page.isPublished ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <Link
                                    to={`/studio/${slug}/website/editor/${page.id}`}
                                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                                >
                                    <Edit2 size={18} />
                                </Link>
                                <button
                                    onClick={() => handleDelete(page.id)}
                                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
