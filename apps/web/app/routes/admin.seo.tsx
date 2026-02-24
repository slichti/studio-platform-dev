import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "../utils/api";
import { Globe, Search, ExternalLink, CheckCircle, XCircle, AlertCircle, Save, Loader2, Power, Info, Sparkles, HelpCircle, Plus, Calendar, Settings2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@clerk/react-router";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const [stats, tenants, platformConfig, failures, topics] = await Promise.all([
        apiRequest("/admin/seo/stats", token),
        apiRequest("/admin/seo/tenants", token),
        apiRequest("/admin/seo/config", token),
        apiRequest("/admin/seo/failures", token),
        apiRequest("/admin/seo/topics", token)
    ]);

    return { stats, tenants, platformConfig, failures, topics };
};

export default function AdminSEO() {
    const { stats, tenants, platformConfig: initialConfig, failures, topics: initialTopics } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [platformConfig, setPlatformConfig] = useState(initialConfig);
    const [healthRes, setHealthRes] = useState<any>(null);
    const [topics, setTopics] = useState(initialTopics);
    const [newTopic, setNewTopic] = useState({ name: '', description: '' });
    const [editingTenantAutomation, setEditingTenantAutomation] = useState<string | null>(null);

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

    const handleValidateHealth = async () => {
        setIsValidating(true);
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/seo/health/validate", token);
            setHealthRes(res);
        } catch (err) {
            console.error("Health validation failed", err);
        } finally {
            setIsValidating(false);
        }
    };

    const handleGlobalRebuild = async () => {
        if (!confirm("This will touch all tenant updated_at timestamps to clear cached sitemap state. Proceed?")) return;
        setIsSaving(true);
        try {
            const token = await getToken();
            await apiRequest("/admin/seo/rebuild", token, { method: "POST" });
            alert("Global sitemap/cache rebuild triggered successfully.");
        } catch (err) {
            console.error("Global rebuild failed", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddTopic = async () => {
        if (!newTopic.name) return;
        setIsSaving(true);
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/seo/topics", token, {
                method: "POST",
                body: JSON.stringify(newTopic)
            });
            setTopics([{ id: res.id, ...newTopic, isActive: true }, ...topics]);
            setNewTopic({ name: '', description: '' });
        } catch (err) {
            console.error("Failed to add topic", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateAutomation = async (tenantId: string, topicId: string, frequency: string, isActive: boolean) => {
        try {
            const token = await getToken();
            await apiRequest(`/admin/seo/tenants/${tenantId}/automation`, token, {
                method: "PATCH",
                body: JSON.stringify({ topicId, frequency, isActive })
            });
            navigate(".", { replace: true });
        } catch (err) {
            console.error("Failed to update automation", err);
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
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <Globe size={18} />
                                </div>
                                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Platform Marketing SEO</h2>
                            </div>
                            <Link to="/brain/e5ddc1f6-27ad-40ea-bb00-ce9098b00722/seo_strategy_guide.md" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
                                <HelpCircle size={14} />
                                Strategy Guide
                            </Link>
                        </div>

                        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveConfig(); }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Title Template</label>
                                        <div className="group relative">
                                            <Info size={12} className="text-zinc-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 text-[10px] text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                Use <span className="text-indigo-400 font-mono">%s</span> as a dynamic placeholder for the specific page name.
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={platformConfig.titleTemplate || ''}
                                        onChange={(e) => setPlatformConfig({ ...platformConfig, titleTemplate: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                                        placeholder="e.g. Studio Platform | %s"
                                    />
                                    <p className="text-[10px] text-zinc-400 italic">Example: "Studio Platform | Pricing"</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Target Keywords</label>
                                    <input
                                        type="text"
                                        value={platformConfig.keywords || ''}
                                        onChange={(e) => setPlatformConfig({ ...platformConfig, keywords: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="yoga management, gym software, billing..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Marketing Meta Description</label>
                                <textarea
                                    rows={2}
                                    value={platformConfig.metaDescription || ''}
                                    onChange={(e) => setPlatformConfig({ ...platformConfig, metaDescription: e.target.value })}
                                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none leading-relaxed"
                                    placeholder="Describe the platform for search engines (max 160 characters)..."
                                />
                                <div className="flex justify-between items-center px-1">
                                    <p className="text-[10px] text-zinc-400">Keep under 160 characters for best results.</p>
                                    <span className={`text-[10px] font-medium ${(platformConfig.metaDescription?.length || 0) > 160 ? 'text-red-500' : 'text-zinc-500'}`}>
                                        {(platformConfig.metaDescription?.length || 0)}/160
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {isSaving ? "Saving Config..." : "Update Platform SEO"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="text-amber-500" size={18} />
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">SEO Recommendations</h3>
                        </div>
                        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                            Try these pre-verified, high-performing strings to boost your platform visibility.
                        </p>

                        <div className="space-y-4">
                            <RecommendationCard
                                label="Professional & Trust"
                                title="%s | The #1 Choice for Studios"
                                desc="Manage your studio with confidence. Our all-in-one platform handles booking, billing, and retention."
                                onApply={(t, d) => setPlatformConfig({ ...platformConfig, titleTemplate: t, metaDescription: d })}
                            />
                            <RecommendationCard
                                label="Value & Growth"
                                title="Grow Your Studio Revenue | %s"
                                desc="The most powerful software built for growth. Scale your studio, automate revenue, and delight members."
                                onApply={(t, d) => setPlatformConfig({ ...platformConfig, titleTemplate: t, metaDescription: d })}
                            />
                        </div>
                    </div>
                </div>
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
                    icon={<Loader2 size={18} className={stats.queueBacklog > 50 ? "animate-spin" : ""} />}
                    description="Pending Indexing API requests"
                    color="text-amber-500"
                />
                <StatCard
                    title="Sitemap Health"
                    value={healthRes ? `${Math.round(healthRes.healthScore)}%` : "Check"}
                    icon={<Search size={18} />}
                    description={healthRes ? `Based on ${healthRes.totalChecked} samples` : "Click Validate to check"}
                    color={healthRes ? (healthRes.healthScore > 90 ? "text-green-500" : "text-amber-500") : "text-zinc-400"}
                />
            </div>

            {/* Platform Health & Failures Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Failure Log */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 mb-6">
                        <AlertCircle className="text-red-500" size={18} />
                        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Recent SEO Failures</h2>
                    </div>

                    <div className="space-y-3">
                        {failures.length === 0 ? (
                            <div className="py-10 text-center">
                                <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                                <p className="text-sm text-zinc-500">No recent failures detected.</p>
                            </div>
                        ) : (
                            failures.map((f: any) => (
                                <div key={f.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg flex items-start gap-3">
                                    <XCircle className="text-red-500 shrink-0 mt-0.5" size={14} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-tight">{f.action.replace(/_/g, ' ')}</span>
                                            <span className="text-[10px] text-red-500/60">{new Date(f.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-[10px] text-red-800/80 dark:text-red-300/80 line-clamp-1">Target: {f.targetId || 'Global'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Platform Actions */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Power className="text-indigo-500" size={18} />
                        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Platform Governance</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={handleValidateHealth}
                            disabled={isValidating}
                            className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left hover:border-indigo-500 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Search size={20} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                {isValidating && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                            </div>
                            <h3 className="text-sm font-semibold mb-1">Validate Sitemaps</h3>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Probe a sample of public tenant sitemaps for 200 OK edge responses.</p>
                        </button>

                        <button
                            onClick={handleGlobalRebuild}
                            disabled={isSaving}
                            className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left hover:border-red-500 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Power size={20} className="text-zinc-400 group-hover:text-red-500 transition-colors" />
                                {isSaving && <Loader2 size={16} className="animate-spin text-red-500" />}
                            </div>
                            <h3 className="text-sm font-semibold mb-1 text-red-600 dark:text-red-400">Rebuild Persistence</h3>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Invalidate edge-cached sitemap manifests across the entire platform.</p>
                        </button>
                    </div>
                </div>
            </div>

            {/* Global SEO Topics Management */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-amber-500" size={18} />
                        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Global SEO Content Topics</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Topic Creation */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Create New Topic</h3>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Topic Name (e.g., Post-Workout Recovery)"
                                value={newTopic.name}
                                onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                            <textarea
                                placeholder="Topic Description for AI Guidance..."
                                value={newTopic.description}
                                onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                            <button
                                onClick={handleAddTopic}
                                disabled={isSaving || !newTopic.name}
                                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Add to Library
                            </button>
                        </div>
                    </div>

                    {/* Topic List */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Topics Library</h3>
                        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                            {topics.map((topic: any) => (
                                <div key={topic.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-between group">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{topic.name}</div>
                                        <div className="text-[10px] text-zinc-500 line-clamp-1">{topic.description}</div>
                                    </div>
                                    <button className="text-zinc-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Settings2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
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
                                <th className="px-6 py-3 text-center">AI Blogging</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {tenants.map((tenant: any) => {
                                const automation = (tenant.seoAutomation || [])[0]; // For MVP, show first topic subscription

                                return (
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
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {automation?.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                                                        <Calendar size={10} /> {automation.frequency}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-zinc-400 uppercase font-medium">Disabled</span>
                                                )}
                                                <button
                                                    onClick={() => setEditingTenantAutomation(tenant.id)}
                                                    className="text-[10px] text-indigo-500 hover:underline font-semibold uppercase"
                                                >
                                                    Configure
                                                </button>
                                            </div>
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Automation Edit Modal (Inline Overlay) */}
                {editingTenantAutomation && (
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Settings2 className="text-indigo-500" size={18} />
                                    Content Automation Settings
                                </h3>
                                <button
                                    onClick={() => setEditingTenantAutomation(null)}
                                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Select Primary Topic</label>
                                    <select
                                        className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        onChange={(e) => {
                                            const topic = topics.find((t: any) => t.id === e.target.value);
                                            if (topic) handleUpdateAutomation(editingTenantAutomation, topic.id, 'weekly', true);
                                        }}
                                        defaultValue={(tenants.find((t: any) => t.id === editingTenantAutomation)?.seoAutomation?.[0])?.topicId || ''}
                                    >
                                        <option value="" disabled>Choose a topic...</option>
                                        {topics.map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Posting Frequency</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['weekly', 'bi-weekly', 'monthly'].map((f) => {
                                            const current = (tenants.find((t: any) => t.id === editingTenantAutomation)?.seoAutomation?.[0])?.frequency === f;
                                            return (
                                                <button
                                                    key={f}
                                                    onClick={() => {
                                                        const automation = (tenants.find((t: any) => t.id === editingTenantAutomation)?.seoAutomation?.[0]);
                                                        if (automation) handleUpdateAutomation(editingTenantAutomation, automation.topicId, f, true);
                                                    }}
                                                    className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${current ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-indigo-300'}`}
                                                >
                                                    {f}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <button
                                        onClick={() => {
                                            const automation = (tenants.find((t: any) => t.id === editingTenantAutomation)?.seoAutomation?.[0]);
                                            if (automation) handleUpdateAutomation(editingTenantAutomation, automation.topicId, automation.frequency, !automation.isActive);
                                            else handleUpdateAutomation(editingTenantAutomation, topics[0]?.id, 'weekly', true);
                                        }}
                                        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${(tenants.find((t: any) => t.id === editingTenantAutomation)?.seoAutomation?.[0])?.isActive
                                                ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/20 hover:bg-red-100'
                                                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 hover:bg-emerald-100'
                                            }`}
                                    >
                                        {(tenants.find((t: any) => t.id === editingTenantAutomation)?.seoAutomation?.[0])?.isActive ? (
                                            <>
                                                <XCircle size={16} /> Disable Automation
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={16} /> Enable Automation
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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

function RecommendationCard({ label, title, desc, onApply }: { label: string, title: string, desc: string, onApply: (t: string, d: string) => void }) {
    return (
        <div className="p-4 border border-zinc-100 dark:border-zinc-800 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
                <button
                    onClick={() => onApply(title, desc)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                    Apply Now
                </button>
            </div>
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1">{title}</h4>
            <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">{desc}</p>
            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all">
                <Sparkles size={12} className="text-amber-400" />
            </div>
        </div>
    );
}
