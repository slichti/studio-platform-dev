import { useParams, useOutletContext, Link } from "react-router";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { PlanModal } from "~/components/PlanModal";

import { usePlans, useSubscriptions, type Plan } from "~/hooks/useMemberships";
import { apiRequest } from "~/utils/api";

export default function StudioMemberships() {
    const { slug } = useParams();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const { isStudentView } = useOutletContext<any>() || {};

    // Data
    const { data: plans = [], isLoading: isLoadingPlans, error: plansError } = usePlans(slug!);
    const { data: subscriptions = [], isLoading: isLoadingSubs } = useSubscriptions(slug!);

    // State
    const [modalState, setModalState] = useState<{ type: 'closed' } | { type: 'create' } | { type: 'edit', plan: Plan }>({ type: 'closed' });
    const [planToDelete, setPlanToDelete] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handlers
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['plans', slug] });
        queryClient.invalidateQueries({ queryKey: ['subscriptions', slug] });
    };

    const handleDelete = async () => {
        if (!planToDelete) return;
        try {
            const token = await getToken();
            await apiRequest(`/memberships/plans/${planToDelete}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            });
            toast.success("Plan deleted");
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete plan");
        } finally {
            setPlanToDelete(null);
        }
    };

    const handleSave = async (data: any, planId?: string) => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const url = planId ? `/memberships/plans/${planId}` : "/memberships/plans";
            const method = planId ? "PATCH" : "POST";

            await apiRequest(url, token, {
                method,
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });

            toast.success(planId ? "Plan updated" : "Plan created");
            refresh();
            setModalState({ type: 'closed' });
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to save plan");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6 overflow-y-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Memberships</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your membership tiers and view subscriptions.</p>
                </div>
                {!isStudentView && (
                    <Button onClick={() => setModalState({ type: 'create' })}>
                        <Plus className="mr-2 h-4 w-4" /> New Plan
                    </Button>
                )}
            </div>

            <ComponentErrorBoundary>
                {/* Plans Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {isLoadingPlans ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-3">
                                <div className="aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg" />
                                <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
                                <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
                            </div>
                        ))
                    ) : plans.length === 0 ? (
                        <div className="col-span-full text-center p-12 rounded-lg bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700">
                            <h3 className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No Membership Plans</h3>
                            <p className="text-sm mb-4 text-zinc-500 dark:text-zinc-400">Create tiers like "Unlimited" or "10-Pack" for your students.</p>
                            {!isStudentView && (
                                <Button variant="link" onClick={() => setModalState({ type: 'create' })}>Create first plan</Button>
                            )}
                        </div>
                    ) : (
                        plans.map((plan) => (
                            <div key={plan.id} className="group">
                                <Link to={plan.id} className="block relative aspect-[4/3] w-full bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden mb-3">
                                    {plan.imageUrl ? (
                                        <img src={plan.imageUrl} alt={plan.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                            No Image
                                        </div>
                                    )}
                                    {/* Overlay */}
                                    {(plan.overlayTitle || plan.overlaySubtitle) && (
                                        <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center text-center p-4">
                                            <div className="bg-white/90 dark:bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-md max-w-[90%] shadow-sm">
                                                {plan.overlayTitle && <h3 className="font-serif text-lg text-zinc-900 dark:text-white leading-tight">{plan.overlayTitle}</h3>}
                                                {plan.overlaySubtitle && <p className="text-[10px] text-zinc-700 dark:text-zinc-300 mt-0.5 uppercase tracking-wider">{plan.overlaySubtitle}</p>}
                                            </div>
                                        </div>
                                    )}
                                </Link>

                                <div className="space-y-1">
                                    <Link to={plan.id} className="flex items-start gap-2 group-hover:underline">
                                        <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                        <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 leading-snug">{plan.name}</h3>
                                    </Link>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-4">
                                        Updated {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Subscriptions Table */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Active Subscriptions</h3>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                        {isLoadingSubs ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>
                        ) : subscriptions.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">No active subscriptions yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Student</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Plan</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Renewal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {subscriptions.map((sub) => (
                                            <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{sub.user.profile?.fullName || sub.user.email}</div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub.user.email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{sub.planName}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} className={sub.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' : ''}>
                                                        {sub.status}
                                                    </Badge>
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

            {/* Modals */}
            <PlanModal
                isOpen={modalState.type !== 'closed'}
                plan={modalState.type === 'edit' ? modalState.plan : undefined}
                onClose={() => setModalState({ type: 'closed' })}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                tenantSlug={slug!}
            />

            <ConfirmationDialog
                isOpen={!!planToDelete}
                onClose={() => setPlanToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Membership Plan"
                message="Are you sure you want to delete this plan? This cannot be undone and may affect existing subscriptions."
                confirmText="Delete Plan"
                isDestructive
            />
        </div>
    );
}

