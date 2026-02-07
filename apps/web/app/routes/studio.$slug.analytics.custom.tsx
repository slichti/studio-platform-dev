import { useState, useEffect } from "react";
import { useOutletContext } from "react-router";
import { apiRequest } from "~/utils/api";
import {
    BarChart3, Calendar, Filter, Download, Save,
    RefreshCw, Layers, DollarSign, Users, UserPlus
} from "lucide-react";
import { MetricCard } from "~/components/charts/MetricCard";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, LineChart, Line
} from "recharts";
import { format, subDays } from "date-fns";

// Ensure context matches Layout
import { DateRange } from "~/hooks/useAnalytics";

export default function AnalyticsCustom() {
    const { tenant } = useOutletContext<{ tenant: any, dateRange: DateRange, shouldBlur: boolean }>();

    // Local state for builder
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [savedReports, setSavedReports] = useState<any[]>([]);

    // Builder State
    const METRIC_OPTIONS = [
        { id: 'revenue', label: 'Revenue' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'new_signups', label: 'New Signups' },
    ];
    const [metrics, setMetrics] = useState<string[]>(['revenue']);
    const [dimensions, setDimensions] = useState<string[]>(['date']);
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [filters, setFilters] = useState<any>({});

    const handleExport = async () => {
        try {
            const res = await apiRequest('/reports/custom/query', null, {
                method: 'POST',
                body: JSON.stringify({
                    metrics,
                    dimensions,
                    filters: {
                        startDate: dateRange.start,
                        endDate: dateRange.end,
                        ...filters
                    },
                    format: 'csv'
                }),
                headers: { 'X-Tenant-Slug': tenant?.slug }
            });

            const blob = new Blob([res], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            console.error("Export failed", e);
        }
    };

    // Load Saved Reports on Mount
    useEffect(() => {
        loadSavedReports();
    }, []);

    const loadSavedReports = async () => {
        try {
            // Note: Reuse existing endpoint
            const res = await apiRequest('/reports/custom', null, {
                headers: { 'X-Tenant-Slug': tenant?.slug }
            });
            if (res.reports) setSavedReports(res.reports);
        } catch (e) {
            console.error("Failed to load saved reports", e);
        }
    };

    const runQuery = async () => {
        setIsLoading(true);
        try {
            const payload = {
                metrics,
                dimensions,
                filters: {
                    startDate: dateRange.start,
                    endDate: dateRange.end,
                    ...filters
                }
            };

            const res = await apiRequest('/reports/custom/query', null, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'X-Tenant-Slug': tenant?.slug }
            });

            setReportData(res);
        } catch (e) {
            console.error("Query failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveReport = async (name: string) => {
        try {
            await apiRequest('/reports/custom', null, {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    config: { metrics, dimensions, dateRange, filters },
                    isPublic: false
                }),
                headers: { 'X-Tenant-Slug': tenant?.slug }
            });
            loadSavedReports();
            return true;
        } catch (e) {
            return false;
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                        <BarChart3 className="text-blue-600" size={20} />
                        Custom Report Builder
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        Design ad-hoc queries and analyze studio performance.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* CONFIGURATION PANEL */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 text-sm">
                            <Layers size={16} /> Metrics
                        </h3>
                        <div className="space-y-2">
                            {METRIC_OPTIONS.map(opt => (
                                <label key={opt.id} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={metrics.includes(opt.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setMetrics([...metrics, opt.id]);
                                            else setMetrics(metrics.filter(x => x !== opt.id));
                                        }}
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="capitalize">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 text-sm">
                            <Filter size={16} /> Dimensions
                        </h3>
                        <div className="space-y-2">
                            {['date', 'instructor', 'payment_method'].map(d => (
                                <label key={d} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={dimensions.includes(d)}
                                        onChange={(e) => {
                                            if (e.target.checked) setDimensions([...dimensions, d]);
                                            else setDimensions(dimensions.filter(x => x !== d));
                                        }}
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="capitalize">{d.replace('_', ' ')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 text-sm">
                            <Calendar size={16} /> Date Range (Custom)
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Start Date</label>
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">End Date</label>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={runQuery}
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" size={18} /> : "Run Report"}
                    </button>

                    {savedReports.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Saved Reports</h4>
                            <ul className="space-y-2">
                                {savedReports.map((r: any) => (
                                    <li key={r.id} className="text-sm">
                                        <button
                                            onClick={() => {
                                                const c = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
                                                setMetrics(c.metrics || []);
                                                setDimensions(c.dimensions || []);
                                                if (c.dateRange) setDateRange(c.dateRange);
                                            }}
                                            className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left block w-full truncate"
                                        >
                                            {r.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* RESULTS PANEL */}
                <div className="lg:col-span-3 space-y-6">
                    {!reportData ? (
                        <div className="h-96 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <BarChart3 size={48} className="mb-4 opacity-50" />
                            <p className="font-medium">Configure metrics and run query to see results</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {metrics.includes('revenue') && (
                                    <MetricCard
                                        title="Total Revenue"
                                        value={`$${reportData.summary?.revenue?.toFixed(2) || '0.00'}`}
                                        icon={<DollarSign size={20} className="text-blue-500" />}
                                    />
                                )}
                                {metrics.includes('attendance') && (
                                    <MetricCard
                                        title="Total Attendance"
                                        value={reportData.summary?.attendance || 0}
                                        icon={<Users size={20} className="text-emerald-500" />}
                                    />
                                )}
                                {metrics.includes('new_signups') && (
                                    <MetricCard
                                        title="New Signups"
                                        value={reportData.summary?.new_signups || 0}
                                        icon={<UserPlus size={20} className="text-amber-500" />}
                                    />
                                )}
                            </div>

                            {/* Chart Area */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm h-[450px]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Visualization</h3>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                        <button
                                            onClick={() => setChartType('bar')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartType === 'bar' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                                        >
                                            Bar
                                        </button>
                                        <button
                                            onClick={() => setChartType('line')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartType === 'line' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                                        >
                                            Line
                                        </button>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height="90%">
                                    {chartType === 'bar' ? (
                                        <BarChart data={reportData.chartData}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                tickFormatter={(val) => metrics.includes('revenue') && val > 100 ? `$${val}` : val}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                            />
                                            <Legend />
                                            {metrics.includes('revenue') && <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} name="Revenue ($)" />}
                                            {metrics.includes('attendance') && <Bar dataKey="attendance" fill="#059669" radius={[4, 4, 0, 0]} name="Attendance" />}
                                            {metrics.includes('new_signups') && <Bar dataKey="new_signups" fill="#F59E0B" radius={[4, 4, 0, 0]} name="New Signups" />}
                                        </BarChart>
                                    ) : (
                                        <LineChart data={reportData.chartData}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#71717a', fontSize: 12 }}
                                                tickFormatter={(val) => metrics.includes('revenue') && val > 100 ? `$${val}` : val}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend />
                                            {metrics.includes('revenue') && <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Revenue ($)" />}
                                            {metrics.includes('attendance') && <Line type="monotone" dataKey="attendance" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Attendance" />}
                                            {metrics.includes('new_signups') && <Line type="monotone" dataKey="new_signups" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="New Signups" />}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>

                            {/* Data Table */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Raw Data</h3>
                                    <button
                                        onClick={handleExport}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Download size={14} /> Export CSV
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/50">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Dimension</th>
                                                {metrics.includes('revenue') && <th className="px-6 py-3 font-medium">Revenue</th>}
                                                {metrics.includes('attendance') && <th className="px-6 py-3 font-medium">Attendance</th>}
                                                {metrics.includes('new_signups') && <th className="px-6 py-3 font-medium">New Signups</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {reportData.chartData.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{row.name}</td>
                                                    {metrics.includes('revenue') && <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">${row.revenue?.toFixed(2)}</td>}
                                                    {metrics.includes('attendance') && <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{row.attendance}</td>}
                                                    {metrics.includes('new_signups') && <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{row.new_signups}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Save Actions */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        const name = prompt("Enter report name:");
                                        if (name) saveReport(name);
                                    }}
                                    className="px-6 py-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Save size={16} /> Save Configuration
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
