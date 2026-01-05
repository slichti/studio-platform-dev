// @ts-ignore
import { useOutletContext } from "react-router";
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
import { Loader2, DollarSign, Users, TrendingUp } from "lucide-react";

export default function StudioReports() {
    const { tenant } = useOutletContext<any>();
    const [activeTab, setActiveTab] = useState<'financials' | 'attendance'>('financials');
    const [loading, setLoading] = useState(true);
    const [revenueData, setRevenueData] = useState<any>(null);
    const [attendanceData, setAttendanceData] = useState<any>(null);
    const [dateRange, setDateRange] = useState('30d'); // 30d, 90d, 1y

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
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {activeTab === 'financials' && revenueData && (
                    <>
                        <MetricCard
                            title="Gross Volume (Period)"
                            value={`$${(revenueData.grossVolume / 100).toFixed(2)}`}
                            icon={<DollarSign size={20} className="text-green-500" />}
                        />
                        <MetricCard
                            title="Monthly Recurring Revenue"
                            value={`$${(revenueData.mrr / 100).toFixed(2)}`}
                            subtext="Active subscriptions snapshot"
                            icon={<TrendingUp size={20} className="text-blue-500" />}
                        />
                        <MetricCard
                            title="Sales Breakdown"
                            value={`${((revenueData.breakdown.retail / (revenueData.grossVolume || 1)) * 100).toFixed(0)}% Retail`}
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
                            icon={<CheckCircle2 size={20} className="text-green-500" />} // Imported below or fix import
                        />
                        {/* More cards... */}
                    </>
                )}
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">
                        {activeTab === 'financials' ? 'Revenue Trends' : 'Attendance Trends'}
                    </h3>
                    <div className="h-80 w-full flex items-center justify-center text-zinc-400 text-sm">
                        {/* Placeholder for actual time-series chart. 
                            The backend currently returns aggregate totals. 
                            We need to update backend to return time-series data for this chart to work fully.
                            For now, rendering a static demo chart to show UI structure.
                        */}
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getDemoData(activeTab)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#EFF6FF" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">
                        {activeTab === 'financials' ? 'Top Selling' : 'Top Classes'}
                    </h3>
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
                        </div>
                    )}
                    {activeTab === 'financials' && (
                        <div className="text-sm text-zinc-500 italic text-center py-10">
                            Sales breakdown coming soon.
                        </div>
                    )}
                </div>
            </div>
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
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</h3>
                {subtext && <p className="text-xs text-zinc-500 mt-2">{subtext}</p>}
            </div>
        </div>
    );
}



function getDemoData(tab: string) {
    if (tab === 'financials') {
        return [
            { name: 'Week 1', value: 4000 },
            { name: 'Week 2', value: 3000 },
            { name: 'Week 3', value: 2000 },
            { name: 'Week 4', value: 2780 },
        ];
    }
    return [
        { name: 'Mon', value: 24 },
        { name: 'Tue', value: 13 },
        { name: 'Wed', value: 98 },
        { name: 'Thu', value: 39 },
        { name: 'Fri', value: 48 },
        { name: 'Sat', value: 38 },
        { name: 'Sun', value: 43 },
    ];
}
