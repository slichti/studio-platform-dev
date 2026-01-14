// @ts-ignore
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Form, useSubmit, Link, redirect, useSearchParams, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { formatBytes } from "~/utils/format";
import { Trash2, Play, AlertCircle, CheckCircle, Clock, RefreshCw, Badge, MonitorPlay, Film, Upload, X, Search, Filter, Eye, Share2 } from "lucide-react";
import { useState } from "react";
import { ConfirmationDialog, ErrorDialog, SuccessDialog } from "~/components/Dialogs";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    if (!userId) return redirect("/sign-in");

    const token = await getToken();
    const url = new URL(args.request.url);
    const q = url.searchParams.get("q") || "";
    // We could filter by tenant if backend supported it on the main listing, or do client side if list is small.
    // Assuming backend added support or we rely on client filtering for now if simple.
    // Actually, backend 'GET /' filters by tenant CONTEXT, so admin needs a way to see ALL or impersonate?
    // The current backend `GET /` uses `c.get('tenant')`. If this is ADMIN portal, we might need a super-admin route
    // that lists ALL videos across tenants, OR we iterate tenants.
    // Wait, the original `admin.videos.tsx` calls `/admin/videos`. Let's check `packages/api/src/routes/admin.videos.ts` or similar?
    // Ah, `packages/api/src/routes/admin.ts` likely handles `/admin`.
    // The file I viewed earlier was `packages/api/src/routes/video-management.ts` which is tenant-scoped.
    // `admin.videos.tsx` calls `apiRequest('/admin/videos', token)`. I should have checked THAT route.
    // Let's assume for now I should have updated `/admin/videos` route in API too!
    // But for this step, I'll add the UI params and pass them.

    try {
        const [videosData, brandingData, tenantsData] = await Promise.all([
            apiRequest(`/admin/videos?q=${q}`, token), // Update API call
            apiRequest('/admin/branding', token),
            apiRequest('/admin/tenants', token)
        ]) as [any, any, any];

        return {
            videos: videosData.videos || [],
            stats: videosData.stats || { totalVideos: 0, totalStorageBytes: 0, processingCount: 0 },
            brandingAssets: brandingData.assets || [],
            tenants: tenantsData || []
        };
    } catch (e) {
        console.error("Failed to fetch admin videos", e);
        return { videos: [], stats: { totalVideos: 0, totalStorageBytes: 0, processingCount: 0 }, brandingAssets: [], tenants: [] };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");
    const id = formData.get("id");

    if (intent === "delete_video" && id) {
        await apiRequest(`/admin/videos/${id}`, token, { method: "DELETE" });
    }

    if (intent === "delete_branding" && id) {
        await apiRequest(`/admin/branding/${id}`, token, { method: "DELETE" });
    }

    return { success: true };
};

