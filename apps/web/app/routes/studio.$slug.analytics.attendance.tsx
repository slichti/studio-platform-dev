import { useOutletContext } from "react-router";
import { Users, CheckCircle2 } from "lucide-react";

import { useAttendance, DateRange } from "~/hooks/useAnalytics";
import { MetricCard } from "~/components/charts/MetricCard";
import React, { Suspense, lazy } from "react";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
const AttendanceChart = lazy(() => import("~/components/charts/AttendanceChart.client").then(mod => ({ default: mod.AttendanceChart })));

export default function AnalyticsAttendance() {
    const { tenant, dateRange } = useOutletContext<{ tenant: any, dateRange: DateRange }>();
    const { data: attendanceData, isLoading, isError, error } = useAttendance(tenant.slug, dateRange);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SkeletonLoader type="card" count={2} />
                </div>
                <SkeletonLoader type="card" count={1} className="h-[400px]" />
            </div>
        );
    }

    if (isError) {
        return <div className="text-red-500">Error loading attendance: {(error as any)?.message}</div>;
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {attendanceData && (
                    <>
                        <MetricCard
                            title="Total Bookings"
                            value={attendanceData.totalBookings}
                            icon={<Users size={20} className="text-blue-600" />}
                        />
                        <MetricCard
                            title="Check-in Rate"
                            value={`${((attendanceData.totalCheckins / (attendanceData.totalBookings || 1)) * 100).toFixed(0)}%`}
                            subtext={`${attendanceData.totalCheckins} Checked-in`}
                            icon={<CheckCircle2 size={20} className="text-green-600" />}
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-6">Attendance Trends</h3>
                    <div className="h-80 w-full">
                        <Suspense fallback={<div className="h-full w-full bg-zinc-50 dark:bg-zinc-800/50 animate-pulse rounded-lg" />}>
                            <AttendanceChart data={attendanceData?.chartData} />
                        </Suspense>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
                    <h3 className="text-lg font-semibold mb-6">Top Classes</h3>
                    {attendanceData?.topClasses && (
                        <div className="space-y-4">
                            {attendanceData.topClasses.map((c: any, i: number) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm font-medium truncate max-w-[180px]">{c.title}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${Math.min((c.attendees / 50) * 100, 100)}%` }} />
                                        </div>
                                        <span className="text-xs text-zinc-500 w-6 text-right">{c.attendees}</span>
                                    </div>
                                </div>
                            ))}
                            {attendanceData.topClasses.length === 0 && <div className="text-center text-sm text-zinc-500 py-8">No data available</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
