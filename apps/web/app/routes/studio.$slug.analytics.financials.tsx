import { useOutletContext } from "react-router";
import { DollarSign, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";

import { useRevenue, useInstructorProfitability, DateRange } from "~/hooks/useAnalytics";
import { MetricCard } from "~/components/charts/MetricCard";
import React, { Suspense, lazy } from "react";
const RevenueChart = lazy(() => import("~/components/charts/RevenueChart").then(mod => ({ default: mod.RevenueChart })));
const InstructorRoiChart = lazy(() => import("~/components/charts/InstructorRoiChart").then(mod => ({ default: mod.InstructorRoiChart })));
import { PrivacyBlur } from "~/components/PrivacyBlur";

export default function AnalyticsFinancials() {
    const { tenant, dateRange, shouldBlur } = useOutletContext<{ tenant: any, dateRange: DateRange, shouldBlur: boolean }>();
    const { getToken } = useAuth();
    const [exporting, setExporting] = useState(false);

    const { data: revenueData, isLoading, isError, error } = useRevenue(tenant.slug, dateRange);
    const { data: roiData, isLoading: isLoadingRoi } = useInstructorProfitability(tenant.slug, dateRange);

    const handleExportJournal = async () => {
        setExporting(true);
        const end = new Date();
        const start = new Date();
        if (dateRange === '30d') start.setDate(end.getDate() - 30);
        if (dateRange === '90d') start.setDate(end.getDate() - 90);
        if (dateRange === '1y') start.setFullYear(end.getFullYear() - 1);

        try {
            const token = await getToken();
            const response = await fetch(`${(window as any).ENV.VITE_API_URL || ''}/reports/accounting/journal?format=csv&startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Slug': tenant.slug
                }
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `journal_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Failed to export journal", e);
            toast.error("Export failed");
        } finally {
            setExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
                <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
                <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
                <div className="col-span-1 md:col-span-3 h-80 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
            </div>
        );
    }

    if (isError) {
        return <div className="text-red-500">Error loading financials: {(error as any)?.message}</div>;
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-end mb-6">
                <button
                    onClick={handleExportJournal}
                    disabled={exporting}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white shadow hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <Download size={16} />
                    {exporting ? 'Exporting...' : 'Export Journal (CSV)'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {revenueData && (
                    <>
                        <MetricCard
                            title="Gross Volume (Period)"
                            value={<PrivacyBlur revealed={!shouldBlur} placeholder="***">{`$${(revenueData.grossVolume / 100).toFixed(2)}`}</PrivacyBlur>}
                            icon={<DollarSign size={20} className="text-green-600" />}
                        />
                        <MetricCard
                            title="Monthly Recurring Revenue"
                            value={<PrivacyBlur revealed={!shouldBlur} placeholder="***">{`$${(revenueData.mrr / 100).toFixed(2)}`}</PrivacyBlur>}
                            subtext="Active subscriptions snapshot"
                            icon={<TrendingUp size={20} className="text-blue-600" />}
                        />
                        <MetricCard
                            title="Sales Breakdown"
                            value={<PrivacyBlur revealed={!shouldBlur} placeholder="***">{`${((revenueData.breakdown.retail / (revenueData.grossVolume || 1)) * 100).toFixed(0)}% Retail`}</PrivacyBlur>}
                            subtext={`$${(revenueData.breakdown.packs / 100).toFixed(0)} Packs`}
                            icon={<DollarSign size={20} className="text-purple-600" />}
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-6">Revenue Trends</h3>
                    {shouldBlur && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center rounded-xl">
                            <div className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-lg shadow lg text-sm font-medium">Privacy Mode Enabled</div>
                        </div>
                    )}
                    <div className="h-80 w-full">
                        <Suspense fallback={<div className="h-full w-full bg-zinc-50 dark:bg-zinc-800/50 animate-pulse rounded-lg" />}>
                            <RevenueChart data={revenueData?.chartData} />
                        </Suspense>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
                    <h3 className="text-lg font-semibold mb-6">Top Selling</h3>
                    {shouldBlur && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center rounded-xl"></div>
                    )}
                    {revenueData?.breakdown && (
                        <div className="space-y-4">
                            {Object.entries(revenueData.breakdown).map(([key, value]: [string, any]) => {
                                const val = Number(value);
                                if (val === 0) return null;
                                const total = revenueData.grossVolume || 1;
                                const percent = (val / total) * 100;

                                return (
                                    <div key={key} className="flex items-center justify-between">
                                        <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">{key}</span>
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
                                            </div>
                                            <span className="text-xs font-mono text-zinc-500 w-16 text-right">${(val / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.values(revenueData.breakdown).every(v => v === 0) && (
                                <div className="text-center text-sm text-zinc-500 py-8">No specific sales data recorded.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative min-h-[400px] mt-8">
                <h3 className="text-lg font-semibold mb-6 flex justify-between items-center">
                    Instructor Profitability (ROI)
                    <span className="text-xs font-normal text-zinc-500">Revenue vs. Payroll Cost</span>
                </h3>
                {shouldBlur && (
                    <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center rounded-xl"></div>
                )}
                <div className="h-96 w-full">
                    <Suspense fallback={<div className="h-full w-full bg-zinc-50 dark:bg-zinc-800/50 animate-pulse rounded-lg" />}>
                        <InstructorRoiChart data={roiData} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
