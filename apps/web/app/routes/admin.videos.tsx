// @ts-ignore
import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Form, useSubmit, Link, redirect, useSearchParams, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { formatBytes } from "~/utils/format";
import { Trash2, Play, AlertCircle, CheckCircle, Clock, RefreshCw, Badge, MonitorPlay, Film, Upload, X, Search } from "lucide-react";
import { useState } from "react";
// @ts-ignore
import { Dialog } from "@headlessui/react"; // Assuming headlessui is installed or similar modal. If not, I'll build a custom simple one.
// Web app uses 'dialog-...' check build output. `build/client/assets/dialog-gCod93TW.js`.
// I'll stick to a simple absolute positioned overlay to avoid dep issues if not sure.

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const [videosData, brandingData, tenantsData] = await Promise.all([
            apiRequest('/admin/videos', token),
            apiRequest('/admin/branding', token),
            apiRequest('/admin/tenants', token)
        ]);

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

    // Upload State
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState("");
    const [uploadType, setUploadType] = useState('vod'); // 'vod' | 'intro' | 'outro'
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);

    const handleDeleteVideo = (id: string) => {
        if (confirm("Are you sure you want to force delete this video? This cannot be undone.")) {
            submit({ intent: "delete_video", id }, { method: "post" });
        }
    }

    const handleDeleteBranding = (id: string) => {
        if (confirm("Are you sure you want to delete this branding asset?")) {
            submit({ intent: "delete_branding", id }, { method: "post" });
        }
    }

    const handleUpload = async (file: File) => {
        if (!selectedTenantId) return alert("Please select a tenant");

        setUploading(true);
        setUploadStatus("Getting upload URL...");

        try {
            const token = await (window as any).Clerk?.session?.getToken();

            // 1. Get URL from Admin API
            const { uploadUrl, uid } = await apiRequest('/admin/videos/upload-url', token, {
                method: 'POST',
                body: JSON.stringify({ targetTenantId: selectedTenantId, type: uploadType })
            });

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
            alert("Upload failed: " + e.message);
        } finally {
            setUploading(false);
            setUploadStatus(null);
        }
    }


    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Platform Video Management</h1>
                    <p className="text-zinc-500">Monitor storage usage and manage video assets across all studios.</p>
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
                <div className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                    <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Total Videos</div>
                    <div className="text-2xl font-bold text-zinc-900">{stats.totalVideos}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                    <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Total Storage</div>
                    <div className="text-2xl font-bold text-zinc-900">{formatBytes(stats.totalStorageBytes)}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                    <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Processing</div>
                    <div className="text-2xl font-bold text-zinc-900">{stats.processingCount}</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-zinc-200">
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
            </div>

            {/* Content */}
            {currentTab === 'videos' ? (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-4 py-3">Video</th>
                                <th className="px-4 py-3">Tenant</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Size</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {videos.map((video: any) => (
                                <tr key={video.id} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-zinc-900">{video.title || "Untitled"}</div>
                                        <div className="text-xs text-zinc-400 font-mono">{video.id}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-zinc-900">{video.tenantName}</div>
                                        <div className="text-xs text-zinc-500">{video.tenantSlug}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={video.status} />
                                    </td>
                                    <td className="px-4 py-3 text-zinc-600 font-mono">
                                        {formatBytes(video.sizeBytes)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDeleteVideo(video.id)}
                                            className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                            title="Force Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {videos.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                                        No videos found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
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
                                        <div className="font-medium text-zinc-900">{asset.title}</div>
                                        <div className="text-xs text-zinc-400 font-mono truncate max-w-[150px]">{asset.cloudflareStreamId}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${asset.type === 'intro' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {asset.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-zinc-900">{asset.tenantName}</div>
                                        <div className="text-xs text-zinc-500">{asset.tenantSlug}</div>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-600 font-mono">
                                        {asset.active ? (
                                            <span className="text-emerald-600 flex items-center gap-1 text-xs font-semibold"><CheckCircle size={12} /> Yes</span>
                                        ) : (
                                            <span className="text-zinc-400 text-xs">No</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDeleteBranding(asset.id)}
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
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold">Upload to Tenant</h2>
                            <button onClick={() => setIsUploadOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Target Tenant</label>
                                <select
                                    className="w-full rounded-lg border-zinc-200 text-sm"
                                    value={selectedTenantId}
                                    onChange={(e) => setSelectedTenantId(e.target.value)}
                                >
                                    <option value="">Select a tenant...</option>
                                    {tenants.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Asset Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setUploadType('vod')}
                                        className={`px-3 py-2 text-sm rounded-md border text-center ${uploadType === 'vod' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
                                    >
                                        Video (VOD)
                                    </button>
                                    <button
                                        onClick={() => setUploadType('intro')}
                                        className={`px-3 py-2 text-sm rounded-md border text-center ${uploadType === 'intro' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
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
                                <label className="block text-sm font-medium text-zinc-700 mb-1">File</label>
                                <div className="border-2 border-dashed border-zinc-200 rounded-lg p-8 text-center hover:bg-zinc-50 transition cursor-pointer relative">
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
                                            <span className="text-sm text-zinc-600 font-medium">Click to select video</span>
                                            <span className="text-xs text-zinc-400">MP4, MOV, etc.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
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
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><RefreshCw size={12} className="animate-spin" /> Processing</span>;
    }
    if (status === 'error') {
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle size={12} /> Error</span>;
    }
    return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">{status}</span>;
}