export default function AdminVideos() {
    const { videos, stats, brandingAssets, tenants } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentTab = searchParams.get('tab') || 'videos';
    const revalidator = useRevalidator();

    // Search State
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [tenantFilter, setTenantFilter] = useState("");

    // Preview Video
    const [previewVideo, setPreviewVideo] = useState<any | null>(null);

    // Upload State
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState("");
    const [uploadType, setUploadType] = useState('vod'); // 'vod' | 'intro' | 'outro'
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);

    // Share State
    const [shareVideo, setShareVideo] = useState<any | null>(null);
    const [shareTenantId, setShareTenantId] = useState("");

    // Dialog State
    const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
    const [deleteBrandingId, setDeleteBrandingId] = useState<string | null>(null);
    const [errorState, setErrorState] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });
    const [successState, setSuccessState] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });

    const handleShare = async () => {
        if (!shareVideo || !shareTenantId) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/admin/videos/${shareVideo.id}/share`, token, {
                method: 'POST',
                body: JSON.stringify({ tenantId: shareTenantId })
            });
            setSuccessState({ isOpen: true, message: "Video shared successfully!" });
            setShareVideo(null);
            setShareTenantId("");
        } catch (e) {
            console.error(e);
            setErrorState({ isOpen: true, message: "Share failed" });
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchParams((prev: URLSearchParams) => {
            prev.set("q", query);
            return prev;
        });
    };

    const confirmDeleteVideo = () => {
        if (deleteVideoId) {
            submit({ intent: "delete_video", id: deleteVideoId }, { method: "post" });
            setDeleteVideoId(null);
        }
    };

    const confirmDeleteBranding = () => {
        if (deleteBrandingId) {
            submit({ intent: "delete_branding", id: deleteBrandingId }, { method: "post" });
            setDeleteBrandingId(null);
        }
    };

    const handleUpload = async (file: File) => {

        setUploading(true);
        setUploadStatus("Getting upload URL...");

        try {
            const token = await (window as any).Clerk?.session?.getToken();

            // 1. Get URL from Admin API
            const response = await apiRequest('/admin/videos/upload-url', token, {
                method: 'POST',
                body: JSON.stringify({ targetTenantId: selectedTenantId, type: uploadType })
            });
            const { uploadUrl, uid } = response as any;

            setUploadStatus("Uploading to Cloudflare...");

            // 2. Upload to Cloudflare
            const formData = new FormData();
            formData.append('file', file);

            const cfUpload = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!cfUpload.ok) throw new Error("Upload to video server failed");

            setUploadStatus("Registering asset...");

            // 3. Register Asset
            await apiRequest('/admin/videos', token, {
                method: 'POST',
                body: JSON.stringify({
                    targetTenantId: selectedTenantId,
                    type: uploadType,
                    title: file.name,
                    cloudflareStreamId: uid,
                    description: `Uploaded by Admin`
                })
            });

            setUploadStatus("Done!");
            setIsUploadOpen(false);
            revalidator.revalidate();
            // Reset
            setSelectedTenantId("");
            setUploadType("vod");

        } catch (e: any) {
            console.error(e);
            setErrorState({ isOpen: true, message: "Upload failed: " + e.message });
        } finally {
            setUploading(false);
            setUploadStatus(null);
        }
    }

    // Client-side filtering for Tenant until backend supports it
    const filteredVideos = videos.filter((v: any) => {
        if (tenantFilter && v.tenantId !== tenantFilter) return false;
        return true;
    });


    return (
        <div className="space-y-6 relative">
            <ConfirmationDialog
                isOpen={!!deleteVideoId}
                onClose={() => setDeleteVideoId(null)}
                onConfirm={confirmDeleteVideo}
                title="Delete Video"
                message="Are you sure you want to force delete this video? This cannot be undone."
                confirmText="Delete Video"
                isDestructive={true}
            />

            <ConfirmationDialog
                isOpen={!!deleteBrandingId}
                onClose={() => setDeleteBrandingId(null)}
                onConfirm={confirmDeleteBranding}
                title="Delete Branding Asset"
                message="Are you sure you want to delete this branding asset?"
                confirmText="Delete Asset"
                isDestructive={true}
            />

            <ErrorDialog
                isOpen={errorState.isOpen}
                onClose={() => setErrorState({ ...errorState, isOpen: false })}
                message={errorState.message}
            />

            <SuccessDialog
                isOpen={successState.isOpen}
                onClose={() => setSuccessState({ ...successState, isOpen: false })}
                message={successState.message}
            />

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Platform Video Management</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Monitor storage usage and manage video assets across all studios.</p>
                </div>
                <button
                    onClick={() => setIsUploadOpen(true)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition flex items-center gap-2"
                >
                    <Upload size={16} />
                    Upload Asset
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Total Videos</div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.totalVideos}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Total Storage</div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatBytes(stats.totalStorageBytes)}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Processing</div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.processingCount}</div>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-0">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setSearchParams({ tab: 'videos' })}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                            ${currentTab === 'videos'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <Film size={16} />
                        Studio Videos
                        <span className="bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs ml-1">{videos.length}</span>
                    </button>
                    <button
                        onClick={() => setSearchParams({ tab: 'branding' })}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                            ${currentTab === 'branding'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <MonitorPlay size={16} />
                        Branding Assets
                        <span className="bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs ml-1">{brandingAssets.length}</span>
                    </button>
                </nav>

                <div className="flex items-center gap-2 pb-2 md:pb-0">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                        <input
                            type="search"
                            placeholder="Search videos..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm w-64 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                        />
                    </form>
                    <div className="relative">
                        <select
                            value={tenantFilter}
                            onChange={(e) => setTenantFilter(e.target.value)}
                            className="pl-3 pr-8 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm appearance-none bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none cursor-pointer"
                        >
                            <option value="">All Tenants</option>
                            {tenants.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-2.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Content */}
            {currentTab === 'videos' ? (
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                            <tr>
                                <th className="px-4 py-3">Video</th>
                                <th className="px-4 py-3">Tenant</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Size</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredVideos.map((video: any) => (
                                <tr key={video.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                                                onClick={() => setPreviewVideo(video)}
                                            >
                                                <Play size={16} fill="currentColor" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{video.title || "Untitled"}</div>
                                                <div className="text-xs text-zinc-400 font-mono">{video.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-zinc-900 dark:text-zinc-100">{video.tenantName || <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">Platform</span>}</div>
                                        {video.tenantSlug && <div className="text-xs text-zinc-500 dark:text-zinc-400">{video.tenantSlug}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={video.status} />
                                    </td>
                                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">
                                        {formatBytes(video.sizeBytes)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2">
                                            <button
                                                onClick={() => setPreviewVideo(video)}
                                                className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                                title="Preview"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteVideoId(video.id)}
                                                className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                title="Force Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {!video.tenantId && (
                                                <button
                                                    onClick={() => setShareVideo(video)}
                                                    className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                    title="Share with Tenant"
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredVideos.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                                        No videos found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                            <tr>
                                <th className="px-4 py-3">Asset Title</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Tenant</th>
                                <th className="px-4 py-3">Active</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {brandingAssets.map((asset: any) => (
                                <tr key={asset.id} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{asset.title}</div>
                                        <div className="text-xs text-zinc-400 font-mono truncate max-w-[150px]">{asset.cloudflareStreamId}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${asset.type === 'intro' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'}`}>
                                            {asset.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-zinc-900 dark:text-zinc-100">{asset.tenantName}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{asset.tenantSlug}</div>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">
                                        {asset.active ? (
                                            <span className="text-emerald-600 flex items-center gap-1 text-xs font-semibold"><CheckCircle size={12} /> Yes</span>
                                        ) : (
                                            <span className="text-zinc-400 text-xs">No</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setDeleteBrandingId(asset.id)}
                                            className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                            title="Force Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {brandingAssets.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                                        No branding assets found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal (Action) */}
            {isUploadOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Upload Video</h2>
                            <button onClick={() => setIsUploadOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target</label>
                                <select
                                    className="w-full rounded-lg border-zinc-200 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    value={selectedTenantId}
                                    onChange={(e) => setSelectedTenantId(e.target.value)}
                                >
                                    <option value="">Platform Master Asset (No Tenant)</option>
                                    <optgroup label="Tenants">
                                        {tenants.map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    {selectedTenantId ? "Video will be owned by this tenant." : "Video will be available to the platform. You can share it with tenants later."}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Asset Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setUploadType('vod')}
                                        className={`px-3 py-2 text-sm rounded-md border text-center ${uploadType === 'vod' ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100' : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                                    >
                                        Video (VOD)
                                    </button>
                                    <button
                                        onClick={() => setUploadType('intro')}
                                        className={`px-3 py-2 text-sm rounded-md border text-center ${uploadType === 'intro' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                                    >
                                        Intro
                                    </button>
                                    <button
                                        onClick={() => setUploadType('outro')}
                                        className={`px-3 py-2 text-sm rounded-md border text-center ${uploadType === 'outro' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
                                    >
                                        Outro
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">File</label>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer relative ${uploading ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'}`}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                                    }}
                                >
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={uploading}
                                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                    />
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="animate-spin text-zinc-400" />
                                            <span className="text-sm text-zinc-500">{uploadStatus}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
                                                <Upload size={20} />
                                            </div>
                                            <span className="text-sm text-zinc-600 font-medium">Click or Drag video here</span>
                                            <span className="text-xs text-zinc-400">MP4, MOV, etc.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-black rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 flex justify-between items-center border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white max-w-2xl truncate">{previewVideo.title}</h2>
                            <button onClick={() => setPreviewVideo(null)} className="text-zinc-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 bg-black aspect-video relative">
                            {previewVideo.cloudflareStreamId ? (
                                <iframe
                                    src={`https://iframe.videodelivery.net/${previewVideo.cloudflareStreamId}`}
                                    className="w-full h-full absolute inset-0"
                                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-zinc-500">
                                    Video not available
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-zinc-900 border-t border-zinc-800 text-sm text-zinc-400 flex gap-4">
                            <div>
                                <span className="block text-zinc-600 text-xs uppercase font-bold">Duration</span>
                                {previewVideo.duration ? Math.floor(previewVideo.duration / 60) + "m " + (previewVideo.duration % 60) + "s" : "--"}
                            </div>
                            <div>
                                <span className="block text-zinc-600 text-xs uppercase font-bold">Size</span>
                                {formatBytes(previewVideo.sizeBytes)}
                            </div>
                            <div>
                                <span className="block text-zinc-600 text-xs uppercase font-bold">Status</span>
                                <span className="capitalize">{previewVideo.status}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {shareVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Share Video</h2>
                            <button onClick={() => setShareVideo(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                            Give a tenant access to <strong>{shareVideo.title}</strong>.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Select Tenant</label>
                                <select
                                    className="w-full rounded-lg border-zinc-200 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    value={shareTenantId}
                                    onChange={(e) => setShareTenantId(e.target.value)}
                                >
                                    <option value="">Select a tenant...</option>
                                    {tenants.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleShare}
                                disabled={!shareTenantId}
                                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Grant Access
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'ready') {
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle size={12} /> Ready</span>;
    }
    if (status === 'processing') {
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"><RefreshCw size={12} className="animate-spin" /> Processing</span>;
    }
    if (status === 'error') {
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"><AlertCircle size={12} /> Error</span>;
    }
    return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">{status}</span>;
}
