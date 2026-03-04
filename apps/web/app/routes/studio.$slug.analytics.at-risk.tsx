import { useOutletContext } from "react-router";
import { Users, AlertTriangle, Calendar } from "lucide-react";
import { useAtRisk, useChurnOverview } from "~/hooks/useAnalytics";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { useState, Suspense, lazy } from "react";
import { format } from "date-fns";
const ChurnChart = lazy(() => import("~/components/charts/ChurnChart.client").then(mod => ({ default: mod.ChurnChart })));

export default function AnalyticsAtRisk() {
    const { tenant } = useOutletContext<{ tenant: any }>();
    const [days, setDays] = useState(14);
    const { data, isLoading, isError, error } = useAtRisk(tenant?.slug ?? "", days);
    const { data: churnData } = useChurnOverview(tenant?.slug ?? "");

    if (isLoading) {
        return (
            <div className="space-y-6">
                <SkeletonLoader type="card" count={1} className="h-12" />
                <SkeletonLoader type="card" count={1} className="h-64" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-4 text-red-700 dark:text-red-300">
                Error loading at-risk report: {(error as Error)?.message}
            </div>
        );
    }

    const members = data?.members ?? [];
    const total = data?.total ?? 0;
    const minDays = data?.minDays ?? 14;

    return (
        <div className="animate-in fade-in duration-500 max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={22} />
                        At-Risk Members
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        Members with no class booking in the last {minDays}+ days. Reach out to re-engage.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-500 dark:text-zinc-400">No booking in:</label>
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    >
                        {[7, 14, 21, 30, 60].map((d) => (
                            <option key={d} value={d}>{d} days</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Churn Distribution Chart */}
            {churnData && (churnData as any).total > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">Member Health</h3>
                        <div className="h-64">
                            <Suspense fallback={<div className="h-full bg-zinc-50 dark:bg-zinc-800/50 animate-pulse rounded-lg" />}>
                                <ChurnChart data={churnData as any} />
                            </Suspense>
                        </div>
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-3 gap-4 content-start">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-green-600">{(churnData as any).safe}</div>
                            <div className="text-xs text-green-700 dark:text-green-400 mt-1 uppercase tracking-wide">Safe</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-amber-600">{(churnData as any).at_risk}</div>
                            <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 uppercase tracking-wide">At Risk</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-red-600">{(churnData as any).churned}</div>
                            <div className="text-xs text-red-700 dark:text-red-400 mt-1 uppercase tracking-wide">Churned</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                    <Users size={18} className="text-zinc-500" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{total} member{total !== 1 ? "s" : ""} at risk</span>
                </div>
                {members.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                        <Calendar size={40} className="mx-auto mb-2 opacity-50" />
                        <p>No members with {minDays}+ days since last booking.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-zinc-500 dark:text-zinc-400">
                                    <th className="px-6 py-3 font-medium">Name</th>
                                    <th className="px-6 py-3 font-medium">Email</th>
                                    <th className="px-6 py-3 font-medium">Days since last booking</th>
                                    <th className="px-6 py-3 font-medium">Last booking</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m) => (
                                    <tr key={m.memberId} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100">
                                            {[m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}
                                        </td>
                                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{m.email ?? "—"}</td>
                                        <td className="px-6 py-3">
                                            <span className="font-medium text-amber-600 dark:text-amber-400">
                                                {m.daysSinceLastBooking ?? "Never"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-zinc-500 dark:text-zinc-400">
                                            {m.lastBookingAt ? format(new Date(m.lastBookingAt), "MMM d, yyyy") : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
