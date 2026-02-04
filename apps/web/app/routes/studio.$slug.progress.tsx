import { useState, useEffect } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import { apiRequest } from "~/utils/api";
import { Loader2, Flame, Calendar, Clock, Trophy, TrendingUp, Award, Dumbbell, Heart } from "lucide-react";

// Icon mapping for metric icons
const iconMap: Record<string, any> = {
    Flame, Calendar, Clock, Trophy, TrendingUp, Award, Dumbbell, Heart
};

interface ProgressStat {
    metricId: string;
    name: string;
    category: string;
    unit: string;
    icon?: string;
    value: number;
}

export default function ProgressPage() {
    const { slug } = useParams();
    const { tenant, features } = useOutletContext<any>() || {};
    const [stats, setStats] = useState<ProgressStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, [slug]);

    const loadStats = async () => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const data = await apiRequest(`/progress/my-stats`, token, {
                headers: { 'X-Tenant-Slug': slug || '' }
            });
            setStats(data);
        } catch (e) {
            console.error('Failed to load progress stats', e);
        } finally {
            setLoading(false);
        }
    };

    // Check if feature is enabled
    if (!features?.has('progress_tracking')) {
        return (
            <div className="max-w-3xl mx-auto p-8 text-center">
                <Trophy className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Progress Tracking</h1>
                <p className="text-zinc-500 mb-6">This feature is not enabled for this studio.</p>
                <Link to={`/studio/${slug}`} className="text-blue-600 hover:underline">← Back to Dashboard</Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Group stats by category
    const mindfulnessStats = stats.filter(s => s.category === 'mindfulness');
    const strengthStats = stats.filter(s => s.category === 'strength');
    const cardioStats = stats.filter(s => s.category === 'cardio');
    const customStats = stats.filter(s => s.category === 'custom');

    const getIcon = (iconName?: string) => {
        if (!iconName) return Trophy;
        return iconMap[iconName] || Trophy;
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'mindfulness': return 'from-purple-500 to-indigo-600';
            case 'strength': return 'from-orange-500 to-red-600';
            case 'cardio': return 'from-green-500 to-emerald-600';
            default: return 'from-blue-500 to-cyan-600';
        }
    };

    const StatCard = ({ stat }: { stat: ProgressStat }) => {
        const Icon = getIcon(stat.icon);
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${getCategoryColor(stat.category)} text-white`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{stat.name}</h3>
                        <p className="text-xs text-zinc-500 capitalize">{stat.category}</p>
                    </div>
                </div>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                    {stat.value.toLocaleString()}
                    <span className="text-base font-normal text-zinc-500 ml-1">{stat.unit}</span>
                </div>
            </div>
        );
    };

    const CategorySection = ({ title, stats, color }: { title: string; stats: ProgressStat[]; color: string }) => {
        if (stats.length === 0) return null;
        return (
            <div className="mb-8">
                <h2 className={`text-lg font-semibold mb-4 bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                    {title}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map(stat => (
                        <StatCard key={stat.metricId} stat={stat} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Trophy className="h-7 w-7 text-amber-500" />
                    My Progress
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400">Track your journey and achievements</p>
            </div>

            {stats.length === 0 ? (
                <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <Calendar className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">No Progress Yet</h3>
                    <p className="text-zinc-500 mb-4">Start attending classes to see your progress here!</p>
                    <Link to={`/studio/${slug}/schedule`} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <Calendar className="h-4 w-4" /> View Schedule
                    </Link>
                </div>
            ) : (
                <>
                    {/* Summary Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        {stats.slice(0, 4).map(stat => (
                            <div
                                key={stat.metricId}
                                className={`p-4 rounded-xl bg-gradient-to-br ${getCategoryColor(stat.category)} text-white`}
                            >
                                <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
                                <div className="text-sm opacity-90">{stat.name}</div>
                            </div>
                        ))}
                    </div>

                    <CategorySection title="Mindfulness & Practice" stats={mindfulnessStats} color="from-purple-500 to-indigo-600" />
                    <CategorySection title="Strength & Fitness" stats={strengthStats} color="from-orange-500 to-red-600" />
                    <CategorySection title="Cardio & Endurance" stats={cardioStats} color="from-green-500 to-emerald-600" />
                    <CategorySection title="Custom Metrics" stats={customStats} color="from-blue-500 to-cyan-600" />
                </>
            )}
        </div>
    );
}
