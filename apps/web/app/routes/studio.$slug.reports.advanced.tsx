import { useOutletContext, useParams } from "react-router";
import { useLTV, useRetention, useUtilization } from "~/hooks/useAnalytics";
import { useEffect, useState } from 'react';
import { RetentionChart } from "~/components/charts/RetentionChart.client";
import { UtilizationHeatmap } from "~/components/charts/UtilizationHeatmap.client";
import { Loader2 } from "lucide-react";

export default function AdvancedReports() {
    const { slug } = useParams();
    const { tenant } = useOutletContext<any>();
    const currency = tenant?.currency?.toUpperCase() || 'USD';
    const [Recharts, setRecharts] = useState<any>(null);

    useEffect(() => {
        import('recharts').then(mod => setRecharts(mod));
    }, []);

    if (!slug) return <div>Invalid slug</div>;

    const { data: ltv } = useLTV(slug);
    const { data: retention } = useRetention(slug);
    const { data: utilization } = useUtilization(slug);

    if (!ltv || !retention || !utilization || !Recharts) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;
    }

    const { ResponsiveContainer, PieChart, Pie, Tooltip } = Recharts;

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
                    <RetentionChart data={retention} />
                </div>
            </section>

            {/* Utilization Heatmap */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-6">Class Utilization Heatmap</h3>
                <UtilizationHeatmap data={utilization} />
            </section>
        </div>
    );
}
