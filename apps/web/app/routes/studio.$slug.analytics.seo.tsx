import { useParams } from "react-router";
import {
    Search,
    Globe,
    CheckCircle,
    XCircle,
    AlertCircle,
    ExternalLink,
    MapPin,
    BarChart3
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "~/utils/api";
import { useAuth } from "@clerk/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Loader2 } from "lucide-react";

export default function SEOAnalytics() {
    const { slug } = useParams();
    const { getToken } = useAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ['analytics', 'seo', slug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest(`/analytics/seo`, token, {
                headers: { 'X-Tenant-Slug': slug! }
            });
            return res;
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500">
                <AlertCircle size={48} className="mx-auto mb-4" />
                <p>Failed to load SEO analytics.</p>
            </div>
        );
    }

    const { stats, locations } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Metric Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Indexing Status"
                    value={stats.indexingEnabled ? "Enabled" : "Disabled"}
                    icon={<Search className={stats.indexingEnabled ? "text-emerald-500" : "text-zinc-400"} size={20} />}
                    status={stats.indexingEnabled ? "success" : "neutral"}
                />
                <StatCard
                    title="GBP Connected"
                    value={stats.gbpConnected ? "Connected" : "Not Linked"}
                    icon={<Globe className={stats.gbpConnected ? "text-blue-500" : "text-zinc-400"} size={20} />}
                    status={stats.gbpConnected ? "success" : "warning"}
                />
                <StatCard
                    title="Sitemap Health"
                    value={stats.sitemapEligible ? "Healthy" : "Ineligible"}
                    icon={<CheckCircle className={stats.sitemapEligible ? "text-emerald-500" : "text-zinc-400"} size={20} />}
                    status={stats.sitemapEligible ? "success" : "neutral"}
                />
                <StatCard
                    title="SEO-Optimized"
                    value={`${stats.seoOptimizedLocations} / ${stats.totalLocations}`}
                    icon={<BarChart3 className="text-purple-500" size={20} />}
                    status={stats.seoOptimizedLocations === stats.totalLocations ? "success" : "warning"}
                />
            </div>

            {/* Locations SEO Health */}
            <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Location Search Dominance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {locations.map((loc: any) => (
                        <Card key={loc.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <CardHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-zinc-400" />
                                        <CardTitle className="text-base truncate max-w-[150px]">{loc.name}</CardTitle>
                                    </div>
                                    <Badge variant={loc.isActive ? "outline" : "secondary"}>
                                        {loc.isActive ? "Active" : "Hidden"}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500 dark:text-zinc-400">URL Slug</span>
                                    <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{loc.slug || "MISSING"}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500 dark:text-zinc-400">SEO Config</span>
                                    {loc.hasSeoConfig ? (
                                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle size={14} /> <span>Optimized</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                            <AlertCircle size={14} /> <span>Needs Work</span>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-2">
                                    <button
                                        className="w-full flex items-center justify-center gap-2 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(`/portal/${slug}/locations/${loc.slug}`, '_blank')}
                                    >
                                        View Landing Page <ExternalLink size={12} />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Recommendations */}
            <Card className="border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-900/10">
                <CardContent className="p-6">
                    <h3 className="font-bold text-emerald-900 dark:text-emerald-400 mb-2 flex items-center gap-2">
                        <BarChart3 size={18} /> SEO Pro-Tip
                    </h3>
                    <p className="text-sm text-emerald-800/80 dark:text-emerald-400/80">
                        Locations with custom SEO titles and descriptions tend to rank <strong>30% higher</strong> in local search results.
                        Make sure each studio has unique content tailored to its specific neighborhood.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ title, value, icon, status }: { title: string, value: string, icon: any, status: 'success' | 'warning' | 'neutral' }) {
    const statusColors = {
        success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        warning: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
        neutral: "text-zinc-600 bg-zinc-50 dark:bg-zinc-800"
    };

    return (
        <Card>
            <CardContent className="p-5 flex items-center gap-4">
                <div className={`p-2 rounded-lg ${statusColors[status]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
