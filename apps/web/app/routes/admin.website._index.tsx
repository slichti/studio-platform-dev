// Admin Website Builder - Platform main site pages management

import { useLoaderData, Link, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Plus, Edit2, Trash2, Eye, EyeOff, Globe, FileText, ExternalLink, X } from "lucide-react";
import { ConfirmationDialog, ErrorDialog } from "~/components/Dialogs";

function SitePreviewModal({ isOpen, onClose, url }: { isOpen: boolean, onClose: () => void, url: string }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-8 animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full h-full flex flex-col shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
                            <Globe size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Platform Site Preview</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-md">{url}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 relative">
                    <iframe
                        src={url}
                        className="w-full h-full border-none"
                        title="Platform Preview"
                    />
                </div>
            </div>
        </div>
    );
}

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const pages = await apiRequest<any[]>("/platform-pages/pages", token);
        return { pages, error: null };
    } catch (e: any) {
        return { pages: [], error: e.message };
    }
};

export default function AdminWebsite() {
    const { pages: initialPages, error } = useLoaderData<any>();
    const [pages, setPages] = useState<any[]>(initialPages || []);
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [creating, setCreating] = useState(false);
    const [newPage, setNewPage] = useState({ title: "", slug: "" });

    // Dialog State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [errorState, setErrorState] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!newPage.title || !newPage.slug) return;

        try {
            const token = await getToken();
            const created = await apiRequest<any>("/platform-pages/pages", token, {
                method: "POST",
                body: JSON.stringify(newPage),
            });
            setPages([...pages, created]);
            setCreating(false);
            setNewPage({ title: "", slug: "" });
        } catch (e: any) {
            setErrorState({ isOpen: true, message: "Failed to create page: " + e.message });
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            const token = await getToken();
            await apiRequest(`/platform-pages/pages/${deleteId}`, token, {
                method: "DELETE",
            });
            setPages(pages.filter(p => p.id !== deleteId));
            setDeleteId(null);
        } catch (e: any) {
            setErrorState({ isOpen: true, message: "Failed to delete: " + e.message });
        }
    };

    const handleTogglePublish = async (page: any) => {
        try {
            const token = await getToken();
            await apiRequest(`/platform-pages/pages/${page.id}/publish`, token, {
                method: "POST",
                body: JSON.stringify({ isPublished: !page.isPublished }),
            });
            setPages(pages.map(p => p.id === page.id ? { ...p, isPublished: !p.isPublished } : p));
        } catch (e: any) {
            setErrorState({ isOpen: true, message: "Failed to update: " + e.message });
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
            <ConfirmationDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Delete Page"
                message="Are you sure you want to delete this page? This cannot be undone."
                confirmText="Delete"
                isDestructive={true}
            />

            <ErrorDialog
                isOpen={errorState.isOpen}
                onClose={() => setErrorState({ ...errorState, isOpen: false })}
                message={errorState.message}
            />

            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <Globe size={24} className="text-white" />
                        </div>
                        Platform Website Builder
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Design and manage the core presence of the Studio Platform.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPreviewUrl("/")}
                        className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-6 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all font-bold shadow-sm"
                    >
                        <Eye size={20} />
                        Preview Site
                    </button>
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-xl hover:scale-105 transition-all shadow-xl font-bold"
                    >
                        <Plus size={20} />
                        Create Page
                    </button>
                </div>
            </div>

            <SitePreviewModal
                isOpen={!!previewUrl}
                onClose={() => setPreviewUrl(null)}
                url={previewUrl || ""}
            />

            {/* Create Modal */}
            {creating && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-lg font-semibold mb-4 dark:text-zinc-100">Create New Platform Page</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Page Title</label>
                                <input
                                    type="text"
                                    value={newPage.title}
                                    onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    placeholder="e.g., About Us"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">URL Slug</label>
                                <input
                                    type="text"
                                    value={newPage.slug}
                                    onChange={(e) => setNewPage({ ...newPage, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    placeholder="e.g., about"
                                />
                                <p className="text-xs text-zinc-400 mt-1">studio-platform.com/{newPage.slug || "slug"}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setCreating(false)} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Create Page
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Links */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 mb-8 text-white">
                <h2 className="font-semibold mb-3">Common Pages</h2>
                <p className="text-white/70 text-sm mb-4">Create pages for these common routes if they don't exist:</p>
                <div className="flex gap-2 flex-wrap">
                    {['home', 'pricing', 'about', 'contact', 'features'].map(slug => {
                        const exists = pages.some(p => p.slug === slug);
                        return (
                            <span
                                key={slug}
                                className={`px-3 py-1 rounded-full text-sm ${exists ? 'bg-white/20' : 'bg-white/10 opacity-60'}`}
                            >
                                /{slug} {exists ? '✓' : ''}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Pages List */}
            {pages.length === 0 ? (
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center">
                    <FileText size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">No platform pages yet</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">Create your first page to customize the main site</p>
                    <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
                    >
                        <Plus size={18} />
                        Create First Page
                    </button>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pages.map((page) => (
                        <div key={page.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${page.isPublished ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{page.title}</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">/{page.slug}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${page.isPublished ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                                    {page.isPublished ? 'Published' : 'Draft'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTogglePublish(page)}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400"
                                    title={page.isPublished ? 'Unpublish' : 'Publish'}
                                >
                                    {page.isPublished ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <a
                                    href={page.slug === 'home' ? '/' : `/${page.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400"
                                >
                                    <ExternalLink size={18} />
                                </a>
                                <Link
                                    to={`/admin/website/edit/${page.id}`}
                                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"
                                >
                                    <Edit2 size={18} />
                                </Link>
                                <button
                                    onClick={() => setDeleteId(page.id)}
                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400"
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
