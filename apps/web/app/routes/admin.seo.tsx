import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "../utils/api";
import { Globe, Search, ExternalLink, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const [stats, tenants] = await Promise.all([
        apiRequest("/admin/seo/stats", token),
        apiRequest("/admin/seo/tenants", token)
    ]);

    return { stats, tenants };
};

export default function AdminSEO() {
    const { stats, tenants } = useLoaderData<typeof loader>();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Tenant SEO Status</h2>
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
                                <th className="px-6 py-3 text-center">Indexing</th>
                                <th className="px-6 py-3 text-center">GBP</th>
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
                                        {tenant.seoConfig?.indexingEnabled ? (
                                            <CheckCircle size={16} className="text-emerald-500 mx-auto" />
                                        ) : (
                                            <XCircle size={16} className="text-zinc-300 dark:text-zinc-700 mx-auto" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {tenant.hasGbp ? (
                                            <CheckCircle size={16} className="text-blue-500 mx-auto" />
                                        ) : (
                                            <XCircle size={16} className="text-zinc-300 dark:text-zinc-700 mx-auto" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/portal/${tenant.slug}`}
                                            target="_blank"
                                            className="text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
                                        >
                                            <ExternalLink size={14} />
                                            <span>Portal</span>
                                        </Link>
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
