// @ts-ignore
import { useOutletContext } from "react-router";
import { ProjectionsCalculator } from "../components/ProjectionsCalculator";
import { useState, useEffect } from "react";
import { apiRequest } from "../utils/api";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area
} from 'recharts';
import { Loader2, DollarSign, Users, TrendingUp, CheckCircle2 } from "lucide-react";
import { PrivacyBlur } from "../components/PrivacyBlur";
import { useAdminPrivacy } from "../hooks/useAdminPrivacy";

export default function StudioReports() {
    const { tenant } = useOutletContext<any>();
    const [activeTab, setActiveTab] = useState<'financials' | 'attendance' | 'projections'>('financials');
    const [loading, setLoading] = useState(true);
    const [revenueData, setRevenueData] = useState<any>(null);
    const [attendanceData, setAttendanceData] = useState<any>(null);
    const [dateRange, setDateRange] = useState('30d'); // 30d, 90d, 1y

    // Privacy Logic
    const [impersonating, setImpersonating] = useState(false);
    useEffect(() => {
        setImpersonating(!!localStorage.getItem('impersonation_token'));
    }, []);

    const { isPrivacyMode } = useAdminPrivacy();
    // Blur if impersonating AND privacy mode is active
    const shouldBlur = impersonating && isPrivacyMode;

    useEffect(() => {
        fetchData();
    }, [activeTab, dateRange]);

    const fetchData = async () => {
        setLoading(true);
        // Calculate dates
        const end = new Date();
        const start = new Date();
        if (dateRange === '30d') start.setDate(end.getDate() - 30);
        if (dateRange === '90d') start.setDate(end.getDate() - 90);
        if (dateRange === '1y') start.setFullYear(end.getFullYear() - 1);

        const token = await (window as any).Clerk?.session?.getToken(); // Fallback if context missing

        try {
            if (activeTab === 'financials') {
                const res = await apiRequest(`/reports/revenue?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, token);
                setRevenueData(res);
            } else {
                const res = await apiRequest(`/reports/attendance?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, token);
                setAttendanceData(res);
            }
        } catch (e) {
            console.error("Failed to fetch report data", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !revenueData && !attendanceData) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Analytics</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Performance metrics and insights.</p>
                </div>
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

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {activeTab === 'financials' && revenueData && (
                    <>
                        <MetricCard
                            title="Gross Volume (Period)"
                            value={<PrivacyBlur revealed={!shouldBlur} placeholder="***">{`$${(revenueData.grossVolume / 100).toFixed(2)}`}</PrivacyBlur>}
                            icon={<DollarSign size={20} className="text-green-500" />}
                        />
                        <MetricCard
                            title="Monthly Recurring Revenue"
                            value={<PrivacyBlur revealed={!shouldBlur} placeholder="***">{`$${(revenueData.mrr / 100).toFixed(2)}`}</PrivacyBlur>}
                            subtext="Active subscriptions snapshot"
                            icon={<TrendingUp size={20} className="text-blue-500" />}
                        />
                        <MetricCard
                            title="Sales Breakdown"
                            value={<PrivacyBlur revealed={!shouldBlur} placeholder="***">{`${((revenueData.breakdown.retail / (revenueData.grossVolume || 1)) * 100).toFixed(0)}% Retail`}</PrivacyBlur>}
                            subtext={`$${(revenueData.breakdown.packs / 100).toFixed(0)} Packs`}
                            icon={<DollarSign size={20} className="text-purple-500" />}
                        />
                    </>
                )}
                {activeTab === 'attendance' && attendanceData && (
                    <>
                        <MetricCard
                            title="Total Bookings"
                            value={attendanceData.totalBookings}
                            icon={<Users size={20} className="text-blue-500" />}
                        />
                        <MetricCard
                            title="Check-in Rate"
                            value={`${((attendanceData.totalCheckins / (attendanceData.totalBookings || 1)) * 100).toFixed(0)}%`}
                            subtext={`${attendanceData.totalCheckins} Checked-in`}
                            icon={<CheckCircle2 size={20} className="text-green-500" />}
                        />
                    </>
                )}
            </div>

            {/* Content Area */}
            {activeTab === 'projections' ? (
                <ProjectionsCalculator />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
                        <h3 className="text-lg font-semibold mb-6">
                            {activeTab === 'financials' ? 'Revenue Trends' : 'Attendance Trends'}
                        </h3>

                        {shouldBlur && activeTab === 'financials' && (
                            <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center rounded-xl">
                                <div className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-lg shadow lg text-sm font-medium">Privacy Mode Enabled</div>
                            </div>
                        )}

                        <div className="h-80 w-full flex items-center justify-center text-zinc-400 text-sm">
                            {activeTab === 'financials' && revenueData?.chartData ? (
                                isEmpty(revenueData.chartData) ? (
                                    <div className="text-center">
                                        <div className="mb-2">No revenue data for this period</div>
                                        <div className="text-xs text-zinc-500">Record sales in POS to see trends</div>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={revenueData.chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} dy={10}
                                                tickFormatter={(val) => formatDate(val)}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                                                labelFormatter={(l) => new Date(l).toLocaleDateString()}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#EFF6FF" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )
                            ) : null}

                            {activeTab === 'attendance' && attendanceData?.chartData ? (
                                isEmpty(attendanceData.chartData) ? (
                                    <div className="text-center">
                                        <div className="mb-2">No attendance data for this period</div>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={attendanceData.chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} dy={10}
                                                tickFormatter={(val) => formatDate(val)}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [value, 'Attendees']}
                                                labelFormatter={(l) => new Date(l).toLocaleDateString()}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="#10B981" fill="#ECFDF5" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )
                            ) : null}
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
                        {activeTab === 'financials' && (
                            <div className="text-sm text-zinc-500 italic text-center py-10">
                                Sales breakdown coming soon.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ title, value, subtext, icon }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    {icon}
                </div>
                {/* Percent change could go here */}
            </div>
            <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">{title}</p>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
                {subtext && <p className="text-xs text-zinc-500 mt-2">{subtext}</p>}
            </div>
        </div>
    );
}

function isEmpty(data: any[]) {
    if (!data || data.length === 0) return true;
    return data.every(d => d.value === 0);
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
