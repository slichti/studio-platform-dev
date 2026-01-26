// @ts-ignore
import { useLoaderData, useOutletContext, redirect } from "react-router"; // @ts-ignore
import type { LoaderFunctionArgs } from "react-router"; // @ts-ignore
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie } from 'recharts';
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    if (!userId) {
        return redirect(`/sign-in?redirect_url=${new URL(args.request.url).pathname}`);
    }

    try {
        const [utilization, retention, ltv] = await Promise.all([
            apiRequest(`/analytics/utilization`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => []),
            apiRequest(`/analytics/retention`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => []),
            apiRequest(`/analytics/ltv`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => ({ averageLtv: 0, trend: 0, sources: { packs: 0, pos: 0 } }))
        ]);

        return { utilization, retention, ltv };
    } catch (e) {
        console.error("Analytics Loader Error:", e);
        return { utilization: [], retention: [], ltv: { averageLtv: 0, trend: 0, sources: { packs: 0, pos: 0 } } };
    }
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdvancedReports() {
    const data = useLoaderData<typeof loader>();
    const { utilization, retention, ltv } = data || { utilization: [], retention: [], ltv: { averageLtv: 0, trend: 0, sources: { packs: 0, pos: 0 } } };
    const { tenant } = useOutletContext<any>();
    const currency = tenant?.currency?.toUpperCase() || 'USD';

    // Process Heatmap Data
    // utilization is { day: 0-6, hour: 0-23, bookingCount: number }
    const getHeatmapValue = (dayIndex: number, hourIndex: number) => {
        const found = utilization.find((u: any) => parseInt(u.day) === dayIndex && parseInt(u.hour) === hourIndex);
        return found ? found.bookingCount : 0;
    };

    // Find max for color scaling
    const maxHeat = Math.max(...(utilization.map((u: any) => u.bookingCount) || [0]), 1);

    const getHeatColor = (value: number) => {
        if (value === 0) return 'bg-zinc-50 dark:bg-zinc-900';
        const intensity = value / maxHeat;
        if (intensity < 0.25) return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300';
        if (intensity < 0.5) return 'bg-indigo-300 dark:bg-indigo-700/60 text-indigo-900 dark:text-indigo-100';
        if (intensity < 0.75) return 'bg-indigo-500 text-white';
        return 'bg-indigo-700 text-white';
    };

    const ltvDetails = [
        { name: 'Class Packs', value: ltv?.sources?.packs || 0, fill: '#4F46E5' },
        { name: 'Retail / POS', value: ltv?.sources?.pos || 0, fill: '#10B981' },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Advanced Analytics</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Deep dive into studio performance and retention.</p>
            </div>

            {/* LTV & Revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm col-span-1">
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Average Lifetime Value</h3>
                    <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(ltv.averageLtv)}
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm col-span-2 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Revenue Sources</h3>
                        <div className="flex gap-6">
                            <div>
                                <p className="text-xs text-zinc-500">Class Packs</p>
                                <p className="text-xl font-bold text-indigo-600">{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(ltv.sources?.packs || 0)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500">Retail / POS</p>
                                <p className="text-xl font-bold text-emerald-500">{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(ltv.sources?.pos || 0)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-24 w-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={ltvDetails} dataKey="value" innerRadius={25} outerRadius={40} paddingAngle={5} />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Cohort Analysis */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-6">Member Retention by Cohort</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={retention} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E5" />
                            <XAxis dataKey="month" stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: '#F4F4F5' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            <Bar dataKey="total" name="New Members" fill="#E4E4E7" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="retained" name="Retained Active" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Utilization Heatmap */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-6">Class Utilization Heatmap</h3>

                <div className="min-w-[800px]">
                    <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-1">
                        {/* Hour Headers */}
                        <div className="h-8 w-16" /> {/* Corner Spacer */}
                        {Array.from({ length: 24 }).map((_, h) => (
                            <div key={`h-${h}`} className="h-8 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                                {h}
                            </div>
                        ))}

                        {/* Rows */}
                        {DAYS.map((day, d) => (
                            <>
                                <div key={`d-${d}`} className="h-10 flex items-center pr-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                    {day}
                                </div>
                                {Array.from({ length: 24 }).map((_, h) => {
                                    const val = getHeatmapValue(d, h); // d is 0-6 (Sun-Sat) matches API
                                    return (
                                        <div
                                            key={`${d}-${h}`}
                                            title={`${day} @ ${h}:00 - ${val} bookings`}
                                            className={`h-10 rounded-md flex items-center justify-center text-xs font-medium transition-all hover:scale-110 ${getHeatColor(val)}`}
                                        >
                                            {val > 0 ? val : ''}
                                        </div>
                                    );
                                })}
                            </>
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 text-xs text-zinc-500">
                    <span>Less Busy</span>
                    <div className="flex gap-1">
                        <div className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/40" />
                        <div className="w-4 h-4 rounded bg-indigo-300 dark:bg-indigo-700/60" />
                        <div className="w-4 h-4 rounded bg-indigo-500" />
                        <div className="w-4 h-4 rounded bg-indigo-700" />
                    </div>
                    <span>More Busy</span>
                </div>
            </section>
        </div>
    );
}
