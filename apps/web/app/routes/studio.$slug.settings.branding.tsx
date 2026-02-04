
import { useState } from "react";

import { useOutletContext, useLoaderData, useRevalidator } from "react-router";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Upload, X, Trash2, Video, CheckCircle, Circle, Play, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";


export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const assets = await apiRequest('/video-management/branding', token);
        return { assets };
    } catch {
        return { assets: [] };
    }
}

export default function StudioBranding() {
    const { tenant } = useOutletContext<any>();
    const { assets: initialAssets } = useLoaderData();
    const revalidator = useRevalidator();
    const [assets, setAssets] = useState(initialAssets);
    const [brandingConfirmId, setBrandingConfirmId] = useState<string | null>(null);

    // Existing Email/Brand State
    const [primaryColor, setPrimaryColor] = useState(tenant.branding?.primaryColor || '#4f46e5');
    const [logoUrl, setLogoUrl] = useState(tenant.branding?.logoUrl || '');
    const [replyTo, setReplyTo] = useState(tenant.branding?.emailReplyTo || '');
    const [footerText, setFooterText] = useState(tenant.branding?.emailFooterText || '');
    const [hidePoweredBy, setHidePoweredBy] = useState(tenant.branding?.hidePoweredBy || false);

    // UI State
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<'intro' | 'outro' | 'logo' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({
                    branding: {
                        primaryColor,
                        logoUrl,
                        emailReplyTo: replyTo,
                        emailFooterText: footerText,
                        hidePoweredBy
                    }
                })
            });
            setSuccess("Branding saved successfully.");
            // Revalidate to refresh the layout with new branding (e.g., sidebar icon color)
            revalidator.revalidate();
        } catch (e: any) {
            setError(e.message || "Failed to save branding.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (file: File) => {
        setUploading('logo');
        setError(null);
        try {
            const token = await (window as any).Clerk?.session?.getToken();

            // Upload form data to /uploads/r2-image (generic image upload)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', `Logo - ${file.name}`);

            // Used to fail because apiRequest forced JSON content-type.
            // Fixed in api.ts to support FormData auto-detection.
            const res = await apiRequest('/uploads/r2-image', token, {
                method: 'POST',
                body: formData
            });

            setLogoUrl(res.url);
            setSuccess("Logo uploaded. Don't forget to save settings.");

        } catch (e: any) {
            console.error(e);
            setError("Logo upload failed: " + e.message);
        } finally {
            setUploading(null);
        }
    }


    const handleUpload = async (file: File, type: 'intro' | 'outro') => {
        setUploading(type);
        setError(null);
        try {
            const token = await (window as any).Clerk?.session?.getToken();

            // 1. Get One-Time Upload URL
            const { uploadUrl, uid } = await apiRequest('/video-management/branding/upload-url', token, {
                method: 'POST',
                body: JSON.stringify({ type })
            });

            // 2. Upload to Cloudflare
            const formData = new FormData();
            formData.append('file', file);

            const cfUpload = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!cfUpload.ok) throw new Error("Upload to video server failed");

            // 3. Register Asset in DB
            await apiRequest('/video-management/branding', token, {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    title: file.name,
                    cloudflareStreamId: uid
                })
            });

            // Refresh list
            const updated = await apiRequest('/video-management/branding', token);
            setAssets(updated);
            setSuccess(`Uploaded ${type} video successfully.`);

        } catch (e: any) {
            console.error(e);
            setError("Upload failed: " + e.message);
        } finally {
            setUploading(null);
        }
    };

    const handleActivate = async (id: string) => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/video-management/branding/${id}/activate`, token, { method: 'PATCH' });

            setAssets(assets.map((a: any) => {
                if (a.id === id) return { ...a, active: true };
                const target = assets.find((x: any) => x.id === id);
                if (target && a.type === target.type && a.id !== id) return { ...a, active: false };
                return a;
            }));
        } catch (e) {
            setError("Failed to activate asset");
        }
    }

    const handleDelete = (id: string) => {
        setBrandingConfirmId(id);
    }

    const confirmDelete = async () => {
        if (!brandingConfirmId) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/video-management/branding/${brandingConfirmId}`, token, { method: 'DELETE' });
            setAssets(assets.filter((a: any) => a.id !== brandingConfirmId));
            setBrandingConfirmId(null);
            toast.success("Asset deleted successfully");
        } catch (e) {
            setError("Failed to delete asset");
        }
    }

    const intros = assets.filter((a: any) => a.type === 'intro');
    const outros = assets.filter((a: any) => a.type === 'outro');

    return (
        <div className="max-w-4xl pb-10 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Customize Branding</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Manage your studio's look, feel, and video assets.</p>
            </div>

            {/* General Branding */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded mb-4 text-sm">
                        {success}
                    </div>
                )}

                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">General Appearance</h2>
                <form onSubmit={handleSaveGeneral} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                                Studio Logo
                            </label>
                            <div className="flex items-start gap-4">
                                <div className="h-24 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden relative group">
                                    {logoUrl ? (
                                        <img src={logoUrl} alt="Studio Logo" className="object-cover w-full h-full" />
                                    ) : (
                                        <ImageIcon className="text-zinc-300" size={32} />
                                    )}
                                    <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-xs font-medium">
                                        Change
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                                            disabled={uploading === 'logo'}
                                        />
                                    </label>
                                </div>
                                <div className="flex-1 text-sm text-zinc-500">
                                    <p>Upload a square image for best results. Used in emails and header.</p>
                                    {uploading === 'logo' && <p className="text-blue-600 animate-pulse mt-1">Uploading...</p>}
                                </div>
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                                Primary Brand Color
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-10 h-10 p-0 border-none rounded cursor-pointer bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="flex-1 bg-transparent text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Platform Branding</h2>
                        <div className="flex items-start gap-3">
                            <input
                                id="hidePoweredBy"
                                type="checkbox"
                                checked={hidePoweredBy}
                                onChange={(e) => setHidePoweredBy(e.target.checked)}
                                disabled={tenant.tier?.toLowerCase() !== 'scale'}
                                className="h-4 w-4 mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <div className="text-sm">
                                <label htmlFor="hidePoweredBy" className={`font-medium ${tenant.tier?.toLowerCase() !== 'scale' ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                    Hide "Powered by StudioPlatform" badge
                                </label>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                                    Remove the branding badge from your site footer.
                                    {tenant.tier?.toLowerCase() !== 'scale' && (
                                        <span className="text-pink-600 dark:text-pink-400 ml-1 font-medium">Requires Scale tier.</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>


                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-opacity ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Saving...' : 'Save General Settings'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Video Branding */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Video Branding</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Intros and Outros to automatically stitch to your VOD uploads.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Intros */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">Intro Videos</h3>
                            <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-2">
                                <Upload size={14} />
                                {uploading === 'intro' ? 'Uploading...' : 'Upload Intro'}
                                <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'intro')}
                                    disabled={!!uploading}
                                />
                            </label>
                        </div>
                        <AssetList
                            assets={intros}
                            onActivate={handleActivate}
                            onDelete={handleDelete}
                            emptyMessage="No intros uploaded. Upload a short video to play before your classes."
                        />
                    </div>

                    {/* Outros */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">Outro Videos</h3>
                            <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-2">
                                <Upload size={14} />
                                {uploading === 'outro' ? 'Uploading...' : 'Upload Outro'}
                                <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'outro')}
                                    disabled={!!uploading}

                                />
                            </label>
                        </div>
                        <AssetList
                            assets={outros}
                            onActivate={handleActivate}
                            onDelete={handleDelete}
                            emptyMessage="No outros uploaded. Upload a short video to play after your classes."
                        />
                    </div>
                </div>
            </div>

            <ConfirmationDialog
                isOpen={!!brandingConfirmId}
                onClose={() => setBrandingConfirmId(null)}
                onConfirm={confirmDelete}
                title="Delete Branding Asset"
                message="Are you sure you want to delete this branding asset? This action cannot be undone."
                confirmText="Delete"
                isDestructive
            />
        </div>
    );
}

function AssetList({ assets, onActivate, onDelete, emptyMessage }: any) {
    if (assets.length === 0) {
        return <div className="text-zinc-400 text-sm py-8 text-center bg-zinc-50 rounded-lg border border-dashed border-zinc-200 px-10">{emptyMessage}</div>;
    }

    return (
        <div className="space-y-3">
            {assets.map((asset: any) => (
                <div key={asset.id} className={`flex items-center justify-between p-3 rounded-lg border ${asset.active ? 'border-indigo-200 bg-indigo-50/50' : 'border-zinc-200 hover:bg-zinc-50'} transition`}>
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-zinc-200 rounded flex items-center justify-center text-zinc-400">
                            <Video size={14} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-900">{asset.title}</div>
                            {asset.active && (
                                <div className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                    <CheckCircle size={10} /> Active
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!asset.active && (
                            <button
                                onClick={() => onActivate(asset.id)}
                                className="text-xs text-zinc-500 hover:text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50 transition"
                            >
                                Set Active
                            </button>
                        )}
                        <button
                            onClick={() => onDelete(asset.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 rounded transition"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
