
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { useLoaderData, useSubmit, Link, redirect, useRevalidator, Form } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Search, X, Check, MoreVertical } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { formatDuration } from "~/utils/format";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug, id } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        // Fetch collection details (with items) and ALL videos for selection
        const [collection, videosData] = await Promise.all([
            apiRequest(`/video-management/collections/${id}`, token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest(`/video-management`, token, { headers: { 'X-Tenant-Slug': slug } })
        ]) as [any, any];

        return {
            collection,
            allVideos: videosData.videos || []
        };
    } catch (e) {
        console.error("Collection Loader Error", e);
        throw new Response("Collection not found", { status: 404 });
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug, id } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'update_details') {
        const title = formData.get("title");
        const description = formData.get("description");
        const urlSlug = formData.get("slug");

        await apiRequest(`/video-management/collections/${id}`, token, {
            method: 'PATCH',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ title, description, slug: urlSlug })
        });
    }

    if (intent === 'add_item') {
        const videoId = formData.get("videoId");
        await apiRequest(`/video-management/collections/${id}/items`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ action: 'add', videoId })
        });
    }

    if (intent === 'remove_item') {
        const itemId = formData.get("itemId");
        await apiRequest(`/video-management/collections/${id}/items`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ action: 'remove', itemId })
        });
    }

    if (intent === 'delete_collection') {
        await apiRequest(`/video-management/collections/${id}`, token, {
            method: 'DELETE',
            headers: { 'X-Tenant-Slug': slug }
        });
        return redirect(`/studio/${slug}/videos?tab=collections`);
    }

    return { success: true };
};

export default function CollectionDetails() {
    const { collection, allVideos } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const revalidator = useRevalidator();

    // UI States
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [editing, setEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Filter available videos (exclude already in collection)
    const existingVideoIds = new Set(collection.items.map((i: any) => i.videoId));
    const availableVideos = allVideos.filter((v: any) =>
        !existingVideoIds.has(v.id) &&
        v.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    }

    const handleConfirmDelete = () => {
        submit({ intent: 'delete_collection' }, { method: 'post' });
    }

    const handleAddItem = (videoId: string) => {
        submit({ intent: 'add_item', videoId }, { method: 'post', preventScrollReset: true });
        // Optimistic UI update or wait for revalidation? Revalidation is safer.
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="../?tab=collections" className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500 transition">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">{collection.title}</h1>
                        <div className="text-sm text-zinc-500 font-mono">/{collection.slug}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                    >
                        Edit Details
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-transparent rounded-lg hover:bg-red-100"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Video
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-8">

                {/* Items List */}
                <div>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        Videos <span className="text-zinc-400 font-normal text-sm">({collection.items.length})</span>
                    </h2>

                    <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                        {collection.items.map((item: any, index: number) => (
                            <div key={item.id} className="p-4 flex items-center gap-4 group hover:bg-zinc-50 transition">
                                <div className="text-zinc-400 cursor-move hover:text-zinc-600">
                                    <GripVertical size={20} />
                                </div>
                                <div className="w-16 h-10 bg-zinc-100 rounded overflow-hidden border border-zinc-200 shrink-0">
                                    {item.video?.posterUrl ? (
                                        <img src={item.video.posterUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-300 bg-zinc-50">
                                            <span className="text-[10px]">No Img</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-zinc-900 truncate">{item.video?.title || "Unknown Video"}</div>
                                    <div className="text-xs text-zinc-500 flex gap-3">
                                        <span>{formatDuration(item.video?.duration || 0)}</span>
                                        <span className="capitalize">{item.video?.status}</span>
                                    </div>
                                </div>

                                <Form method="post" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <input type="hidden" name="intent" value="remove_item" />
                                    <input type="hidden" name="itemId" value={item.id} />
                                    <button className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                                        <Trash2 size={16} />
                                    </button>
                                </Form>
                            </div>
                        ))}
                        {collection.items.length === 0 && (
                            <div className="p-12 text-center text-zinc-500">
                                This collection is empty.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Video Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full h-[600px] flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Add Video to Collection</h3>
                            <button onClick={() => setIsAddOpen(false)}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                        </div>
                        <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search library..."
                                    className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-black/5"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {availableVideos.map((video: any) => (
                                <div key={video.id} className="p-3 hover:bg-zinc-50 rounded-lg flex items-center justify-between group transition">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-8 bg-zinc-100 rounded flex-shrink-0 border border-zinc-200">
                                            {video.posterUrl && <img src={video.posterUrl} className="w-full h-full object-cover rounded" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-zinc-900">{video.title}</div>
                                            <div className="text-xs text-zinc-500 font-mono">{formatDuration(video.duration)}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAddItem(video.id)}
                                        className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded hover:bg-zinc-800 transition"
                                    >
                                        Add
                                    </button>
                                </div>
                            ))}
                            {availableVideos.length === 0 && (
                                <div className="p-8 text-center text-sm text-zinc-500">
                                    {searchQuery ? "No videos found matching search." : "No video available to add."}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Details Sidebar/Modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setEditing(false)} />
                    <div className="relative w-full max-w-md bg-white shadow-2xl h-full p-6 animate-in slide-in-from-right duration-200">
                        <h3 className="text-xl font-bold mb-6">Edit Collection</h3>
                        <Form method="post" onSubmit={() => setEditing(false)} className="space-y-4">
                            <input type="hidden" name="intent" value="update_details" />
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
                                <input type="text" name="title" defaultValue={collection.title} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Slug (URL)</label>
                                <input type="text" name="slug" defaultValue={collection.slug} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5 font-mono text-sm" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                                <textarea name="description" defaultValue={collection.description} rows={4} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5 resize-none" />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800">Save Changes</button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Delete Collection"
                description="Are you sure you want to delete this collection? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    );
}
