import { useParams, useOutletContext, Link } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check, X, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { CardCreator } from "../components/CardCreator"; // Keeping this custom component
import { Label } from "~/components/ui/label";

import { usePlans, useSubscriptions, type Plan } from "~/hooks/useMemberships";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

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

function PlanModal({ isOpen, plan, onClose, onSave, isSubmitting, tenantSlug }: { isOpen: boolean; plan?: Plan; onClose: () => void; onSave: (data: any, id?: string) => void; isSubmitting: boolean; tenantSlug: string }) {
    const { getToken } = useAuth();

    // Form State
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [interval, setInterval] = useState("month");
    const [description, setDescription] = useState("");
    const [vodEnabled, setVodEnabled] = useState(false);

    // Card Creator State
    const [cardData, setCardData] = useState<{ image: Blob | null, title: string, subtitle: string, previewUrl: string }>({
        image: null, title: '', subtitle: '', previewUrl: ''
    });
    const [uploading, setUploading] = useState(false);

    // Init Effect
    useEffect(() => {
        if (isOpen) {
            setName(plan?.name || "");
            setPrice(plan ? (plan.price / 100).toFixed(2) : "");
            setInterval(plan?.interval || "month");
            setDescription(plan?.description || "");
            setVodEnabled(plan?.vodEnabled || false);

            setCardData({
                image: null,
                title: plan?.overlayTitle || "",
                subtitle: plan?.overlaySubtitle || "",
                previewUrl: plan?.imageUrl || "" // Use previewUrl to show existing image
            });
        }
    }, [isOpen, plan]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);

        try {
            let imageUrl = plan?.imageUrl;

            // Upload Image if present (only if changed/new blob)
            if (cardData.image) {
                const token = await getToken();
                const uploadFormData = new FormData();
                const file = new File([cardData.image], "card.jpg", { type: "image/jpeg" });
                uploadFormData.append('file', file);

                const apiUrl = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
                const res = await fetch(`${apiUrl}/uploads/r2-image`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Tenant-Slug': tenantSlug
                    },
                    body: uploadFormData
                });

                if (!res.ok) throw new Error("Image upload failed");
                const data = await res.json() as { url: string };
                imageUrl = data.url;
            }

            const payload = {
                name,
                price: Number(price) * 100,
                interval,
                description,
                imageUrl,
                overlayTitle: cardData.title,
                overlaySubtitle: cardData.subtitle,
                vodEnabled
            };

            await onSave(payload, plan?.id);
        } catch (err: any) {
            toast.error("Failed to upload image or save plan: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{plan ? "Edit Membership Plan" : "Create Membership Plan"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
                    {/* Left: Card Visuals */}
                    <div className="space-y-4">
                        <Label>Card Appearance</Label>
                        <CardCreator
                            initialImage={plan?.imageUrl} // Backwards compat if component uses this
                            initialTitle={cardData.title}
                            initialSubtitle={cardData.subtitle}
                            onChange={(newData) => {
                                // Merge updates carefully
                                setCardData(prev => ({ ...prev, ...newData }));
                            }}
                        />
                        <p className="text-xs text-zinc-500">
                            Upload an image and set text overlays to customize how this plan appears in the store.
                        </p>
                    </div>

                    {/* Right: Plan Details */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Plan Name (Internal)</Label>
                            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold Unlimited" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Price ($)</Label>
                                <Input type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Interval</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                                    value={interval}
                                    onChange={(e) => setInterval(e.target.value)}
                                >
                                    <option value="month">Monthly</option>
                                    <option value="week">Weekly</option>
                                    <option value="year">Yearly</option>
                                    <option value="one_time">One Time</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="vodEnabled"
                                checked={vodEnabled}
                                onChange={(e) => setVodEnabled(e.target.checked)}
                                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="vodEnabled"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Include VOD Access
                                </label>
                                <p className="text-sm text-zinc-500">
                                    Allows entry to On-Demand Library
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-full flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting || uploading}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || uploading}>
                            {(isSubmitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {plan ? "Save Changes" : "Create Plan"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
