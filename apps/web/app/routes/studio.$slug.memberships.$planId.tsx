
import { useParams, Link, useOutletContext } from "react-router";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft, Loader2, Users, DollarSign, Calendar, TrendingUp,
    Copy, ExternalLink, MoreVertical, Edit, Trash2, Share2, Eye, FileText
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { usePlans, useSubscriptions, type Plan } from "~/hooks/useMemberships";

export default function MembershipPlanDetailPage() {
    const { slug, planId } = useParams();
    const { tenant } = useOutletContext<{ tenant: any }>(); // Get tenant context

    // Data
    const { data: plans = [], isLoading: isLoadingPlans } = usePlans(slug!);
    const { data: subscriptions = [], isLoading: isLoadingSubs } = useSubscriptions(slug!, planId);

    const plan = plans.find(p => p.id === planId);

    // Initial Loading State
    if (isLoadingPlans) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;
    }

    // Not Found State
    if (!plan) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Plan Not Found</h2>
                <Link to="../memberships" className="text-blue-600 hover:underline">Back to Memberships</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
            <div className="p-6 pb-20 space-y-8 max-w-7xl mx-auto w-full"> {/* Container */}

                {/* Header Section */}
                <div className="flex flex-col gap-6">
                    {/* Breadcrumb & Actions Row */}
                    <div className="flex justify-between items-start">
                        <Link to=".." className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Link>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="hidden sm:flex" disabled>
                                <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate product
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete product
                            </Button>
                            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
                            <Button variant="ghost" size="sm" className="hidden sm:flex" disabled>
                                <FileText className="w-3.5 h-3.5 mr-2" /> Generate page
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => window.open(`/portal/${slug}/checkout?planId=${plan.id}`, '_blank')}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                            </Button>
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                <Edit className="w-3.5 h-3.5 mr-2" /> Edit product
                            </Button>
                        </div>
                    </div>

                    {/* Title Row */}
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${plan.active !== false ? 'bg-green-500' : 'bg-zinc-300'}`} />
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</h1>
                        <Button variant="outline" size="sm" className="ml-auto sm:ml-4">
                            <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                        </Button>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="bg-transparent p-0 h-auto border-b border-zinc-200 dark:border-zinc-800 w-full justify-start rounded-none space-x-6">
                            <TabsTrigger
                                value="overview"
                                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-zinc-900 dark:data-[state=active]:border-zinc-100 data-[state=active]:shadow-none rounded-none px-0 py-2 text-sm font-medium text-zinc-500 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100"
                            >
                                Overview
                            </TabsTrigger>
                            <TabsTrigger
                                value="reviews"
                                className="bg-transparent border-b-2 border-transparent data-[state=active]:border-zinc-900 dark:data-[state=active]:border-zinc-100 data-[state=active]:shadow-none rounded-none px-0 py-2 text-sm font-medium text-zinc-500 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100"
                            >
                                Reviews
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="py-6 space-y-8 animate-in fade-in-50">
                            {/* Info Bar */}
                            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                                <span className="flex items-center gap-2">
                                    <span className="font-medium text-zinc-900 dark:text-zinc-300">Type</span> Membership
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="font-medium text-zinc-900 dark:text-zinc-300">Shop</span> Visible in shop
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="font-medium text-zinc-900 dark:text-zinc-300">Enrollment</span> Open
                                </span>
                            </div>

                            {/* Section: URLs */}
                            <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Use custom domain URL</span>
                                    <Switch checked={false} onCheckedChange={() => { }} />
                                </div>

                                <UrlRow label="Product URL" url={`https://${tenant?.customDomain || `${slug}.heymarvelous.com`}/product/${plan.id}`} />
                                <UrlRow label="Purchase URL" url={`https://${tenant?.customDomain || `${slug}.heymarvelous.com`}/buy/product/${plan.id}`} />
                            </div>

                            {/* Section: Stats & Graph */}
                            <MembershipStats plan={plan} subscriptions={subscriptions} />


                            {/* Section: Table */}
                            <SubscribersList subscriptions={subscriptions} />

                        </TabsContent>

                        <TabsContent value="reviews" className="py-12 text-center text-zinc-500">
                            No reviews yet.
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function UrlRow({ label, url }: { label: string, url: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 min-w-[100px]">{label}</span>
            <div className="flex-1 flex items-center gap-2 group">
                <span className="text-sm text-zinc-600 dark:text-zinc-300 truncate font-mono bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded select-all">
                    {url}
                </span>
                <button onClick={handleCopy} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <Copy className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

function MembershipStats({ plan, subscriptions }: { plan: Plan, subscriptions: any[] }) {
    const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing');
    const activeCount = activeSubs.length;
    // Estimated Revenue (MRR)
    const estimatedMRR = activeCount * plan.price; // cents

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6">
            <Card className="md:col-span-4 border-none shadow-none bg-transparent p-0">
                {/* Simplified Graph Visual */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 h-64 flex items-end gap-2 justify-between items-end pb-0 overflow-hidden">
                    {/* Fake Bars representing activity */}
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-red-400/80 w-full rounded-t-sm hover:bg-red-500 transition-colors"
                            style={{ height: `${20 + Math.random() * 60}%` }}
                        />
                    ))}
                </div>
                <div className="flex justify-between text-xs text-zinc-400 px-2 mt-2 font-mono">
                    <span>Jan 15, 2026</span>
                    <span>Feb 15, 2026</span>
                </div>
            </Card>

            <StatsCard title="Revenue" value={`$${(estimatedMRR / 100).toLocaleString()}`} icon={null} />
            <StatsCard title="Customers" value={activeCount.toString()} icon={null} />
            <StatsCard title="Events" value="0" icon={null} />
            <StatsCard title="Views" value="69" icon={null} />
        </div>
    );
}

function StatsCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">{title}</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
    );
}

function SubscribersList({ subscriptions }: { subscriptions: any[] }) {
    const [filter, setFilter] = useState('');

    const filtered = subscriptions.filter(s => {
        const name = s.user.profile?.fullName || '';
        const email = s.user.email || '';
        return name.toLowerCase().includes(filter.toLowerCase()) || email.toLowerCase().includes(filter.toLowerCase());
    });

    return (
        <div className="space-y-4 pt-8 border-t border-zinc-100 dark:border-zinc-800 mt-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Tabs-like controls */}
                <div className="flex items-center gap-6 text-sm font-medium">
                    <button className="text-zinc-900 dark:text-zinc-100 border-b-2 border-red-500 pb-1">Payments</button>
                    <button className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 pb-1 transition-colors">Customers</button>
                    <button className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 pb-1 transition-colors">Gifted</button>
                    <button className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 pb-1 transition-colors">Waitlist</button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <Button variant="outline" size="sm" className="hidden sm:flex">
                        + Free credits
                    </Button>
                    <Button variant="outline" size="sm" className="hidden sm:flex" disabled>
                        Email customers
                    </Button>
                    <Button variant="outline" size="sm" className="hidden sm:flex" disabled>
                        Export CSV
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:hover:bg-red-900/30">
                        Add to product
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                    placeholder="Search"
                    className="pl-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-3 font-medium">First name</th>
                            <th className="px-6 py-3 font-medium">Last name</th>
                            <th className="px-6 py-3 font-medium">Student email</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Purchased</th>
                            <th className="px-6 py-3 font-medium w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                                    No records found.
                                </td>
                            </tr>
                        ) : filtered.map((sub: any) => {
                            const fullName = sub.user.profile?.fullName || '';
                            const [firstName, ...rest] = fullName.split(' ');
                            const lastName = rest.join(' ');

                            return (
                                <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 group transition-colors">
                                    <td className="px-6 py-4 text-red-500 font-medium">{firstName || '-'}</td>
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{lastName || '-'}</td>
                                    <td className="px-6 py-4 text-zinc-500">{sub.user.email}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200">
                                            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {sub.createdAt ? new Date(sub.createdAt).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'
                                        }) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-600 transition-colors">
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SearchIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    )
}
