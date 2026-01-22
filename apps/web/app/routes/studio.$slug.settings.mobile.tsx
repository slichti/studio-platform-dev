
import { useOutletContext } from "react-router";
import { useState, useRef } from "react";
import { apiRequest } from "../utils/api";
import { Smartphone, Upload, Save, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function MobileAppSettings() {
    const { tenant, token } = useOutletContext<any>();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<'icon' | 'splash' | null>(null);

    const [config, setConfig] = useState(tenant.mobileAppConfig || {
        appName: tenant.name,
        iconUrl: "",
        splashUrl: "",
        primaryColor: tenant.branding?.primaryColor || "#000000"
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleImageUpload = async (file: File, type: 'icon' | 'splash') => {
        setUploading(type);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', `Mobile App ${type === 'icon' ? 'Icon' : 'Splash'} - ${file.name}`);

            const res = await apiRequest('/uploads/r2-image', token, {
                method: 'POST',
                body: formData
            });

            if (res.url) {
                setConfig((prev: any) => ({ ...prev, [type + 'Url']: res.url }));
                setMessage({ type: 'success', text: `${type === 'icon' ? 'Icon' : 'Splash Screen'} uploaded successfully.` });
            } else {
                throw new Error("Upload failed, no URL returned.");
            }

        } catch (e: any) {
            console.error(e);
            setMessage({ type: 'error', text: `Upload failed: ${e.message}` });
        } finally {
            setUploading(null);
        }
    }

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await apiRequest('/tenant/settings', token, {
                method: 'PATCH',
                body: JSON.stringify({
                    mobileAppConfig: config
                })
            });
            if (res.success) {
                setMessage({ type: 'success', text: "Mobile app settings saved successfully." });
            } else {
                throw new Error("Failed to save.");
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Smartphone className="text-blue-600 dark:text-blue-400" size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mobile App Builder</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Customize your white-label mobile application.</p>
                </div>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Configuration Form */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">App Identity</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">App Name</label>
                                <input
                                    type="text"
                                    value={config.appName}
                                    onChange={e => setConfig({ ...config, appName: e.target.value })}
                                    className="w-full text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="My Studio App"
                                />
                                <p className="text-xs text-zinc-400 mt-1">This name will appear on the user's home screen.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Primary Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={config.primaryColor}
                                        onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                        className="h-9 w-16 p-0 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={config.primaryColor}
                                        onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                        className="flex-1 text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 uppercase font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Assets</h3>

                        <div className="space-y-6">
                            {/* App Icon */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">App Icon</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={config.iconUrl}
                                        onChange={e => setConfig({ ...config, iconUrl: e.target.value })}
                                        className="flex-1 text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="https://..."
                                    />
                                    <label className={`cursor-pointer bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-md transition-colors border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 ${uploading === 'icon' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <Upload size={16} />
                                        <span className="text-sm font-medium">{uploading === 'icon' ? '...' : 'Upload'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={!!uploading}
                                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'icon')}
                                        />
                                    </label>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">Recommended: 1024x1024 PNG (No transparency)</p>
                            </div>

                            {/* Splash Screen */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Splash Screen</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={config.splashUrl}
                                        onChange={e => setConfig({ ...config, splashUrl: e.target.value })}
                                        className="flex-1 text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="https://..."
                                    />
                                    <label className={`cursor-pointer bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-md transition-colors border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 ${uploading === 'splash' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <Upload size={16} />
                                        <span className="text-sm font-medium">{uploading === 'splash' ? '...' : 'Upload'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={!!uploading}
                                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'splash')}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-bold hover:opacity-90 transition-opacity flex justify-center items-center gap-2"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        Save Configuration
                    </button>
                </div>

                {/* Preview */}
                <div className="flex justify-center pt-8">
                    <div className="relative border-4 border-zinc-800 bg-zinc-900 rounded-[3rem] h-[600px] w-[300px] shadow-2xl overflow-hidden">
                        {/* Dynamic Status Bar */}
                        <div className="absolute top-0 w-full h-8 bg-black/20 z-20 flex justify-between px-4 items-center text-[10px] text-white font-bold">
                            <span>9:41</span>
                            <div className="flex gap-1">
                                <div className="w-3 h-3 bg-white rounded-full opacity-50" />
                                <div className="w-3 h-3 bg-white rounded-full" />
                            </div>
                        </div>

                        {/* Screen Content */}
                        <div className="h-full w-full bg-white flex flex-col pt-12">
                            {/* Header */}
                            <div className="px-4 pb-4 border-b border-zinc-100 flex items-center justify-between">
                                <h2 className="font-bold text-lg" style={{ color: config.primaryColor }}>{config.appName || 'Studio App'}</h2>
                                <div className="w-8 h-8 rounded-full bg-zinc-100" />
                            </div>

                            {/* Hero */}
                            <div className="p-4">
                                <div className="aspect-video rounded-xl bg-zinc-100 mb-4 flex items-center justify-center text-zinc-300 relative overflow-hidden">
                                    {config.splashUrl ? (
                                        <img src={config.splashUrl} alt="Splash" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon size={24} />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-2/3 bg-zinc-100 rounded" />
                                    <div className="h-4 w-1/2 bg-zinc-100 rounded" />
                                </div>
                            </div>

                            {/* Icon Preview Overlay */}
                            {config.iconUrl && (
                                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <img src={config.iconUrl} alt="Icon" className="w-16 h-16 rounded-2xl shadow-lg mb-2 bg-white" />
                                    <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded">App Icon</span>
                                </div>
                            )}
                        </div>

                        {/* Home Bar */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/50 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
