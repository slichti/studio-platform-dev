import React, { useState, useMemo, lazy, Suspense } from "react";
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
const ProjectionsCharts = lazy(() => import("~/components/charts/ProjectionsCharts.client"));
import {
    TrendingUp, Activity, Zap, Info
} from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const plans = await apiRequest(`/public/plans`, token);
    return { plans };
};

export default function AdminProjections() {
    const { plans } = useLoaderData<any>();

    // Find plans or fallback. Public API uses nested prices object.
    const launchPlan = plans?.find((p: any) => p.slug === 'launch');
    const growthPlan = plans?.find((p: any) => p.slug === 'growth');
    const scalePlan = plans?.find((p: any) => p.slug === 'scale');

    const launchPrice = launchPlan?.prices?.monthly ?? 0;
    const growthPrice = growthPlan?.prices?.monthly ?? 4900;
    const scalePrice = scalePlan?.prices?.monthly ?? 12900;

    // --- 1. Revenue Drivers ---
    const [tenants, setTenants] = useState(50);
    const [growthRate, setGrowthRate] = useState(5); // % Monthly Growth

    // Tiers
    const [tierBasicPrice, setTierBasicPrice] = useState(launchPrice / 100);
    const [tierGrowthPrice, setTierGrowthPrice] = useState(growthPrice / 100);
    const [tierScalePrice, setTierScalePrice] = useState(scalePrice / 100);

    const [mixBasic, setMixBasic] = useState(60); // %
    const [mixGrowth, setMixGrowth] = useState(30); // %
    // Scale is remaining 100 - Basic - Growth

    const [avgVol, setAvgVol] = useState(5000); // Transaction Volume per tenant (GMV)
    const [platformFee, setPlatformFee] = useState(1.0); // % Platform Fee

    // --- 2. Instructor Pay Assumptions ---
    const [avgClassesPerMonth, setAvgClassesPerMonth] = useState(60);
    const [ownerMix, setOwnerMix] = useState(40); // % of classes taught by Owner
    const [instructorRate, setInstructorRate] = useState(30); // Hourly rate

    // --- 3. Infra Assumptions (Per Tenant) ---
    // Workers
    const [requestsPerMonth, setRequestsPerMonth] = useState(500_000);
    // Storage
    const [storageGB, setStorageGB] = useState(10);
    // Streaming
    const [streamMinutes, setStreamMinutes] = useState(100);
    const [avgViewers, setAvgViewers] = useState(3);
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
    const mixScale = Math.max(0, 100 - mixBasic - mixGrowth);
    const weightedAvgFee = (
        (tierBasicPrice * mixBasic) +
        (tierGrowthPrice * mixGrowth) +
        (tierScalePrice * mixScale)
    ) / 100;

    const projectionData = useMemo(() => {
        const data = [];
        let currentTenants = tenants;

        // Viral Mode Multiplier
        const effectiveGrowth = viralMode ? 20 : growthRate;

        for (let month = 0; month < 12; month++) {
            // Revenue
            const saasRevenue = currentTenants * weightedAvgFee;
            const tranxRevenue = currentTenants * avgVol * (platformFee / 100);
            const totalRevenue = saasRevenue + tranxRevenue;

            // Costs
            const workerCost = useWorkers ?
                Math.max(COSTS.WORKERS_BASE, (currentTenants * requestsPerMonth * COSTS.WORKERS_REQ_PRICE)) : 0;
            const r2Cost = useR2 ? (currentTenants * storageGB * COSTS.R2_STORAGE_GB) : 0;
            const streamCost = useStream ?
                (currentTenants * (
                    (streamMinutes * COSTS.STREAM_STORAGE_MIN) +
                    (streamMinutes * avgViewers * COSTS.STREAM_DELIVERY_MIN)
                )) : 0;
            const commsCost = useComms ?
                (currentTenants * (
                    (emailVol * COSTS.EMAIL_COST) +
                    (smsVol * COSTS.SMS_COST)
                )) : 0;

            const totalInfraCost = workerCost + r2Cost + streamCost + commsCost;
            const platformProfit = totalRevenue - totalInfraCost;
            const margin = totalRevenue > 0 ? (platformProfit / totalRevenue) * 100 : 0;

            // Tenant Economics (Avg Single Studio)
            const tenantGross = avgVol;
            const tenantStripeFee = avgVol * 0.029;
            const tenantSaasCost = weightedAvgFee;
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
                tenantNet
            });

            currentTenants = currentTenants * (1 + effectiveGrowth / 100);
        }
        return data;
    }, [tenants, avgVol, platformFee, growthRate, tierBasicPrice, tierGrowthPrice, tierScalePrice, mixBasic, mixGrowth, storageGB, streamMinutes, avgViewers, requestsPerMonth, emailVol, smsVol, useR2, useStream, useWorkers, useComms, viralMode, avgClassesPerMonth, ownerMix, instructorRate]);

    // Summary Stats
    const finalMonth = projectionData[11];
    const totalARR = finalMonth.revenue * 12;
    const breakEvenMonth = projectionData.find(d => d.profit > 0)?.name || "N/A";

    const costBreakdown = [
        { name: 'Workers', value: finalMonth.workerCost, color: '#F59E0B' },
        { name: 'R2 Storage', value: finalMonth.r2Cost, color: '#3B82F6' },
        { name: 'Stream', value: finalMonth.streamCost, color: '#EF4444' },
        { name: 'Comms', value: finalMonth.commsCost, color: '#10B981' },
    ].filter(i => i.value > 0);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        <TrendingUp className="text-indigo-600" />
                        Platform Projections
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        SaaS margins and Unit Economics simulator.
                    </p>
                </div>
                <button
                    onClick={() => setViralMode(!viralMode)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2
                        ${viralMode
                            ? "bg-purple-600 text-white shadow-purple-500/50 scale-105 animate-pulse"
                            : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"}`}
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
                    sub={`End of Year 1 (${Math.round(finalMonth.tenants)} Tenants)`}
                    color="text-emerald-600 dark:text-emerald-400"
                />
                <MetricCard
                    label="Monthly Profit (Month 12)"
                    value={formatCurrency(finalMonth.profit)}
                    sub={`${finalMonth.margin.toFixed(1)}% Margin`}
                    color={finalMonth.profit > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400"}
                />
                <MetricCard
                    label="Avg Revenue Per Tenant"
                    value={formatCurrency(weightedAvgFee)}
                    sub={`Weighted Avg (Mix)`}
                    color="text-zinc-900 dark:text-zinc-100"
                />
                <MetricCard
                    label="Avg Tenant Net (Monthly)"
                    value={formatCurrency(finalMonth.tenantNet)}
                    sub="After Fees & Expenses"
                    color="text-amber-600 dark:text-amber-400"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Input Controls */}
                <div className="space-y-6">
                    <Card title="Growth & Revenue">
                        <Control label="Starting Tenants" val={tenants} set={setTenants} min={0} max={1000} step={10} />
                        <Control label="Growth Rate (%)" val={growthRate} set={setGrowthRate} min={0} max={100} disabled={viralMode} />
                        <Control label="Avg Monthly GMV ($)" val={avgVol} set={setAvgVol} min={0} max={50000} step={500} />
                        <Control label="Platform Fee (%)" val={platformFee} set={setPlatformFee} min={0} max={10} step={0.1} />
                    </Card>

                    <Card title="Pricing Strategy">
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            <div>Basic</div>
                            <div>Growth</div>
                            <div>Scale</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            <input type="number" value={tierBasicPrice} onChange={e => setTierBasicPrice(Number(e.target.value))} className="w-full text-center border rounded py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" data-lpignore="true" />
                            <input type="number" value={tierGrowthPrice} onChange={e => setTierGrowthPrice(Number(e.target.value))} className="w-full text-center border rounded py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" data-lpignore="true" />
                            <input type="number" value={tierScalePrice} onChange={e => setTierScalePrice(Number(e.target.value))} className="w-full text-center border rounded py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" data-lpignore="true" />
                        </div>

                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase">Tier Mix</label>
                        <Control label="Basic %" val={mixBasic} set={setMixBasic} min={0} max={100} />
                        <Control label="Growth %" val={mixGrowth} set={setMixGrowth} min={0} max={100} />
                        <div className="flex justify-between items-center text-sm py-2 px-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-700 mt-2">
                            <span className="text-zinc-500 dark:text-zinc-400">Scale % (Remainder)</span>
                            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{mixScale}%</span>
                        </div>
                    </Card>

                    <Card title="Tenant Economics">
                        <Control label="Classes / Month" val={avgClassesPerMonth} set={setAvgClassesPerMonth} min={0} max={300} />
                        <Control label="Instructor Hourly ($)" val={instructorRate} set={setInstructorRate} min={15} max={100} />
                        <Control label="Owner Taught %" val={ownerMix} set={setOwnerMix} min={0} max={100} />
                    </Card>

                    <Card title="Infrastructure Costs">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <Toggle label="Workers" checked={useWorkers} set={setUseWorkers} />
                            <Toggle label="R2 Storage" checked={useR2} set={setUseR2} />
                            <Toggle label="Stream VOD" checked={useStream} set={setUseStream} />
                            <Toggle label="Email/SMS" checked={useComms} set={setUseComms} />
                        </div>

                        <Control label="Requests (M)" val={requestsPerMonth / 1_000_000} set={(v: number) => setRequestsPerMonth(v * 1_000_000)} step={0.1} min={0} max={50} disabled={!useWorkers} />
                        <Control label="Storage (GB)" val={storageGB} set={setStorageGB} min={0} max={1000} disabled={!useR2} />

                        <div className="my-4 pt-4 border-t border-zinc-100 dark:border-zinc-700 space-y-4">
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-2">Streaming</h4>
                            <Control label="Mins Stored" val={streamMinutes} set={setStreamMinutes} min={0} max={5000} disabled={!useStream} />
                            <Control label="Viewers/Min" val={avgViewers} set={setAvgViewers} min={1} max={50} disabled={!useStream} />
                        </div>

                        <div className="my-4 pt-4 border-t border-zinc-100 dark:border-zinc-700 space-y-4">
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-2">Communications</h4>
                            <Control label="Emails / Mo" val={emailVol} set={setEmailVol} min={0} max={50000} step={100} disabled={!useComms} />
                            <Control label="SMS / Mo" val={smsVol} set={setSmsVol} min={0} max={5000} step={50} disabled={!useComms} />
                        </div>
                    </Card>

                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm opacity-80">
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
                    <Suspense fallback={<div className="h-[400px] bg-zinc-50 dark:bg-zinc-800/50 animate-pulse rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400">Loading charts...</div>}>
                        <ProjectionsCharts
                            projectionData={projectionData}
                            costBreakdown={costBreakdown}
                            formatCurrency={formatCurrency}
                        />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

// --- Specific UI Components ---

function MetricCard({ label, value, sub, color }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">{label}</h4>
            <div className={`text-3xl font-bold tracking-tight ${color}`}>{value}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">{sub}</div>
        </div>
    );
}

function Card({ title, children }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                <Activity size={18} className="text-zinc-400" />
                {title}
            </h3>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

// Rewritten Control with Slider + Input + data-lpignore
function Control({ label, val, set, step = 1, min = 0, max = 100, disabled }: any) {
    return (
        <div className={`space-y-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
                <input
                    type="number"
                    step={step}
                    value={val}
                    onChange={(e) => set(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    autoComplete="off"
                    name={`field_stat_${Math.floor(Math.random() * 10000)}`}
                    id={`field_stat_${Math.floor(Math.random() * 10000)}`}
                />
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) => set(parseFloat(e.target.value) || 0)}
                className="w-full accent-indigo-600 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>
    );
}

function Toggle({ label, checked, set }: any) {
    return (
        <button
            onClick={() => set(!checked)}
            className={`flex items-center justify-between p-2 rounded-lg border transition-all w-full text-xs ${checked ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
        >
            <span className="font-medium">{label}</span>
            <div className={`w-6 h-3 rounded-full relative transition-colors ${checked ? "bg-indigo-500" : "bg-zinc-300"}`}>
                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-transform ${checked ? "left-3.5" : "left-0.5"}`} />
            </div>
        </button>
    );
}
