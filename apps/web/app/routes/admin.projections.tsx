import { useState, useMemo } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ReferenceLine
} from "recharts";
import {
    TrendingUp, Activity, Zap, Info
} from "lucide-react";

export default function AdminProjections() {
    // --- 1. Revenue Drivers ---
    const [tenants, setTenants] = useState(50);
    const [monthlyFee, setMonthlyFee] = useState(49); // SaaS Fee per tenant
    const [avgVol, setAvgVol] = useState(5000); // Transaction Volume per tenant
    const [platformFee, setPlatformFee] = useState(1.0); // % Platform Fee (formerly Take Rate)
    const [growthRate, setGrowthRate] = useState(5); // % Monthly Growth

    // --- 2. Instructor Pay Assumptions ---
    const [avgClassesPerMonth, setAvgClassesPerMonth] = useState(60);
    const [ownerMix, setOwnerMix] = useState(40); // % of classes taught by Owner (User Pay)
    const [instructorRate, setInstructorRate] = useState(30); // Hourly rate for hired instructors

    // --- 3. Infra Assumptions (Per Tenant) ---
    // Workers
    const [requestsPerMonth, setRequestsPerMonth] = useState(500_000);
    // Storage
    const [storageGB, setStorageGB] = useState(10);
    // Streaming
    const [streamMinutes, setStreamMinutes] = useState(100); // Minutes of CONTENT stored
    const [avgViewers, setAvgViewers] = useState(3); // Avg viewers per minute of content (multiplier)
    // Communications
    const [emailVol, setEmailVol] = useState(2500);
    const [smsVol, setSmsVol] = useState(200);

    // Feature Toggles
    const [useR2, setUseR2] = useState(true);
    const [useStream, setUseStream] = useState(true);
    const [useWorkers, setUseWorkers] = useState(true);
    const [useComms, setUseComms] = useState(true);
    const [viralMode, setViralMode] = useState(false);

    // --- 4. Cost Constants (Unit Economics) ---
    const COSTS = {
        WORKERS_REQ_PRICE: 0.30 / 1_000_000,
        WORKERS_BASE: 5.00,
        R2_STORAGE_GB: 0.015,
        R2_CLASS_A: 4.50 / 1_000_000,
        R2_CLASS_B: 0.36 / 1_000_000,
        STREAM_STORAGE_MIN: 0.005, // $5 per 1000 mins stored
        STREAM_DELIVERY_MIN: 0.001, // $1 per 1000 mins viewed
        EMAIL_COST: 0.0006, // $0.60 per 1000 emails (Resend)
        SMS_COST: 0.0079, // $0.0079 per segment (Twilio)
    };

    // --- 5. Simulation Logic ---
    const projectionData = useMemo(() => {
        const data = [];
        let currentTenants = tenants;

        // Viral Mode Multiplier
        const effectiveGrowth = viralMode ? 20 : growthRate;

        for (let month = 0; month < 12; month++) {
            // Revenue
            const saasRevenue = currentTenants * monthlyFee;
            const tranxRevenue = currentTenants * avgVol * (platformFee / 100);
            const totalRevenue = saasRevenue + tranxRevenue;

            // Costs
            // 1. Infrastructure (App)
            const workerCost = useWorkers ?
                Math.max(COSTS.WORKERS_BASE, (currentTenants * requestsPerMonth * COSTS.WORKERS_REQ_PRICE)) : 0;
            const r2Cost = useR2 ? (currentTenants * storageGB * COSTS.R2_STORAGE_GB) : 0;

            // 2. Streaming (Storage + Delivery)
            // Delivery = StoredMins * Viewers
            const streamCost = useStream ?
                (currentTenants * (
                    (streamMinutes * COSTS.STREAM_STORAGE_MIN) +
                    (streamMinutes * avgViewers * COSTS.STREAM_DELIVERY_MIN)
                )) : 0;

            // 3. Communications (Email + SMS)
            const commsCost = useComms ?
                (currentTenants * (
                    (emailVol * COSTS.EMAIL_COST) +
                    (smsVol * COSTS.SMS_COST)
                )) : 0;

            const totalInfraCost = workerCost + r2Cost + streamCost + commsCost;

            // Platform Profit
            const platformProfit = totalRevenue - totalInfraCost;
            const margin = totalRevenue > 0 ? (platformProfit / totalRevenue) * 100 : 0;

            // Tenant Economics (Avg Single Studio)
            // Revenue: MonthlyFee (Actually they PAY this) + TransactionVolume (Gross)
            // Expenses: SaaS Fee + CreditCardFees (2.9%) + InstructorPay
            const tenantGross = avgVol;
            const tenantStripeFee = avgVol * 0.029;
            const tenantSaasCost = monthlyFee; // + infra usage if billed back? Assuming flat fee.

            // Instructor Pay Logic
            const hiredClasses = avgClassesPerMonth * ((100 - ownerMix) / 100);
            const tenantInstructorCost = hiredClasses * instructorRate;

            const tenantExpenses = tenantStripeFee + tenantSaasCost + tenantInstructorCost;
            const tenantNet = tenantGross - tenantExpenses;

            data.push({
                name: `Month ${month + 1}`,
                tenants: Math.round(currentTenants),
                revenue: totalRevenue,
                infraCost: totalInfraCost,
                profit: platformProfit,
                workerCost,
                r2Cost,
                streamCost,
                commsCost,
                margin,
                // Tenant Metrics for reference
                tenantNet
            });

            // Grow
            currentTenants = currentTenants * (1 + effectiveGrowth / 100);
        }
        return data;
    }, [tenants, monthlyFee, avgVol, platformFee, growthRate, storageGB, streamMinutes, avgViewers, requestsPerMonth, emailVol, smsVol, useR2, useStream, useWorkers, useComms, viralMode, avgClassesPerMonth, ownerMix, instructorRate]);

    // Summary Stats (Month 12)
    const finalMonth = projectionData[11];
    const totalARR = finalMonth.revenue * 12;
    const breakEvenMonth = projectionData.find(d => d.profit > 0)?.name || "N/A";

    const costBreakdown = [
        { name: 'Workers', value: finalMonth.workerCost, color: '#F59E0B' }, // Amber
        { name: 'R2 Storage', value: finalMonth.r2Cost, color: '#3B82F6' }, // Blue
        { name: 'Stream', value: finalMonth.streamCost, color: '#EF4444' }, // Red
        { name: 'Comms (Email/SMS)', value: finalMonth.commsCost, color: '#10B981' }, // Green
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
                        Platform Projections
                    </h1>
                    <p className="text-zinc-500 mt-1">
                        SaaS margins and Unit Economics simulator.
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
                    label="Avg Tenant Net (Monthly)"
                    value={formatCurrency(finalMonth.tenantNet)}
                    sub="After Fees & Teacher Pay"
                    color="text-amber-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Input Controls */}
                <div className="space-y-6">
                    <Card title="Revenue Drivers">
                        <EditableControl label="Starting Tenants" val={tenants} set={setTenants} />
                        <EditableControl label="Monthly Fee ($)" val={monthlyFee} set={setMonthlyFee} />
                        <EditableControl label="Growth Rate (%)" val={growthRate} set={setGrowthRate} disabled={viralMode} />
                        <EditableControl label="Platform Fee (%)" val={platformFee} set={setPlatformFee} step={0.1} />
                        <EditableControl label="Avg Trans. Vol ($)" val={avgVol} set={setAvgVol} />
                    </Card>

                    <Card title="Tenant Economics (Avg)">
                        <EditableControl label="Classes / Month" val={avgClassesPerMonth} set={setAvgClassesPerMonth} />
                        <EditableControl label="Instructor Hourly ($)" val={instructorRate} set={setInstructorRate} />
                        <div className="pt-2 border-t border-zinc-100 mt-2">
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Owner Taught Mix</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range" min="0" max="100" value={ownerMix}
                                    onChange={e => setOwnerMix(Number(e.target.value))}
                                    className="flex-1 accent-indigo-600"
                                />
                                <span className="text-sm font-mono w-12 text-right">{ownerMix}%</span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">
                                {Math.round(avgClassesPerMonth * (ownerMix / 100))} classes by Owner (Free/Profit)<br />
                                {Math.round(avgClassesPerMonth * ((100 - ownerMix) / 100))} classes by Instructors (Paid)
                            </p>
                        </div>
                    </Card>

                    <Card title="Infra Costs (Per Tenant)">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <Toggle label="Workers" checked={useWorkers} set={setUseWorkers} />
                            <Toggle label="R2 Storage" checked={useR2} set={setUseR2} />
                            <Toggle label="Stream VOD" checked={useStream} set={setUseStream} />
                            <Toggle label="Email/SMS" checked={useComms} set={setUseComms} />
                        </div>

                        <EditableControl label="Storage (GB)" val={storageGB} set={setStorageGB} disabled={!useR2} />
                        <EditableControl label="Requests (M)" val={requestsPerMonth / 1_000_000} set={(v: number) => setRequestsPerMonth(v * 1_000_000)} step={0.1} disabled={!useWorkers} />

                        <div className="pt-4 border-t border-zinc-100 mt-4">
                            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide mb-2">Streaming</h4>
                            <EditableControl label="Mins Stored" val={streamMinutes} set={setStreamMinutes} disabled={!useStream} />
                            <EditableControl label="Avg Viewers/Min" val={avgViewers} set={setAvgViewers} disabled={!useStream} />
                        </div>

                        <div className="pt-4 border-t border-zinc-100 mt-4">
                            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide mb-2">Communications</h4>
                            <EditableControl label="Emails / Mo" val={emailVol} set={setEmailVol} disabled={!useComms} />
                            <EditableControl label="SMS / Mo" val={smsVol} set={setSmsVol} disabled={!useComms} />
                        </div>
                    </Card>

                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm opacity-80">
                        <p className="flex items-center gap-2 font-bold mb-1"><Info size={14} /> Unit Costs:</p>
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs list-disc list-inside">
                            <li>Request: $0.30 / M</li>
                            <li>R2: $0.015 / GB</li>
                            <li>Stream Store: $0.005</li>
                            <li>Stream View: $0.001</li>
                            <li>Email: $0.60 / k</li>
                            <li>SMS: $0.0079 / msg</li>
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
                                    formatter={(value: any) => formatCurrency(Number(value) || 0)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                <Area type="monotone" dataKey="infraCost" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" name="Infra Cost" />
                                <ReferenceLine y={0} stroke="#000" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Cost Breakdown */}
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-[300px] flex flex-col">
                            <h3 className="font-bold text-zinc-900 mb-4">Infra Cost Breakdown</h3>
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
                                            <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
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

                        {/* Tenant Profitability Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-[300px]">
                            <h3 className="font-bold text-zinc-900 mb-4">Avg Tenant Profit History</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={projectionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" hide />
                                    <YAxis hide />
                                    <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                                    <Area type="monotone" dataKey="tenantNet" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-zinc-400 text-center mt-2">
                                * Simulates single studio profit after fees & payroll (assuming constant volume)
                            </p>
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
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

function EditableControl({ label, val, set, step = 1, disabled }: any) {
    return (
        <div className={`flex items-center justify-between gap-4 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
            <label className="text-sm font-medium text-zinc-700 flex-1">{label}</label>
            <input
                type="number"
                step={step}
                value={val}
                onChange={(e) => set(parseFloat(e.target.value) || 0)}
                className="w-24 text-right px-2 py-1 border border-zinc-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
        </div>
    );
}

function Toggle({ label, checked, set }: any) {
    return (
        <button
            onClick={() => set(!checked)}
            className={`flex items-center justify-between p-2 rounded-lg border transition-all w-full text-xs ${checked ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-white border-zinc-200 text-zinc-500"
                }`}
        >
            <span className="font-medium">{label}</span>
            <div className={`w-6 h-3 rounded-full relative transition-colors ${checked ? "bg-indigo-500" : "bg-zinc-300"}`}>
                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-transform ${checked ? "left-3.5" : "left-0.5"}`} />
            </div>
        </button>
    );
}
