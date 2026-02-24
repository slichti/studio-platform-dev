import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "../utils/api";
import { Globe, Search, ExternalLink, CheckCircle, XCircle, AlertCircle, Save, Loader2, Power } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@clerk/react-router";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const [stats, tenants, platformConfig] = await Promise.all([
        apiRequest("/admin/seo/stats", token),
        apiRequest("/admin/seo/tenants", token),
        apiRequest("/admin/seo/config", token)
    ]);

    return { stats, tenants, platformConfig };
};

export default function AdminSEO() {
    const { stats, tenants, platformConfig: initialConfig } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [platformConfig, setPlatformConfig] = useState(initialConfig);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            const token = await getToken();
            await apiRequest("/admin/seo/config", token, {
                method: "PATCH",
                body: JSON.stringify(platformConfig)
            });
            navigate(".", { replace: true });
        } catch (err) {
            console.error("Failed to save platform config", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleIndexing = async (tenantId: string, currentStatus: boolean) => {
        try {
            const token = await getToken();
            await apiRequest(`/admin/seo/tenants/${tenantId}/seo`, token, {
                method: "PATCH",
                body: JSON.stringify({ indexingEnabled: !currentStatus })
            });
            navigate(".", { replace: true });
        } catch (err) {
            console.error("Failed to toggle indexing", err);
        }
    };

    const handleDisconnectGbp = async (tenantId: string) => {
        if (!confirm("Are you sure you want to disconnect Google Business Profile for this tenant?")) return;
        try {
            const token = await getToken();
            await apiRequest(`/admin/seo/tenants/${tenantId}/seo`, token, {
                method: "PATCH",
                body: JSON.stringify({ gbpConnected: false })
            });
            navigate(".", { replace: true });
        } catch (err) {
            console.error("Failed to disconnect GBP", err);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Globe className="text-indigo-500" />
                        Platform SEO Management
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Monitor global indexing health and sitemap generation across all tenants.
                    </p>
                </div>
            </header>

            {/* Platform Marketing SEO Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Globe size={18} />
                    </div>
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Platform Marketing SEO</h2>
                </div>
                <form className="grid grid-cols-1 lg:grid-cols-3 gap-6" onSubmit={(e) => { e.preventDefault(); handleSaveConfig(); }}>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Title Template</label>
                        <input
                            type="text"
                            value={platformConfig.titleTemplate || ''}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, titleTemplate: e.target.value })}
                            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="e.g. Studio Platform | %s"
                        />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Marketing Meta Description</label>
                        <textarea
                            rows={1}
                            value={platformConfig.metaDescription || ''}
                            onChange={(e) => setPlatformConfig({ ...platformConfig, metaDescription: e.target.value })}
                            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                            placeholder="Describe the platform for search engines..."
                        />
                    </div>
                    <div className="lg:col-span-3 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {isSaving ? "Saving..." : "Save Platform Config"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Indexing Enabled"
                    value={stats.indexingEnabled}
                    icon={<Globe size={18} />}
                    description="Tenants with active indexing"
                    color="text-emerald-500"
                />
                <StatCard
                    title="GBP Connected"
                    value={stats.gbpConnected}
                    icon={<CheckCircle size={18} />}
                    description="Google Business sync active"
                    color="text-blue-500"
                />
                <StatCard
                    title="Public Tenants"
                    value={stats.sitemapEligible}
                    icon={<Globe size={18} />}
                    description="Eligible for sitemap generation"
                    color="text-indigo-500"
                />
                <StatCard
                    title="Queue Backlog"
                    value={stats.queueBacklog}
                    icon={<AlertCircle size={18} />}
                    description="Pending indexing notifications"
                    color="text-zinc-500"
                />
            </div>

            {/* Tenant SEO Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Tenant SEO Status & Active Controls</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search tenants..."
                            className="pl-9 pr-4 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-medium">
                            <tr>
                                <th className="px-6 py-3">Tenant Name</th>
                                <th className="px-6 py-3 text-center">Visibility</th>
                                <th className="px-6 py-3 text-center">Indexing (Toggle)</th>
                                <th className="px-6 py-3 text-center">GBP Sync</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {tenants.map((tenant: any) => (
                                <tr key={tenant.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{tenant.name}</div>
                                        <div className="text-xs text-zinc-400 font-mono">/{tenant.slug}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {tenant.isPublic ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase">
                                                Public
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full uppercase">
                                                Private
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleToggleIndexing(tenant.id, tenant.seoConfig?.indexingEnabled)}
                                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ring-offset-2 focus:ring-2 focus:ring-indigo-500 ${tenant.seoConfig?.indexingEnabled ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tenant.seoConfig?.indexingEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {tenant.hasGbp ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <CheckCircle size={16} className="text-blue-500" />
                                                <button
                                                    onClick={() => handleDisconnectGbp(tenant.id)}
                                                    className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors uppercase font-semibold"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        ) : (
                                            <XCircle size={16} className="text-zinc-300 dark:text-zinc-700 mx-auto" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <Link
                                                to={`/portal/${tenant.slug}`}
                                                target="_blank"
                                                className="text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                title="View Portal"
                                            >
                                                <ExternalLink size={16} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, description, color }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</span>
                <div className={`${color} opacity-80`}>{icon}</div>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">{value}</div>
            <p className="text-xs text-zinc-400">{description}</p>
        </div>
    );
}
