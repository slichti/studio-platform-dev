// @ts-ignore
import { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Link, useRevalidator, useSearchParams } from "react-router";
import { apiRequest } from "~/utils/api";
import { getAuth } from "@clerk/react-router/server";
import { formatBytes } from "~/utils/format";
import { FileVideo, Scissors, Trash2, Upload, X, Image as ImageIcon, Tag, Film, Info, Check, Plus, Save } from "lucide-react";
import { useState, useEffect } from "react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug!;

    // Parallel fetch: Videos and Images
    try {
        const [videoData, imageData] = await Promise.all([
            apiRequest(`/video-management/`, token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest(`/uploads/images`, token, { headers: { 'X-Tenant-Slug': slug } })
        ]);

        return {
            videos: videoData?.videos || [],
            storageUsage: videoData?.storageUsage || 0,
            images: imageData || []
        };
    } catch (e) {
        console.error("Loader Failed", e);
        return {
            videos: [],
            storageUsage: 0,
            images: []
        };
    }
};

export default function StudioMediaLibrary() {
    const { videos, storageUsage, images } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();

    // Tab State
    const currentTab = searchParams.get('tab') || 'videos';

    // Upload State
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selection State (for Details Drawer)
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const handleVideoUpload = async (file: File) => {
        setUploading(true);
        setError(null);
        try {
            const token = await (window as any).Clerk?.session?.getToken();

            // 1. Get One-Time Upload URL for VOD
            const { uploadUrl, uid } = await apiRequest('/video-management/upload-url', token, {
                method: 'POST',
                body: JSON.stringify({ type: 'vod' })
            });

            // 2. Upload to Cloudflare
            const formData = new FormData();
            formData.append('file', file);

            const cfUpload = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!cfUpload.ok) throw new Error("Upload to video server failed");

            // 3. Register Video in DB
            await apiRequest('/video-management/', token, {
                method: 'POST',
                body: JSON.stringify({
                    title: file.name,
                    cloudflareStreamId: uid,
                })
            });

            revalidator.revalidate();
        } catch (e: any) {
            console.error(e);
            setError("Upload failed: " + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleImageUpload = async (file: File) => {
        setUploading(true);
        setError(null);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const formData = new FormData();
            formData.append('file', file);

            // Using Fetch directly for multipart
            const response = await fetch('/api/r2-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) throw new Error("Image upload failed");

            revalidator.revalidate();
        } catch (e: any) {
            setError("Upload failed: " + e.message);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-zinc-50/50">
                <div className="p-6 border-b border-zinc-200 bg-white">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900">Media Library</h1>
                            <p className="text-zinc-500">Manage your class recordings and photo assets.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="bg-zinc-100 px-4 py-2 rounded-lg text-sm">
                                <span className="font-medium text-zinc-600">Storage Used: </span>
                                <span className="font-bold">{formatBytes(storageUsage)}</span>
                            </div>

                            {currentTab === 'videos' ? (
                                <label className={`bg-black text-white px-4 py-2 rounded-lg font-medium cursor-pointer hover:bg-zinc-800 transition flex items-center gap-2 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    <Upload size={18} />
                                    {uploading ? 'Uploading...' : 'Upload Video'}
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                                        disabled={uploading}
                                    />
                                </label>
                            ) : (
                                <label className={`bg-black text-white px-4 py-2 rounded-lg font-medium cursor-pointer hover:bg-zinc-800 transition flex items-center gap-2 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    <ImageIcon size={18} />
                                    {uploading ? 'Uploading...' : 'Upload Image'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                        disabled={uploading}
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-6 border-b border-zinc-100 -mb-px">
                        <button
                            onClick={() => setSearchParams({ tab: 'videos' })}
                            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${currentTab === 'videos' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                        >
                            <Film size={16} /> Videos ({videos.length})
                        </button>
                        <button
                            onClick={() => setSearchParams({ tab: 'images' })}
                            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${currentTab === 'images' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                        >
                            <ImageIcon size={16} /> Photos ({images.length})
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
                            {error}
                            <button onClick={() => setError(null)}><X size={14} /></button>
                        </div>
                    )}

                    {currentTab === 'videos' ? (
                        <VideoList videos={videos} onSelect={setSelectedItem} selectedId={selectedItem?.id} />
                    ) : (
                        <ImageList images={images} onSelect={setSelectedItem} selectedId={selectedItem?.id} />
                    )}
                </div>
            </div>

            {/* Details Sidebar */}
            {selectedItem && (
                <DetailsSidebar
                    item={selectedItem}
                    type={currentTab === 'videos' ? 'video' : 'image'}
                    onClose={() => setSelectedItem(null)}
                    onUpdate={() => {
                        // Refresh data but keep selection if possible (or just close)
                        revalidator.revalidate();
                    }}
                />
            )}
        </div>
    );
}

function VideoList({ videos, onSelect, selectedId }: any) {
    if (videos.length === 0) return <div className="text-gray-400 text-center py-20">No videos found.</div>;
    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 border-b font-medium text-zinc-500">
                    <tr>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Tags</th>
                        <th className="px-4 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {videos.map((vid: any) => (
                        <tr
                            key={vid.id}
                            onClick={() => onSelect(vid)}
                            className={`cursor-pointer hover:bg-zinc-50 transition ${selectedId === vid.id ? 'bg-blue-50/50' : ''}`}
                        >
                            <td className="px-4 py-3 font-medium text-zinc-900">{vid.title}</td>
                            <td className="px-4 py-3 text-zinc-500">{vid.duration ? Math.floor(vid.duration / 60) + 'm' : '--'}</td>
                            <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                    {vid.tags?.slice(0, 3).map((t: string) => (
                                        <span key={t} className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs">{t}</span>
                                    ))}
                                    {vid.tags?.length > 3 && <span className="text-xs text-zinc-400">+{vid.tags.length - 3}</span>}
                                </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button className="text-zinc-400 hover:text-zinc-600"><Info size={16} /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function ImageList({ images, onSelect, selectedId }: any) {
    if (images.length === 0) return <div className="text-gray-400 text-center py-20">No images found.</div>;
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img: any) => (
                <div
                    key={img.id}
                    onClick={() => onSelect(img)}
                    className={`bg-white rounded border aspect-square relative group cursor-pointer overflow-hidden ${selectedId === img.id ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:border-zinc-300'}`}
                >
                    <img src={img.fileUrl} alt={img.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <p className="text-white text-sm font-medium truncate">{img.title || img.originalName}</p>
                        <p className="text-white/80 text-xs">{formatBytes(img.sizeBytes)}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}

function DetailsSidebar({ item, type, onClose, onUpdate }: any) {
    const [title, setTitle] = useState(item.title || item.originalName || "");
    const [description, setDescription] = useState(item.description || "");
    const [tags, setTags] = useState<string[]>(item.tags || []);

    // Derived state for input
    const [tagInput, setTagInput] = useState("");
    const [saving, setSaving] = useState(false);

    // Sync when item changes
    useEffect(() => {
        setTitle(item.title || item.originalName || "");
        setDescription(item.description || "");
        setTags(item.tags || []);
        setTagInput("");
    }, [item]);

    const handleAddTag = (e: any) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput("");
        }
    }

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    }

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const endpoint = type === 'video' ? `/video-management/${item.id}` : `/uploads/images/${item.id}`;

            await apiRequest(endpoint, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    title,
                    description,
                    tags
                })
            });
            onUpdate();
        } catch (e) {
            console.error(e);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="w-80 bg-white border-l border-zinc-200 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <span className="font-semibold text-sm uppercase text-zinc-500 tracking-wide">{type} Details</span>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Preview */}
                <div className="aspect-video bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center">
                    {type === 'image' ? (
                        <img src={item.fileUrl} className="w-full h-full object-contain" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-zinc-400">
                            <Film size={24} />
                            <span className="text-xs">No preview available</span>
                        </div>
                    )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                    <div className="bg-zinc-50 p-2 rounded">
                        <span className="block font-medium text-zinc-700">Size</span>
                        {formatBytes(item.sizeBytes)}
                    </div>
                    <div className="bg-zinc-50 p-2 rounded">
                        <span className="block font-medium text-zinc-700">Created</span>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Tags / Labels</label>
                        <div className="min-h-[40px] p-2 border border-zinc-200 rounded-lg bg-white flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-black focus-within:border-transparent">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-xs font-medium">
                                    {tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={10} /></button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder={tags.length === 0 ? "Type and enter..." : ""}
                                className="flex-1 min-w-[60px] text-sm outline-none bg-transparent"
                            />
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">Press Enter to add tag</p>
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {saving ? 'Saving...' : <><Save size={16} /> Save Usage</>}
                </button>
            </div>
        </div>
    )
}
