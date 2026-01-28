
import { useOutletContext } from "react-router";
import { useState, useEffect } from "react";
import { apiRequest } from "~/utils/api";
import { Loader2, Save, Smartphone, Palette, Store, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";

export default function MobileSettings() {
    const { tenant, token } = useOutletContext<any>() as any;
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Initial Fetch
    useEffect(() => {
        if (!token) return;
        apiRequest(`/studios/${tenant.id}/mobile-config`, token)
            .then(res => {
                if (res.error) toast.error("Failed to load mobile settings");
                else setConfig(res);
            })
            .catch(() => toast.error("Failed to load mobile settings"))
            .finally(() => setLoading(false));
    }, [token, tenant.id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiRequest(`/studios/${tenant.id}/mobile-config`, token, {
                method: 'PUT',
                body: JSON.stringify(config)
            });
            if (res.error) throw new Error(res.error);
            toast.success("Mobile settings saved successfully");
            // Optimistically update a local state or revalidate if needed, 
            // but these settings likely don't affect immediate layout outside this page.
        } catch (e: any) {
            toast.error(e.message || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;
    if (!config) return <div className="p-12 text-center text-zinc-500">Failed to load configuration.</div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Smartphone className="w-6 h-6" />
                        Mobile App Configuration
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage your dedicated mobile app appearance and features.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            <div className="grid gap-6">
                {/* Master Toggle */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Enable Mobile App Access</h3>
                        <p className="text-sm text-zinc-500">Allow members to log in to your studio via the mobile app.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.enabled}
                            onChange={e => setConfig({ ...config, enabled: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* Theming */}
                <div className={`transition-opacity ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <Palette className="w-5 h-5" /> Theming
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Accent Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={config.theme.primaryColor}
                                        onChange={e => setConfig({ ...config, theme: { ...config.theme, primaryColor: e.target.value } })}
                                        className="h-10 w-20 rounded cursor-pointer bg-transparent border-none p-0"
                                    />
                                    <span className="text-sm font-mono text-zinc-500 uppercase">{config.theme.primaryColor}</span>
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Used for buttons, tabs, and highlights.</p>
                            </div>
                            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg">
                                <div>
                                    <span className="block font-medium text-zinc-900 dark:text-zinc-100">Force Dark Mode</span>
                                    <span className="text-xs text-zinc-500">Always use dark theme regardless of system settings.</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.theme.darkMode}
                                        onChange={e => setConfig({ ...config, theme: { ...config.theme, darkMode: e.target.checked } })}
                                    />
                                    <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5" /> Features Tabs
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { k: 'booking', l: 'Book Classes' },
                                { k: 'shop', l: 'Shop / Store' },
                                { k: 'vod', l: 'Video Library' },
                                { k: 'profile', l: 'Member Profile' }
                            ].map(f => (
                                <label key={f.k} className="flex items-center p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500"
                                        checked={config.features[f.k]}
                                        onChange={e => setConfig({ ...config, features: { ...config.features, [f.k]: e.target.checked } })}
                                    />
                                    <span className="ml-3 font-medium text-zinc-700 dark:text-zinc-300">{f.l}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* App Access */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <Store className="w-5 h-5" /> Your App Access
                        </h3>
                        <div className="space-y-4">
                            <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Studio Code</p>
                                    <p className="text-xs text-zinc-500">Your members will enter this code in the [Platform] App to access your studio.</p>
                                </div>
                                <div className="text-xl font-mono font-bold text-blue-600 bg-white dark:bg-zinc-900 px-4 py-2 rounded border border-blue-200 dark:border-blue-900">
                                    {tenant.slug}
                                </div>
                            </div>

                            {/* QR Code */}
                            <div className="mt-8 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">Scan to Join</h4>
                                <div className="flex flex-col md:flex-row items-center gap-6">
                                    <div className="bg-white p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                        <QRCode
                                            value={`https://app.studioplatform.com/join/${tenant.slug}`}
                                            size={160}
                                            level="H"
                                            className="h-40 w-40"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                                            Print this QR code and display it at your front desk. New members can scan it to instantly load your studio in the app.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => window.print()}
                                                className="text-sm bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-3 py-1.5 rounded-md transition"
                                            >
                                                Print Page
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
