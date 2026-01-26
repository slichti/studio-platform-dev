import { BarChart3, TrendingUp, Users, ArrowRight } from "lucide-react";
import { Link, useOutletContext } from "react-router";

export default function DocumentationAnalytics() {
    const { user } = useOutletContext<any>();
    const tenantSlug = user?.tenants?.[0]?.slug;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Advanced Analytics</h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl mb-4">
                    Gain deeper insights into your studio's performance with Cohort Analysis, Lifetime Value (LTV) tracking, and Utilization Heatmaps.
                </p>
                {tenantSlug && (
                    <Link
                        to={`/studio/${tenantSlug}/analytics`}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        View your Analytics <ArrowRight size={16} />
                    </Link>
                )}
            </div>

            <section className="space-y-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <BarChart3 className="text-blue-500" /> Key Metrics
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <Users size={18} /> Cohort Retention
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Visualize how many new students from a specific month are still active today. This helps you measure the long-term impact of marketing campaigns.
                        </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <TrendingUp size={18} /> Lifetime Value (LTV)
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Track the average revenue generated per student over their lifetime. A rising LTV indicates successful retention and upsell strategies.
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Utilization Heatmap</h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                    The Heatmap grid shows your most popular times at a glance. Darker blue squares indicate high-occupancy slots, while lighter areas suggest opportunities to add classes or run promotions.
                </p>
            </section>
        </div>
    );
}
