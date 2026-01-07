import { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Users, Calendar, DollarSign, Target, Activity, ChevronDown, Download, RefreshCw, Percent } from "lucide-react";
import type { ReportsRevenueResponse, ReportsAttendanceResponse } from "api/src/types";

interface LoaderData {
    revenue: ReportsRevenueResponse | null;
    attendance: ReportsAttendanceResponse | null;
    days: number;
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const url = new URL(args.request.url);
    const days = url.searchParams.get("days") || "30";
    const token = await getToken();

    try {
        const [revenueData, attendanceData] = await Promise.all([
            apiRequest<ReportsRevenueResponse>(`/reports/revenue?days=${days}`, token, { headers: { 'X-Tenant-Slug': slug as string } }),
            apiRequest<ReportsAttendanceResponse>(`/reports/attendance?days=${days}`, token, { headers: { 'X-Tenant-Slug': slug as string } })
        ]);

        return {
            revenue: revenueData,
            attendance: attendanceData,
            days: parseInt(days)
        };
    } catch (e) {
        console.error("Reports Loader Error", e);
        return { revenue: null, attendance: null, days: parseInt(days) };
    }
};

export default function AdvancedReports() {
    const { revenue, attendance, days } = useLoaderData<LoaderData>();
    const [searchParams, setSearchParams] = useSearchParams();

    const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const formatNumber = (n: number) => n.toLocaleString();

    const changeDays = (newDays: number) => {
        setSearchParams({ days: newDays.toString() });
    };

    // Simple bar chart rendering
    const maxValue = Math.max(...(revenue?.chartData?.map((d) => d.value) || [1]));

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-lg text-white"><BarChart3 size={20} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Advanced Reports</h1>
                            <p className="text-sm text-zinc-500">Analytics & insights</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={days}
                            onChange={(e) => changeDays(parseInt(e.target.value))}
                            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                        >
                            <option value="7">Last 7 days</option>
                            <option value="30">Last 30 days</option>
                            <option value="90">Last 90 days</option>
                            <option value="365">Last year</option>
                        </select>
                        <button className="p-2 hover:bg-zinc-100 rounded-lg"><Download size={18} /></button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-4 gap-4">
                    <MetricCard
                        icon={DollarSign}
                        label="Gross Revenue"
                        value={formatCurrency(revenue?.grossVolume || 0)}
                        color="emerald"
                    />
                    <MetricCard
                        icon={Activity}
                        label="MRR"
                        value={formatCurrency(revenue?.mrr || 0)}
                        color="blue"
                    />
                    <MetricCard
                        icon={Calendar}
                        label="Total Bookings"
                        value={formatNumber(attendance?.totalBookings || 0)}
                        color="purple"
                    />
                    <MetricCard
                        icon={Target}
                        label="Check-in Rate"
                        value={attendance?.totalBookings ? `${Math.round((attendance?.totalCheckins || 0) / attendance.totalBookings * 100)}%` : '0%'}
                        color="orange"
                    />
                </div>

                {/* Revenue Chart */}
                <div className="bg-white rounded-xl border border-zinc-200 p-6">
                    <h2 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" /> Revenue Over Time
                    </h2>
                    <div className="h-48 flex items-end gap-1">
                        {revenue?.chartData?.slice(-30).map((d, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-600 transition relative group"
                                style={{ height: `${Math.max(2, (d.value / maxValue) * 100)}%` }}
                            >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                                    {d.name}: {formatCurrency(d.value)}
                                </div>
                            </div>
                        )) || <div className="flex-1 text-center text-zinc-400">No data</div>}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-zinc-500">
                        <span>{revenue?.chartData?.[0]?.name || ''}</span>
                        <span>{revenue?.chartData?.[revenue?.chartData?.length - 1]?.name || ''}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {/* Revenue Breakdown */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-6">
                        <h2 className="font-bold text-zinc-900 mb-4">Revenue Sources</h2>
                        <div className="space-y-3">
                            {revenue?.breakdown && Object.entries(revenue.breakdown).map(([key, value], i: number) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][i % 4] }} />
                                        <span className="text-sm text-zinc-700 capitalize">{key}</span>
                                    </div>
                                    <span className="font-medium">{formatCurrency(value as number)}</span>
                                </div>
                            )) || <p className="text-zinc-400 text-sm">No breakdown available</p>}
                        </div>
                    </div>

                    {/* Top Classes */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-6">
                        <h2 className="font-bold text-zinc-900 mb-4">Top Classes</h2>
                        <div className="space-y-3">
                            {attendance?.topClasses?.slice(0, 5).map((cls, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-medium">{i + 1}</span>
                                        <span className="text-sm text-zinc-700 truncate max-w-[200px]">{cls.title}</span>
                                    </div>
                                    <span className="text-sm text-zinc-500">{cls.attendees} attendees</span>
                                </div>
                            )) || <p className="text-zinc-400 text-sm">No classes data</p>}
                        </div>
                    </div>
                </div>

                {/* Attendance Chart */}
                <div className="bg-white rounded-xl border border-zinc-200 p-6">
                    <h2 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-purple-500" /> Attendance Over Time
                    </h2>
                    <div className="h-32 flex items-end gap-1">
                        {attendance?.chartData?.slice(-30).map((d, i) => {
                            const max = Math.max(...(attendance?.chartData?.map((x) => x.value) || [1]));
                            return (
                                <div
                                    key={i}
                                    className="flex-1 bg-purple-500 rounded-t hover:bg-purple-600 transition"
                                    style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
                                />
                            );
                        }) || <div className="flex-1 text-center text-zinc-400">No data</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    const colors: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-600',
        blue: 'bg-blue-100 text-blue-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600'
    };

    return (
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${colors[color]}`}><Icon size={16} /></div>
                <span className="text-xs font-medium text-zinc-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{value}</div>
        </div>
    );
}
