
import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { RefreshCw, Layout, Smartphone, Globe, Database, Layers, Shield, CreditCard, Calendar, Box } from "lucide-react";

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
    <div className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 backdrop-blur-sm transition-all hover:bg-zinc-900 hover:border-${color}-500/30 group z-10`}>
        <div className={`absolute top-0 right-0 p-3 opacity-50`}>
            {/* Background glow */}
            <div className={`w-24 h-24 rounded-full bg-${color}-500/10 blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-${color}-500/20`}></div>
        </div>

        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-${color}-400`}>
                    <Icon size={18} />
                </div>
                <div>
                    <h3 className="font-semibold text-zinc-100 text-sm">{title}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">{sub}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">ON LINE</span>
            </div>
        </div>

        {items && (
            <div className="space-y-1.5">
                {items.map((item: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <div className={`w-1 h-1 rounded-full bg-${color}-500/50`}></div>
                        {item}
                    </div>
                ))}
            </div>
        )}
    </div>
);

// Grid-based connector lines that perfectly align with columns
const ConnectorLayer = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4 h-8 mb-[-1px]">
        {/* Left Column Connector */}
        <div className="relative h-full">
            <div className="absolute top-0 right-0 h-1/2 w-1/2 border-b border-l border-zinc-700 rounded-bl-xl opacity-30"></div>
            <div className="absolute top-[50%] left-1/2 h-1/2 w-px bg-zinc-700 opacity-30"></div>
        </div>

        {/* Center Column Connector */}
        <div className="relative h-full flex justify-center">
            <div className="h-full w-px bg-zinc-700 opacity-30"></div>
        </div>

        {/* Right Column Connector */}
        <div className="relative h-full">
            <div className="absolute top-0 left-0 h-1/2 w-1/2 border-b border-r border-zinc-700 rounded-br-xl opacity-30"></div>
            <div className="absolute top-[50%] left-1/2 h-1/2 w-px bg-zinc-700 opacity-30"></div>
        </div>
    </div>
);

const DotPattern = () => (
    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
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
        <div className="space-y-6">
            {/* Page Header (Static) */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-zinc-900">System Architecture</h1>
                        <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Live View</span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">Microservices overview and communication status</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-600 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
                >
                    <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* Main Architecture Diagram */}
            <div className="rounded-2xl bg-zinc-950 p-8 pb-12 relative overflow-hidden shadow-xl shadow-zinc-900/10 border border-zinc-900/50">
                <DotPattern />

                <div className="relative z-10">
                    {/* Entrance Nodes */}
                    <div className="flex justify-center gap-4 mb-4">
                        {[
                            { icon: Globe, label: "Web App" },
                            { icon: Layout, label: "Admin Portal" },
                            { icon: Globe, label: "Public API" }
                        ].map((item, i) => (
                            <div key={i} className="px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs flex items-center gap-2 backdrop-blur-sm">
                                <item.icon size={12} /> {item.label}
                            </div>
                        ))}
                    </div>

                    {/* Central Vertical Line */}
                    <div className="flex justify-center h-8 mb-4">
                        <div className="w-px border-l border-dashed border-zinc-800"></div>
                    </div>

                    {/* Gateway */}
                    <div className="max-w-xl mx-auto mb-4 relative">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-[4px] text-[9px] font-bold bg-indigo-600 text-white uppercase tracking-wider shadow-lg shadow-indigo-500/20 z-10">
                            Entrance
                        </div>
                        <div className="rounded-xl border border-indigo-500/20 bg-zinc-900/80 p-6 text-center relative overflow-hidden backdrop-blur-xl shadow-2xl shadow-indigo-900/10">
                            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                            <div className="flex flex-col items-center gap-1.5 relative z-10">
                                <Layers className="text-indigo-400 mb-1" size={24} />
                                <h2 className="text-lg font-bold text-white">API Gateway</h2>
                                <span className="font-mono text-zinc-600 text-xs">`packages/api`</span>

                                <div className="flex gap-1 mt-3 justify-center flex-wrap">
                                    {['Routing', 'Rate Limiting', 'Auth Context', 'Observability'].map(tag => (
                                        <span key={tag} className="px-1.5 py-0.5 rounded bg-indigo-500/5 border border-indigo-500/10 text-indigo-300/[0.7] text-[10px] font-medium">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Connection Lines Layer */}
                    <ConnectorLayer />

                    {/* Microservices */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12 px-4">
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
                            icon={CreditCard}
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

                    {/* Infrastructure Layer - Compact */}
                    <div className="max-w-2xl mx-auto flex gap-4 opacity-80 pt-8 border-t border-zinc-900">
                        <div className="flex-1 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-3 flex items-center gap-3 hover:border-zinc-700 transition-colors">
                            <div className="p-2 bg-zinc-900 rounded text-zinc-500 border border-zinc-800">
                                <Database size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-zinc-300">Database</h4>
                                <p className="text-[10px] text-zinc-600">Cloudflare D1</p>
                            </div>
                        </div>
                        <div className="flex-1 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-3 flex items-center gap-3 hover:border-zinc-700 transition-colors">
                            <div className="p-2 bg-zinc-900 rounded text-zinc-500 border border-zinc-800">
                                <Box size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-zinc-300">Shared Lib</h4>
                                <p className="text-[10px] text-zinc-600">Utils, Types</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Grid - Integrated & Dark */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-zinc-900/50">
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 hover:bg-zinc-900 transition-colors">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">DB Read Latency</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-zinc-200">{stats?.latency?.database_ms || 0}</span>
                        <span className="text-xs text-zinc-500">ms</span>
                    </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 hover:bg-zinc-900 transition-colors">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">Edge Latency</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-zinc-200">{stats?.latency?.edge_ms || 0}</span>
                        <span className="text-xs text-zinc-500">ms</span>
                    </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 hover:bg-zinc-900 transition-colors">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">Worker Region</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-zinc-200">{stats?.worker?.region || 'Unknown'}</span>
                    </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 hover:bg-zinc-900 transition-colors">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">Memory Used</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-zinc-200">{stats?.worker?.memory_used_mb || 0}</span>
                        <span className="text-xs text-zinc-500">MB</span>
                    </div>
                </div>
            </div>
        </div>
            </div >
        </div >
    );
}
