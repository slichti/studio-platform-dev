
import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { RefreshCw, Layout, Smartphone, Globe, Database, Layers, Shield, ShoppingCreditCard, Calendar, Box } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const stats = await apiRequest("/admin/stats/architecture", token);
        return { stats, error: null };
    } catch (e: any) {
        return { stats: null, error: e.message };
    }
};

const ServiceCard = ({ title, sub, icon: Icon, color, status = "online", items }: any) => (
    <div className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm transition-all hover:bg-zinc-900/80 hover:border-${color}-500/30 group`}>
        <div className={`absolute top-0 right-0 p-3 opacity-50`}>
            {/* Background glow */}
            <div className={`w-24 h-24 rounded-full bg-${color}-500/10 blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-${color}-500/20`}></div>
        </div>

        <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-${color}-400`}>
                    <Icon size={20} />
                </div>
                <div>
                    <h3 className="font-semibold text-zinc-100">{title}</h3>
                    <p className="text-xs text-zinc-500 font-mono">{sub}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">ON LINE</span>
            </div>
        </div>

        {items && (
            <div className="space-y-2">
                {items.map((item: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                        <div className={`w-1 h-1 rounded-full bg-${color}-500/50`}></div>
                        {item}
                    </div>
                ))}
            </div>
        )}
    </div>
);

const ConnectionLine = ({ height = 40, active = false }: { height?: number, active?: boolean }) => (
    <div className={`w-px mx-auto bg-gradient-to-b from-zinc-800 to-zinc-800 ${active ? 'from-indigo-500/50 to-indigo-500/50' : ''}`} style={{ height }} />
);

const HorizontalBrace = ({ width = "100%" }) => (
    <div className="relative h-4 w-full flex justify-center">
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-zinc-800"></div>
        <div className="absolute top-0 left-1/4 h-4 w-px bg-zinc-800"></div>
        <div className="absolute top-0 right-1/4 h-4 w-px bg-zinc-800"></div>
        <div className="absolute top-0 left-1/2 h-4 w-px bg-zinc-800 -translate-x-1/2"></div>
    </div>
);

export default function AdminArchitecture() {
    const { stats, error } = useLoaderData<any>();
    const revalidator = useRevalidator();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        revalidator.revalidate();
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200 px-8 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-zinc-900">System Architecture</h1>
                    <p className="text-sm text-zinc-500">Microservices overview and communication status</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors rounded-full hover:bg-zinc-100"
                >
                    <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="p-8 pb-32 max-w-[1400px] mx-auto">

                {/* Entrance Nodes */}
                <div className="flex justify-center gap-6 mb-2">
                    <div className="px-4 py-2 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-400 text-sm flex items-center gap-2">
                        <Globe size={14} /> Web App
                    </div>
                    <div className="px-4 py-2 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-400 text-sm flex items-center gap-2">
                        <Layout size={14} /> Admin Portal
                    </div>
                    <div className="px-4 py-2 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-400 text-sm flex items-center gap-2">
                        <Globe size={14} /> Public API
                    </div>
                </div>

                <div className="flex justify-center mb-2">
                    <div className="h-8 w-px border-l border-dashed border-zinc-600"></div>
                </div>

                {/* Gateway */}
                <div className="max-w-2xl mx-auto mb-8 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider shadow-lg shadow-indigo-500/20 z-10">
                        Entrance
                    </div>
                    <div className="rounded-2xl border border-indigo-500/30 bg-zinc-900/80 p-8 text-center relative overflow-hidden backdrop-blur-xl shadow-2xl shadow-indigo-900/20">
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                        <div className="flex flex-col items-center gap-2 relative z-10">
                            <layers className="text-indigo-400 mb-2" size={32} />
                            <h2 className="text-xl font-bold text-white">API Gateway</h2>
                            <span className="font-mono text-zinc-500 text-sm">`packages/api`</span>

                            <div className="flex gap-2 mt-4">
                                {['Routing', 'Rate Limiting', 'Auth Context', 'Observability'].map(tag => (
                                    <span key={tag} className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto mb-8">
                    <HorizontalBrace />
                </div>

                {/* Microservices */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16 px-4">
                    <ServiceCard
                        title="Core API"
                        sub="apps/core-api"
                        icon={Shield}
                        color="emerald"
                        items={['Identity', 'Tenants', 'Onboarding', 'Platform Admin']}
                    />
                    <ServiceCard
                        title="Commerce API"
                        sub="apps/commerce-api"
                        icon={ShoppingCreditCard}
                        color="blue"
                        items={['Billing', 'Subscriptions', 'Products', 'POS', 'Webhooks']}
                    />
                    <ServiceCard
                        title="Studio API"
                        sub="apps/studio-api"
                        icon={Calendar}
                        color="orange"
                        items={['Classes', 'Bookings', 'Members', 'Waivers', 'Payroll']}
                    />
                </div>

                {/* Infrastructure Layer */}
                <div className="max-w-3xl mx-auto">
                    <div className="border-t border-zinc-800 pt-8 flex gap-6">
                        <div className="flex-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors">
                            <div className="p-3 bg-zinc-800 rounded-lg text-zinc-400">
                                <Database size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-zinc-200">Database</h4>
                                <p className="text-xs text-zinc-500">Cloudflare D1 (SQLite)</p>
                            </div>
                        </div>
                        <div className="flex-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors">
                            <div className="p-3 bg-zinc-800 rounded-lg text-zinc-400">
                                <Box size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-zinc-200">Shared Lib</h4>
                                <p className="text-xs text-zinc-500">Middleware, Utils, Types</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-6 z-50">
                <div className="max-w-7xl mx-auto">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-4">Gateway Performance</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100">
                            <div className="text-xs font-bold text-zinc-400 uppercase mb-1">DB Read Latency</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-zinc-900">{stats?.latency?.database_ms || 0}</span>
                                <span className="text-sm text-zinc-500">ms</span>
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100">
                            <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Edge Latency</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-zinc-900">{stats?.latency?.edge_ms || 0}</span>
                                <span className="text-sm text-zinc-500">ms</span>
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100">
                            <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Worker Region</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-zinc-900">{stats?.worker?.region || 'Unknown'}</span>
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100">
                            <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Memory Used</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-zinc-900">{stats?.worker?.memory_used_mb || 0}</span>
                                <span className="text-sm text-zinc-500">MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
