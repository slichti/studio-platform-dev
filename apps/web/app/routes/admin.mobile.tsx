
import { useState, useEffect } from "react";
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { apiRequest } from "~/utils/api";
import { getAuth } from "@clerk/react-router/server";
import {
    Smartphone,
    ShieldAlert,
    Activity,
    Search,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    RefreshCw,
    Terminal
} from "lucide-react";
import { toast } from "sonner";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        const [config, tenants, logs] = await Promise.all([
            apiRequest("/admin/mobile/config", token, {}, apiUrl),
            apiRequest("/admin/mobile/tenants", token, {}, apiUrl),
            apiRequest("/admin/mobile/logs", token, {}, apiUrl)
        ]);

        return { config, tenants, logs, token, apiUrl };
    } catch (e) {
        console.error("Failed to load admin mobile data", e);
        return { config: null, tenants: [], logs: [], token, apiUrl, error: true };
    }
};

export default function AdminMobile() {
    const { config, tenants: initialTenants, logs, token, apiUrl } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const [search, setSearch] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'tenants' | 'logs' | 'settings'>('tenants');

    const filteredTenants = (initialTenants || []).filter((t: any) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

    const toggleAccess = async (tenantId: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'DISABLE' : 'ENABLE'} mobile access for this tenant?`)) return;

        setProcessingId(tenantId);
        try {
            const res = await apiRequest(`/admin/mobile/tenants/${tenantId}/access`, token, {
                method: 'PUT',
                body: JSON.stringify({ enabled: !currentStatus })
            }, apiUrl);

            if (res.error) throw new Error(res.error);

            toast.success(`Mobile access ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
            revalidator.revalidate();
        } catch (e: any) {
            toast.error(e.message || "Failed to update status");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
                        <Smartphone className="w-8 h-8 text-blue-600" />
                        Mobile App Administration
                    </h1>
                    <p className="mt-2 text-zinc-500 dark:text-zinc-400 max-w-2xl">
                        Manage tenant access to the mobile application, view global logs, and configure system-wide settings.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => revalidator.revalidate()}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${revalidator.state === 'loading' ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Mobile Tenants</p>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{config?.stats?.authorizedCount || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">System Status</p>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Operational</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                            <Terminal className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Minimum App Version</p>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{config?.minVersion || "1.0.0"}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <nav className="flex gap-6 px-6">
                        <button
                            onClick={() => setActiveTab('tenants')}
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tenants'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            Tenant Access
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'logs'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            System Logs
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            Global Configuration
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'tenants' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="Search tenants..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase text-zinc-500 font-medium">
                                            <th className="pb-3 pl-4">Tenant Name</th>
                                            <th className="pb-3">Slug</th>
                                            <th className="pb-3">Mobile Status</th>
                                            <th className="pb-3">Config Configured</th>
                                            <th className="pb-3 text-right pr-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {filteredTenants.map((tenant: any) => (
                                            <tr key={tenant.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="py-4 pl-4 font-medium text-zinc-900 dark:text-zinc-100">{tenant.name}</td>
                                                <td className="py-4 text-zinc-500 font-mono text-sm">{tenant.slug}</td>
                                                <td className="py-4">
                                                    {tenant.mobileEnabled ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                            <CheckCircle2 className="w-3 h-3" /> Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                            <XCircle className="w-3 h-3" /> Disabled
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4">
                                                    {tenant.mobileConfig ? (
                                                        <span className="text-xs text-zinc-500">Configured</span>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 dark:text-amber-500">Pending Setup</span>
                                                    )}
                                                </td>
                                                <td className="py-4 text-right pr-4">
                                                    <button
                                                        onClick={() => toggleAccess(tenant.id, tenant.mobileEnabled)}
                                                        disabled={processingId === tenant.id}
                                                        className={`text-sm px-3 py-1.5 rounded-md transition-colors ${tenant.mobileEnabled
                                                                ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400'
                                                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400'
                                                            }`}
                                                    >
                                                        {processingId === tenant.id ? 'Saving...' : (tenant.mobileEnabled ? 'Disable Access' : 'Grant Access')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Recent System Logs</h3>
                            <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-zinc-500 border-b border-zinc-800">
                                            <th className="text-left pb-2 w-48">Timestamp</th>
                                            <th className="text-left pb-2 w-24">Level</th>
                                            <th className="text-left pb-2 w-32">Tenant</th>
                                            <th className="text-left pb-2">Message</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {(logs || []).map((log: any) => (
                                            <tr key={log.id} className="group hover:bg-zinc-900">
                                                <td className="py-2 text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="py-2">
                                                    <span className={`uppercase text-xs font-bold ${log.level === 'error' ? 'text-red-400' :
                                                            log.level === 'warn' ? 'text-amber-400' : 'text-blue-400'
                                                        }`}>
                                                        [{log.level}]
                                                    </span>
                                                </td>
                                                <td className="py-2 text-zinc-400">{log.tenant}</td>
                                                <td className="py-2 text-zinc-100">{log.message}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {(!logs || logs.length === 0) && (
                                    <div className="py-8 text-center text-zinc-600">No recent logs found.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-xl space-y-6">
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4 rounded-lg flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-amber-900 dark:text-amber-300">Maintenance Mode</h4>
                                    <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                                        Enabling maintenance mode will prevent all mobile apps from connecting to the API. Use only in emergencies.
                                    </p>
                                    <div className="mt-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4 text-amber-600 rounded" />
                                            <span className="text-sm font-medium text-amber-900 dark:text-amber-300">Enable Maintenance Mode</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Minimum Required Version</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        defaultValue={config?.minVersion || "1.0.0"}
                                        className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity">
                                        Update
                                    </button>
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Apps older than this version will be forced to update.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

