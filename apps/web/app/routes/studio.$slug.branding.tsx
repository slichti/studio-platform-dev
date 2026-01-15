
import { useState } from "react";
// @ts-ignore
import { useOutletContext, Form, useRevalidator } from "react-router";
import { apiRequest } from "../utils/api";

export default function StudioBranding() {
    const { tenant } = useOutletContext<any>();
    const revalidator = useRevalidator();
    const [primaryColor, setPrimaryColor] = useState(tenant.branding?.primaryColor || '#4f46e5');
    const [hidePoweredBy, setHidePoweredBy] = useState(tenant.branding?.hidePoweredBy || false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Normalize tier check to be case-insensitive
    const isScaleTier = tenant.tier?.toLowerCase() === 'scale';

    const handleSave = async (e: React.FormEvent) => {
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
                        hidePoweredBy
                    }
                })
            });
            setSuccess("Branding saved successfully.");
            // Refresh layout to update Sidebar icon immediately
            revalidator.revalidate();
        } catch (e: any) {
            setError(e.message || "Failed to save branding.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Customize Branding</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Manage your studio's look and feel.</p>
                <p className="text-xs text-zinc-400 mt-1">Current tier: <strong className="font-mono">{tenant.tier || 'unknown'}</strong></p>
            </div>

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

                <form onSubmit={handleSave} className="flex flex-col gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                            Primary Brand Color
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={/^#[0-9A-F]{6}$/i.test(primaryColor) ? primaryColor : '#000000'}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-10 h-10 p-0 border-none rounded cursor-pointer bg-transparent"
                            />
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="flex-1 bg-transparent text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Platform Branding</h2>

                        <div className="flex items-start gap-3">
                            <div className="flex items-center h-5">
                                <input
                                    id="hidePoweredBy"
                                    type="checkbox"
                                    checked={hidePoweredBy}
                                    onChange={(e) => setHidePoweredBy(e.target.checked)}
                                    disabled={!isScaleTier}
                                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div className="text-sm">
                                <label htmlFor="hidePoweredBy" className={`font-medium ${!isScaleTier ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                    Hide "Powered by StudioPlatform" badge
                                </label>
                                <p className="text-zinc-500 dark:text-zinc-400">
                                    Remove the branding badge from your site footer.
                                    {!isScaleTier && (
                                        <span className="text-pink-600 dark:text-pink-400 ml-1 font-medium">
                                            Requires Scale tier.
                                        </span>
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
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
