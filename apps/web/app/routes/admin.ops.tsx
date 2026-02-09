import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import {
    Activity, Shield, Zap, Server,
    Database, Globe, AlertTriangle, CheckCircle2,
    Clock, RefreshCw, Cpu, HardDrive, LayoutDashboard
} from "lucide-react";
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    const { userId, getToken } = await getAuth(args);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const API_URL = env.VITE_API_URL || env.API_URL || 'https://studio-platform-api.slichti.workers.dev';

    try {
        const res = await fetch(`${API_URL}/diagnostics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-request-id': crypto.randomUUID()
            }
        });

        if (!res.ok) {
            throw new Error(`API Error: ${res.status}`);
        }

        const data = await res.json();
        return { data, error: null, environment: env.ENVIRONMENT || 'production' };
    } catch (error: any) {
        return { data: null, error: error.message, environment: env.ENVIRONMENT || 'production' };
    }
};

export default function AdminOps() {
    const { data, error, environment } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const isLoading = revalidator.state === "loading";

    const stats = [
        {
            label: "System Status",
            value: data?.status === "ok" ? "Operational" : "Degraded",
            icon: Shield,
            color: data?.status === "ok" ? "text-emerald-500" : "text-amber-500",
            bg: data?.status === "ok" ? "bg-emerald-500/10" : "bg-amber-500/10"
        },
        {
            label: "DB Read Latency",
            value: data?.latency?.database_read_ms ? `${data.latency.database_read_ms}ms` : "N/A",
            icon: Database,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            label: "Worker Memory",
            value: data?.worker?.memory_used_mb ? `${data.worker.memory_used_mb}MB` : "N/A",
            icon: Cpu,
            color: "text-purple-500",
            bg: "bg-purple-500/10"
        },
        {
            label: "Edge Location",
            value: data?.worker?.colo || "Local",
            icon: Globe,
            color: "text-pink-500",
            bg: "bg-pink-500/10"
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LayoutDashboard className="text-indigo-600" size={24} />
                        Operations Dashboard
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Real-time system health and edge performance metrics.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        <span className={`w-2 h-2 rounded-full ${environment === 'production' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        {environment.toUpperCase()}
                    </div>
                    <button
                        onClick={() => revalidator.revalidate()}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                    <AlertTriangle size={20} />
                    <div>
                        <p className="font-semibold text-sm">System Connectivity Error</p>
                        <p className="text-xs opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon className={stat.color} size={20} />
                            </div>
                            <Activity className="text-zinc-300 dark:text-zinc-700" size={16} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Integration Status */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Zap className="text-amber-500" size={18} />
                                Service Integrations
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {data?.integrations && Object.entries(data.integrations).map(([key, connected]: [string, any]) => (
                                    <div key={key} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                                            <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">
                                                {key.replace('_', ' ')}
                                            </span>
                                        </div>
                                        {connected ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">Connected</span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded">Disconnected</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Edge Performance Details */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Server className="text-blue-500" size={18} />
                                Edge Node Performance
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Database size={14} className="text-zinc-400" />
                                        <span className="text-sm text-zinc-500">D1 Query (Write Proxy)</span>
                                    </div>
                                    <span className="font-mono text-sm font-medium">{data?.latency?.database_query_ms}ms</span>
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${Math.min(100, (data?.latency?.database_query_ms || 0) / 2)}%` }}
                                    />
                                </div>
                                <div className="pt-4 grid grid-cols-2 gap-8 text-xs">
                                    <div className="space-y-1">
                                        <p className="text-zinc-400 uppercase tracking-wider font-bold">PoP Info</p>
                                        <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                                            {data?.worker?.city}, {data?.worker?.country} ({data?.worker?.region})
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-zinc-400 uppercase tracking-wider font-bold">Execution Context</p>
                                        <p className="text-zinc-700 dark:text-zinc-300 font-medium">Standard Worker</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Client Errors */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden h-full">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Clock className="text-red-500" size={18} />
                                Error Telemetry
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {data?.clientErrors && data.clientErrors.length > 0 ? (
                                data.clientErrors.map((err: any) => (
                                    <div key={err.id} className="p-4 bg-red-50/50 dark:bg-red-500/5 rounded-xl border border-red-100 dark:border-red-900/20 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-bold text-red-600 dark:text-red-400 truncate max-w-[70%]">
                                                {err.details?.message || "App Error"}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 font-mono">
                                                {format(new Date(err.createdAt), 'HH:mm:ss')}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 truncate">{err.details?.url}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-2">
                                    <CheckCircle2 size={32} className="text-emerald-500 opacity-20" />
                                    <p className="text-xs font-medium">No recent client errors</p>
                                </div>
                            )}
                        </div>
                        {data?.clientErrors?.length > 0 && (
                            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
                                <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">
                                    View Full Logs
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
