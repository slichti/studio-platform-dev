import { useParams, Link, useOutletContext } from "react-router";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft, Loader2, Users, DollarSign, TrendingUp,
    Copy, Edit, Trash2, Eye, MoreHorizontal, Archive, ArchiveRestore, BadgeAlert
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { Input } from "~/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/DropdownMenu";
import { ConfirmationDialog } from "~/components/Dialogs";
import { PlanModal } from "~/components/PlanModal";

import { usePlans, useSubscriptions, type Plan } from "~/hooks/useMemberships";
import { apiRequest } from "~/utils/api";
import { getTenantUrl } from "~/utils/domain";

export default function MembershipPlanDetailPage() {
    const { slug, planId } = useParams();
    const { tenant } = useOutletContext<{ tenant: any }>();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    // Data
    const { data: plans = [], isLoading: isLoadingPlans } = usePlans(slug!);
    const { data: subscriptions = [], isLoading: isLoadingSubs } = useSubscriptions(slug!, planId);

    const plan = plans.find(p => p.id === planId);

    // Edit / Duplicate / Delete state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['plans', slug] });

    const handleSave = async (data: any, id?: string) => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            await apiRequest(`/memberships/plans/${id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });
            toast.success("Plan updated");
            refresh();
            setIsEditOpen(false);
        } catch (e: any) {
            toast.error(e.message || "Failed to save plan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDuplicate = async () => {
        if (!plan) return;
        setIsSubmitting(true);
        try {
            const token = await getToken();
            await apiRequest("/memberships/plans", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    name: `${plan.name} (Copy)`,
                    price: plan.price,
                    interval: plan.interval,
                    description: plan.description,
                    imageUrl: plan.imageUrl,
                    overlayTitle: plan.overlayTitle,
                    overlaySubtitle: plan.overlaySubtitle,
                    vodEnabled: plan.vodEnabled
                })
            });
            toast.success("Plan duplicated");
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to duplicate plan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!plan) return;
        try {
            const token = await getToken();
            const result = await apiRequest(`/memberships/plans/${plan.id}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            });
            if (result?.archived) {
                toast.success("Plan archived — it has active subscribers so it was deactivated rather than deleted.");
            } else {
                toast.success("Plan deleted");
            }
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete plan");
        } finally {
            setIsDeleteOpen(false);
        }
    };

    const handleToggleArchive = async () => {
        if (!plan) return;
        setIsSubmitting(true);
        try {
            const token = await getToken();
            await apiRequest(`/memberships/plans/${plan.id}/status`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ active: !plan.active })
            });
            toast.success(plan.active ? "Plan archived" : "Plan restored");
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to update plan status");
        } finally {
            setIsSubmitting(false);
        }
    };

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

    const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing');
    const estimatedMRR = activeSubs.length * plan.price;

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
            <div className="p-6 pb-20 space-y-8 max-w-7xl mx-auto w-full">

                {/* Header Section */}
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                        <Link to=".." className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors mb-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Memberships
                        </Link>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</h1>
                            <Badge variant={plan.active !== false ? 'default' : 'secondary'} className={plan.active !== false ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' : ''}>
                                {plan.active === false ? 'Archived' : 'Active'}
                            </Badge>
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
                            {plan.description || "No description provided."}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(`/studio/${slug}/checkout?planId=${plan.id}`, '_blank')}>
                            <Eye className="w-4 h-4 mr-2" /> Preview
                        </Button>
                        <Button variant="default" size="sm" onClick={() => setIsEditOpen(true)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit Plan
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleDuplicate} disabled={isSubmitting}>
                                    <Copy className="w-4 h-4 mr-2" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleToggleArchive} disabled={isSubmitting}>
                                    {plan.active
                                        ? <><Archive className="w-4 h-4 mr-2" /> Archive</>
                                        : <><ArchiveRestore className="w-4 h-4 mr-2" /> Restore</>
                                    }
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setIsDeleteOpen(true)}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Details & Promotion */}
                    <div className="space-y-6">
                        {/* Plan Details Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                                    <span className="text-sm text-zinc-500">Price</span>
                                    <span className="text-sm font-medium">${(plan.price / 100).toFixed(2)} / {plan.interval}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                                    <span className="text-sm text-zinc-500">Video Access</span>
                                    <span className="text-sm font-medium">{plan.vodEnabled ? 'Included' : 'Not Included'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                                    <span className="text-sm text-zinc-500">ID</span>
                                    <span className="text-xs font-mono text-zinc-400">{plan.id.slice(0, 8)}...</span>
                                </div>
                            </CardContent>
                        </Card>


                        {/* Promotion Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Promote</CardTitle>
                                <CardDescription>Share links to get more signups.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <UrlRow
                                    label="Checkout Link"
                                    url={`${getTenantUrl(tenant)}/studio/${slug}/checkout?planId=${plan.id}`}
                                    description="Direct link to purchase this plan."
                                />
                                <UrlRow
                                    label="Memberships Page"
                                    url={`${getTenantUrl(tenant)}/portal/${slug}/memberships`}
                                    description="Portal page where students can browse all plans."
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Performance & Subscribers */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Highlights Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <StatsCard title="Active Members" value={activeSubs.length.toString()} icon={<Users className="w-4 h-4" />} />
                            <StatsCard title="Est. MRR" value={`$${(estimatedMRR / 100).toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} />
                            <StatsCard
                                title="Est. Annual Revenue"
                                value={`$${((estimatedMRR / 100) * (plan.interval === 'year' ? 1 : plan.interval === 'week' ? 52 : plan.interval === 'month' ? 12 : 1)).toLocaleString()}`}
                                icon={<TrendingUp className="w-4 h-4" />}
                            />
                        </div>

                        {/* Subscribers Table */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Subscribers</CardTitle>
                                    <CardDescription>Manage active enrollments.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                        <Input placeholder="Search students..." className="pl-9 h-9 w-[200px]" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <SubscribersList subscriptions={subscriptions} />
                            </CardContent>
                        </Card>
                    </div>
                </div>

            </div>

            <PlanModal
                isOpen={isEditOpen}
                plan={plan}
                onClose={() => setIsEditOpen(false)}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                tenantSlug={slug!}
            />

            <ConfirmationDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Delete Membership Plan"
                message="Are you sure you want to delete this plan? This cannot be undone and may affect existing subscriptions."
                confirmText="Delete Plan"
                isDestructive
            />
        </div>
    );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function UrlRow({ label, url, description }: { label: string, url: string, description?: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        toast.success(`${label} copied`);
    };

    return (
        <div className="group">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-900" onClick={handleCopy}>
                    <Copy className="w-3 h-3" />
                </Button>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate select-all">
                {url}
            </div>
            {description && <p className="text-[10px] text-zinc-400 mt-1">{description}</p>}
        </div>
    );
}

function StatsCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
    return (
        <Card>
            <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</span>
                    <span className="text-zinc-400">{icon}</span>
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
            </CardContent>
        </Card>
    );
}

function SubscribersList({ subscriptions }: { subscriptions: any[] }) {
    if (subscriptions.length === 0) {
        return <div className="text-center py-8 text-zinc-500 text-sm">No subscribers yet.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                        <th className="px-4 py-3 font-medium">Student</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Joined</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {subscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                {sub.user.profile?.fullName || 'Unknown'}
                            </td>
                            <td className="px-4 py-3 text-zinc-500">{sub.user.email}</td>
                            <td className="px-4 py-3">
                                <Badge variant="secondary" className={
                                    sub.status === 'active' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
                                }>
                                    {sub.status}
                                </Badge>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
                                {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
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
