
import { useOutletContext, Link, useParams } from "react-router";
import { useState, useEffect } from "react";
import { apiRequest } from "../utils/api";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Loader2, Plus, Save, Trash2, Filter, BarChart3 } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

export default function CustomReports() {
    const { tenant } = useOutletContext<any>() || {};
    const { slug } = useParams();
    const [savedReports, setSavedReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Query State
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['revenue']);
    const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['date']);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [instructorId, setInstructorId] = useState('');

    // Result State
    const [activeResult, setActiveResult] = useState<any>(null);
    const [reportName, setReportName] = useState('');
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadSavedReports();
        // Set default dates (last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    }, []);

    const loadSavedReports = async () => {
        const token = await (window as any).Clerk?.session?.getToken();
        try {
            const res = await apiRequest('/reports/custom', token);
            setSavedReports(res.reports || []);
        } catch (e) {
            console.error("Failed to load reports", e);
        }
    };

    const runQuery = async () => {
        setLoading(true);
        const token = await (window as any).Clerk?.session?.getToken();
        try {
            const res = await apiRequest('/reports/custom/query', token, {
                method: 'POST',
                body: JSON.stringify({
                    metrics: selectedMetrics,
                    dimensions: selectedDimensions,
                    filters: {
                        startDate: dateRange.start,
                        endDate: dateRange.end,
                        instructorId: instructorId || undefined
                    }
                })
            });
            setActiveResult(res);
        } catch (e) {
            console.error(e);
            alert("Query failed");
        } finally {
            setLoading(false);
        }
    };

    const saveReport = async () => {
        if (!reportName) return alert("Enter a name");
        const token = await (window as any).Clerk?.session?.getToken();
        try {
            await apiRequest('/reports/custom', token, {
                method: 'POST',
                body: JSON.stringify({
                    name: reportName,
                    config: {
                        metrics: selectedMetrics,
                        dimensions: selectedDimensions,
                        filters: {
                            startDate: dateRange.start,
                            endDate: dateRange.end, // Store absolute or relative? simplified absolute for now
                            instructorId
                        }
                    }
                })
            });
            setReportName('');
            loadSavedReports();
        } catch (e) {
            console.error(e);
        }
    };

    const loadReportConfig = (report: any) => {
        const config = report.config;
        if (config.metrics) setSelectedMetrics(config.metrics);
        if (config.dimensions) setSelectedDimensions(config.dimensions);
        // Dates might be stale if hardcoded, but strictly loading exact config
        // Ideally we support "last 30 days" relative string in config.
        if (config.filters) {
            setDateRange({
                start: config.filters.startDate ? new Date(config.filters.startDate).toISOString().split('T')[0] : '',
                end: config.filters.endDate ? new Date(config.filters.endDate).toISOString().split('T')[0] : ''
            });
            setInstructorId(config.filters.instructorId || '');
        }
    };

    const deleteReport = (id: string, e: any) => {
        e.stopPropagation();
        setReportToDelete(id);
    };

    const confirmDeleteReport = async () => {
        if (!reportToDelete) return;
        const token = await (window as any).Clerk?.session?.getToken();
        await apiRequest(`/reports/custom/${reportToDelete}`, token, { method: 'DELETE' });
        loadSavedReports();
        setReportToDelete(null);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                        <Link to={`/studio/${slug}/reports`} className="hover:underline">Analytics</Link>
                        <span>/</span>
                        <span>Custom Query</span>
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Custom Report Builder</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar: Controls & Saved */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Filter size={16} /> Query Options
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-zinc-500 uppercase mb-2 block">Metrics</label>
                                <div className="space-y-2">
                                    {['revenue', 'attendance'].map(m => (
                                        <label key={m} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedMetrics.includes(m)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedMetrics([...selectedMetrics, m]);
                                                    else setSelectedMetrics(selectedMetrics.filter(x => x !== m));
                                                }}
                                                className="rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="capitalize">{m}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-zinc-500 uppercase mb-2 block">Group By</label>
                                <div className="space-y-2">
                                    {['date', 'instructor'].map(d => (
                                        <label key={d} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedDimensions.includes(d)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedDimensions([...selectedDimensions, d]);
                                                    else setSelectedDimensions(selectedDimensions.filter(x => x !== d));
                                                }}
                                            />
                                            <span className="capitalize">{d}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-zinc-500 uppercase mb-2 block">Date Range</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="w-full text-xs p-2 rounded border dark:bg-zinc-800 dark:border-zinc-700" />
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="w-full text-xs p-2 rounded border dark:bg-zinc-800 dark:border-zinc-700" />
                                </div>
                            </div>

                            <button
                                onClick={runQuery}
                                disabled={loading}
                                className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 flex justify-center items-center gap-2"
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                Run Query
                            </button>
                        </div>
                    </div>

                    {/* Saved Reports */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-semibold mb-4 text-sm">Saved Reports</h3>
                        <div className="space-y-2">
                            {savedReports.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => loadReportConfig(r)}
                                    className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 group flex justify-between items-center"
                                >
                                    <span className="text-sm font-medium">{r.name}</span>
                                    <button onClick={(e) => deleteReport(r.id, e)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                            {savedReports.length === 0 && <p className="text-xs text-zinc-500">No saved reports.</p>}
                        </div>
                    </div>
                </div>

                {/* Main Content: Visualization */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Actions Bar */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h2 className="font-semibold text-lg">Results</h2>
                            {activeResult && (
                                <div className="flex gap-4 text-sm text-zinc-500">
                                    {activeResult.summary.revenue !== undefined && <span>Revenue: <b>${activeResult.summary.revenue.toFixed(2)}</b></span>}
                                    {activeResult.summary.attendance !== undefined && <span>Attendance: <b>{activeResult.summary.attendance}</b></span>}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Report Name"
                                value={reportName}
                                onChange={e => setReportName(e.target.value)}
                                className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
                            />
                            <button onClick={saveReport} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded text-sm font-medium">
                                <Save size={14} /> Save
                            </button>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[400px]">
                        {activeResult && activeResult.chartData && activeResult.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={activeResult.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#71717A', fontSize: 12 }}
                                        dy={10}
                                        tickFormatter={val => val.length > 10 ? new Date(val).toLocaleDateString() : val}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    {selectedMetrics.includes('revenue') && <Bar dataKey="revenue" fill="#3B82F6" name="Revenue ($)" radius={[4, 4, 0, 0]} />}
                                    {selectedMetrics.includes('attendance') && <Bar dataKey="attendance" fill="#10B981" name="Attendance" radius={[4, 4, 0, 0]} />}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                <BarChart3 size={48} className="mb-4 opacity-50" />
                                <p>Run a query to see results</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>

            <ConfirmDialog
                open={!!reportToDelete}
                onOpenChange={(open) => !open && setReportToDelete(null)}
                onConfirm={confirmDeleteReport}
                title="Delete Report"
                description="Are you sure you want to delete this saved report?"
                confirmText="Delete"
                variant="destructive"
            />
        </div >
    );
}
