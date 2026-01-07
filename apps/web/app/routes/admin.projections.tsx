import { useState, useMemo } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ReferenceLine
} from "recharts";
import {
    TrendingUp, DollarSign, Users, Database, Server, Video,
    Activity, Zap, Info
} from "lucide-react";

export default function AdminProjections() {
    // --- 1. Simulation Controls ---
    const [tenants, setTenants] = useState(50);
    const [monthlyFee, setMonthlyFee] = useState(49); // SaaS Fee per tenant
    const [avgVol, setAvgVol] = useState(5000); // Transaction Volume per tenant
    const [takeRate, setTakeRate] = useState(1.0); // % Platform Fee
    const [growthRate, setGrowthRate] = useState(5); // % Monthly Growth

    // Infrastructure Assumptions (Per Tenant)
    const [storageGB, setStorageGB] = useState(10);
    const [streamMinutes, setStreamMinutes] = useState(100);
    const [requestsPerMonth, setRequestsPerMonth] = useState(500_000);

    // Feature Toggles
    const [useR2, setUseR2] = useState(true);
    const [useStream, setUseStream] = useState(true);
    const [useWorkers, setUseWorkers] = useState(true);
    const [viralMode, setViralMode] = useState(false);

    // --- 2. Cost Constants (Unit Economics) ---
    // Approximations based on Cloudflare / Infrastructure
    const COSTS = {
        WORKERS_REQ_PRICE: 0.30 / 1_000_000,
        WORKERS_BASE: 5.00, // Min plan
        R2_STORAGE_GB: 0.015,
        R2_CLASS_A: 4.50 / 1_000_000, // Write
        R2_CLASS_B: 0.36 / 1_000_000, // Read
        STREAM_STORAGE_MIN: 0.005, // $5 per 1000 mins stored
        STREAM_DELIVERY_MIN: 0.001 // $1 per 1000 mins viewed
    };

    // --- 3. Simulation Logic ---
    const projectionData = useMemo(() => {
        const data = [];
        let currentTenants = tenants;

        // Viral Mode Multiplier
        const effectiveGrowth = viralMode ? 20 : growthRate;

        for (let month = 0; month < 12; month++) {
            // Revenue
            const saasRevenue = currentTenants * monthlyFee;
            const tranxRevenue = currentTenants * avgVol * (takeRate / 100);
            const totalRevenue = saasRevenue + tranxRevenue;

            // Costs
            // Workers: (Tenants * Reqs)
            const workerCost = useWorkers ?
                Math.max(COSTS.WORKERS_BASE, (currentTenants * requestsPerMonth * COSTS.WORKERS_REQ_PRICE)) : 0;

            // R2: (Tenants * GB)
            const r2Cost = useR2 ? (currentTenants * storageGB * COSTS.R2_STORAGE_GB) : 0;

            // Stream: (Tenants * Mins)
            // Simplified: Assuming Mins are stored. Delivery is roughly same.
            const streamCost = useStream ?
                (currentTenants * streamMinutes * (COSTS.STREAM_STORAGE_MIN + COSTS.STREAM_DELIVERY_MIN)) : 0;

            const totalCost = workerCost + r2Cost + streamCost;
            const profit = totalRevenue - totalCost;
            const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

            data.push({
                name: `Month ${month + 1}`,
                tenants: Math.round(currentTenants),
                revenue: totalRevenue,
                cost: totalCost,
                profit: profit,
                workerCost,
                r2Cost,
                streamCost,
                margin
            });

            // Grow
            currentTenants = currentTenants * (1 + effectiveGrowth / 100);
        }
        return data;
    }, [tenants, monthlyFee, avgVol, takeRate, growthRate, storageGB, streamMinutes, requestsPerMonth, useR2, useStream, useWorkers, viralMode]);

    // Summary Stats (Month 12)
    const finalMonth = projectionData[11];
    const totalARR = finalMonth.revenue * 12;
    const breakEvenMonth = projectionData.find(d => d.profit > 0)?.name || "N/A";

    const costBreakdown = [
        { name: 'Workers', value: finalMonth.workerCost, color: '#F59E0B' }, // Amber
        { name: 'R2 Storage', value: finalMonth.r2Cost, color: '#3B82F6' }, // Blue
        { name: 'Stream', value: finalMonth.streamCost, color: '#EF4444' }, // Red
    ].filter(i => i.value > 0);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                        <TrendingUp className="text-indigo-600" />
                        Cost vs. Profit Simulator
                    </h1>
                    <p className="text-zinc-500 mt-1">
                        Project SaaS margins based on unit economics and scaling factors.
                    </p>
                </div>
                <button
                    onClick={() => setViralMode(!viralMode)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2
                        ${viralMode
                            ? "bg-purple-600 text-white shadow-purple-500/50 scale-105 animate-pulse"
                            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"}`}
                >
                    <Zap size={16} className={viralMode ? "fill-current" : ""} />
                    {viralMode ? "VIRAL MODE ACTIVE" : "Activate Viral Mode"}
                </button>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Proj. Annual Revenue (ARR)"
                    value={formatCurrency(totalARR)}
                    sub={`End of Year 1 (${finalMonth.tenants} Tenants)`}
                    color="text-emerald-600"
                />
                <MetricCard
                    label="Monthly Profit (Month 12)"
                    value={formatCurrency(finalMonth.profit)}
                    sub={`${finalMonth.margin.toFixed(1)}% Margin`}
                    color={finalMonth.profit > 0 ? "text-indigo-600" : "text-red-600"}
                />
                <MetricCard
                    label="Break Even Point"
                    value={breakEvenMonth}
                    sub="First profitable month"
                    color="text-zinc-900"
                />
                <MetricCard
                    label="Cost per Tenant"
                    value={formatCurrency(finalMonth.cost / finalMonth.tenants)}
                    sub="Infrastructure Unit Cost"
                    color="text-amber-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Input Controls */}
                <div className="space-y-6">
                    <Card title="Revenue Drivers">
                        <SliderControl label="Starting Tenants" val={tenants} set={setTenants} min={10} max={1000} step={10} />
                        <SliderControl label="Monthly Fee ($)" val={monthlyFee} set={setMonthlyFee} min={0} max={299} step={1} />
                        <SliderControl label="Growth Rate (%)" val={growthRate} set={setGrowthRate} min={0} max={50} disabled={viralMode} />
                        <SliderControl label="Take Rate (%)" val={takeRate} set={setTakeRate} min={0} max={5} step={0.1} />
                        <SliderControl label="Avg Transaction Vol ($)" val={avgVol} set={setAvgVol} min={1000} max={50000} step={1000} />
                    </Card>

                    <Card title="Infrastructure Costs (Per Tenant)">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <Toggle label="App Workers" checked={useWorkers} set={setUseWorkers} />
                            <Toggle label="R2 Storage" checked={useR2} set={setUseR2} />
                            <Toggle label="Stream VOD" checked={useStream} set={setUseStream} />
                        </div>
                        <SliderControl label="R2 Storage (GB)" val={storageGB} set={setStorageGB} min={1} max={500} disabled={!useR2} />
                        <SliderControl label="Stream Mins (Stored)" val={streamMinutes} set={setStreamMinutes} min={10} max={5000} disabled={!useStream} />
                        <SliderControl label="Requests (Millions)" val={requestsPerMonth / 1_000_000} set={(v) => setRequestsPerMonth(v * 1_000_000)} min={0.1} max={10} step={0.1} disabled={!useWorkers} />
                    </Card>

                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm opacity-80">
                        <p className="flex items-center gap-2 font-bold mb-1"><Info size={14} /> Cost Assumptions:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Workers: $0.30 / million reqs</li>
                            <li>R2: $0.015 / GB</li>
                            <li>Stream: $0.006 / min (Store+Deliver)</li>
                        </ul>
                    </div>
                </div>

                {/* Right: Charts */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Main Area Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-[400px]">
                        <h3 className="font-bold text-zinc-900 mb-4">Projected Profit vs. Cost</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={projectionData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                                <XAxis dataKey="name" fontSize={12} stroke="#71717A" />
                                <YAxis fontSize={12} stroke="#71717A" tickFormatter={(val) => `$${val / 1000}k`} />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                <Area type="monotone" dataKey="cost" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" name="Total Cost" />
                                <ReferenceLine y={0} stroke="#000" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Profit Margin Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-[300px]">
                            <h3 className="font-bold text-zinc-900 mb-4">Net Profit</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={projectionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" hide />
                                    <YAxis hide />
                                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Area type="monotone" dataKey="profit" stroke="#4F46E5" fill="#EEF2FF" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Cost Breakdown */}
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-[300px] flex flex-col">
                            <h3 className="font-bold text-zinc-900 mb-4">Month 12 Cost Breakdown</h3>
                            {costBreakdown.length > 0 ? (
                                <div className="flex-1 flex text-xs">
                                    <ResponsiveContainer width="60%">
                                        <PieChart>
                                            <Pie
                                                data={costBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {costBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-col justify-center space-y-2">
                                        {costBreakdown.map(item => (
                                            <div key={item.name} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span>{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-zinc-400">No Costs Selected</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Specific UI Components ---

function MetricCard({ label, value, sub, color }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h4 className="text-sm font-medium text-zinc-500 mb-1">{label}</h4>
            <div className={`text-3xl font-bold tracking-tight ${color}`}>{value}</div>
            <div className="text-xs text-zinc-400 mt-2">{sub}</div>
        </div>
    );
}

function Card({ title, children }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <Activity size={18} className="text-zinc-400" />
                {title}
            </h3>
            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
}

function SliderControl({ label, val, set, min, max, step = 1, disabled }: any) {
    return (
        <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
            <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-zinc-700">{label}</label>
                <div className="text-sm font-mono text-indigo-600 bg-indigo-50 px-2 rounded">
                    {val.toLocaleString()}
                </div>
            </div>
            <input
                type="range"
                className="w-full accent-indigo-600 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) => set(Number(e.target.value))}
            />
        </div>
    );
}

function Toggle({ label, checked, set }: any) {
    return (
        <button
            onClick={() => set(!checked)}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${checked ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-white border-zinc-200 text-zinc-500"
                }`}
        >
            <span className="text-sm font-medium">{label}</span>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${checked ? "bg-indigo-500" : "bg-zinc-300"}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? "left-4.5" : "left-0.5"}`} style={{ left: checked ? 'calc(100% - 14px)' : '2px' }} />
            </div>
        </button>
    );
}
