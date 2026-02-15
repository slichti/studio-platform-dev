
import { useParams, Link } from "react-router";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Users, DollarSign, Calendar, TrendingUp } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";

import { usePlans, useSubscriptions } from "~/hooks/useMemberships";

export default function MembershipPlanDetailPage() {
    const { slug, planId } = useParams();

    // Data
    const { data: plans = [], isLoading: isLoadingPlans } = usePlans(slug!);
    const { data: subscriptions = [], isLoading: isLoadingSubs } = useSubscriptions(slug!, planId);

    const plan = plans.find(p => p.id === planId);

    if (isLoadingPlans) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;
    }

    if (!plan) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Plan Not Found</h2>
                <Link to="../memberships" className="text-blue-600 hover:underline">Back to Memberships</Link>
            </div>
        );
    }

    // Stats
    const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing');
    const activeCount = activeSubs.length;
    const estimatedMRR = activeCount * plan.price;

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center gap-4 mb-2">
                <Link to=".." className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-zinc-500" />
                </Link>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.description || "Membership Plan Details"}</p>
                </div>
            </div>

            <ComponentErrorBoundary>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                            <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{activeCount}</div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Currently subscribed
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Estimated MRR</CardTitle>
                            <DollarSign className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${(estimatedMRR / 100).toFixed(2)}</div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Monthly Recurring Revenue
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Price</CardTitle>
                            <TrendingUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${(plan.price / 100).toFixed(2)}</div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                per {plan.interval}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Subscribers Table */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Subscribers</h3>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                        {isLoadingSubs ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>
                        ) : subscriptions.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No subscriptions found for this plan.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Member</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Joined</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Next Billing</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {subscriptions.map((sub) => (
                                            <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                                                            {(sub.user.profile?.fullName || sub.user.email).substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{sub.user.profile?.fullName || 'Unknown'}</div>
                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub.user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} className={sub.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' : ''}>
                                                        {sub.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                                                    {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                                                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </ComponentErrorBoundary>
        </div>
    );
}
