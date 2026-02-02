import { useOutletContext, Link } from "react-router";
import { useState, useEffect } from "react";
import { Loader2, DollarSign, Users, TrendingUp, CheckCircle2, Download, Calendar, Mail, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/react-router";

import { useRevenue, useAttendance, useRetention, useReportSchedules, useReportScheduleMutations, DateRange } from "~/hooks/useAnalytics";
import { useAdminPrivacy } from "~/hooks/useAdminPrivacy";
import { MetricCard } from "~/components/charts/MetricCard";
import { RevenueChart } from "~/components/charts/RevenueChart";
import { AttendanceChart } from "~/components/charts/AttendanceChart";
import { PrivacyBlur } from "~/components/PrivacyBlur";
import { ProjectionsCalculator } from "~/components/ProjectionsCalculator";

export default function StudioReports() {
    const { tenant } = useOutletContext<any>();
    const { getToken } = useAuth();

    const [activeTab, setActiveTab] = useState<'financials' | 'attendance' | 'projections'>('financials');
    const [dateRange, setDateRange] = useState<DateRange>('30d');
    const [exporting, setExporting] = useState(false);
    const [showSchedules, setShowSchedules] = useState(false);

    // Hooks
    const { data: revenueData, isLoading: loadingRevenue } = useRevenue(tenant.slug, dateRange);
    const { data: attendanceData, isLoading: loadingAttendance } = useAttendance(tenant.slug, dateRange);
    const { data: retentionData } = useRetention(tenant.slug);
    const { data: schedules = [] } = useReportSchedules(tenant.slug);
    const { createMutation: createSchedule, deleteMutation: deleteSchedule } = useReportScheduleMutations(tenant.slug);

    // Schedule Form
    const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
    const [newSchedule, setNewSchedule] = useState({ reportType: 'revenue', frequency: 'weekly', recipients: '' });

    // Privacy Logic
    const [impersonating, setImpersonating] = useState(false);
    useEffect(() => {
        setImpersonating(!!localStorage.getItem('impersonation_token'));
    }, []);
    const { isPrivacyMode } = useAdminPrivacy();
    const shouldBlur = impersonating && isPrivacyMode;

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingSchedule(true);
        try {
            const recipients = newSchedule.recipients.split(',').map(r => r.trim()).filter(r => !!r);
            await createSchedule.mutateAsync({ ...newSchedule, recipients });
            toast.success("Schedule created");
            setNewSchedule({ reportType: 'revenue', frequency: 'weekly', recipients: '' });
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsCreatingSchedule(false);
        }
    };

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

    if (loadingRevenue || loadingAttendance) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Analytics</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Performance metrics and insights.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportJournal}
                        disabled={exporting}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white shadow hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Download size={16} />
                        {exporting ? 'Exporting...' : 'Export Journal'}
                    </button>
                    <Link
                        to="custom"
                        className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow hover:opacity-90 transition-opacity"
                    >
                        Custom Query
                    </Link>
                    <Link
                        to="advanced"
                        className="ml-2 px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors"
                    >
                        Advanced
                    </Link>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('financials')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'financials' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                        >
                            Financials
                        </button>
                        <button
                            onClick={() => setActiveTab('attendance')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'attendance' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                        >
                            Attendance
                        </button>
                        <button
                            onClick={() => setActiveTab('projections')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'projections' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                        >
                            Projections
                        </button>
                    </div>
                </div>
            </div>

            {/* Scheduled Reports Management Card */}
            <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/20 p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                            <Calendar className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Scheduled Reports</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Automated summaries delivered to your inbox.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSchedules(!showSchedules)}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        {showSchedules ? 'Hide Management' : 'Manage Schedules'}
                    </button>
                </div>

                {showSchedules && (
                    <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Create Schedule Form */}
                            <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <h4 className="font-semibold mb-4 text-sm flex items-center gap-2">
                                    <Plus size={16} /> New Schedule
                                </h4>
                                <form onSubmit={handleCreateSchedule} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Report Type</label>
                                            <select
                                                value={newSchedule.reportType}
                                                onChange={e => setNewSchedule({ ...newSchedule, reportType: e.target.value })}
                                                className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                            >
                                                <option value="revenue">Revenue</option>
                                                <option value="attendance">Attendance</option>
                                                <option value="journal">Journal</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Frequency</label>
                                            <select
                                                value={newSchedule.frequency}
                                                onChange={e => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                                                className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Recipients (comma separated)</label>
                                        <input
                                            placeholder="owner@example.com, manager@example.com"
                                            value={newSchedule.recipients}
                                            onChange={e => setNewSchedule({ ...newSchedule, recipients: e.target.value })}
                                            className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isCreatingSchedule}
                                        className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        {isCreatingSchedule ? 'Creating...' : 'Create Email Schedule'}
                                    </button>
                                </form>
                            </div>

                            {/* Existing Schedules */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Active Schedules</h4>
                                {schedules.length === 0 ? (
                                    <div className="text-zinc-400 text-sm italic py-8 text-center border-2 border-dashed rounded-lg">No schedules configured.</div>
                                ) : (
                                    schedules.map((s: any) => (
                                        <div key={s.id} className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-blue-600">
                                                    <Mail size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold capitalize">{s.reportType} {s.frequency}</div>
                                                    <div className="text-xs text-zinc-500 truncate max-w-[200px]">{s.recipients.join(', ')}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    deleteSchedule.mutate(s.id);
                                                    toast.success("Schedule deleted");
                                                }}
                                                className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {activeTab === 'financials' && revenueData && (
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
                        {retentionData && (
                            <MetricCard
                                title="Member Retention"
                                value={`${retentionData.retentionRate.toFixed(1)}%`}
                                subtext={`-${retentionData.churnCount} Churned / +${retentionData.newCount} New`}
                                icon={<Users size={20} className="text-pink-600" />}
                            />
                        )}
                    </>
                )}
                {activeTab === 'attendance' && attendanceData && (
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

            {/* Content Area */}
            {activeTab === 'projections' ? (
                <ProjectionsCalculator />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative min-h-[400px]">
                        <h3 className="text-lg font-semibold mb-6">
                            {activeTab === 'financials' ? 'Revenue Trends' : 'Attendance Trends'}
                        </h3>

                        {shouldBlur && activeTab === 'financials' && (
                            <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center rounded-xl">
                                <div className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-lg shadow lg text-sm font-medium">Privacy Mode Enabled</div>
                            </div>
                        )}

                        <div className="h-80 w-full">
                            {activeTab === 'financials' && <RevenueChart data={revenueData?.chartData} />}
                            {activeTab === 'attendance' && <AttendanceChart data={attendanceData?.chartData} />}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
                        <h3 className="text-lg font-semibold mb-6">
                            {activeTab === 'financials' ? 'Top Selling' : 'Top Classes'}
                        </h3>

                        {shouldBlur && activeTab === 'financials' && (
                            <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center rounded-xl">
                                {/* No text needed, just blur */}
                            </div>
                        )}

                        {activeTab === 'attendance' && attendanceData?.topClasses && (
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
                        {activeTab === 'financials' && revenueData?.breakdown && (
                            <div className="space-y-4">
                                {Object.entries(revenueData.breakdown).map(([key, value]: [string, any]) => {
                                    const val = Number(value);
                                    if (val === 0) return null; // Skip empty
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
            )}
        </div>
    );
}
