import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { CardCreator } from "./CardCreator";
import type { Plan } from "~/hooks/useMemberships";

interface PlanModalProps {
    isOpen: boolean;
    plan?: Plan;
    onClose: () => void;
    onSave: (data: any, id?: string) => void;
    isSubmitting: boolean;
    tenantSlug: string;
}

export function PlanModal({ isOpen, plan, onClose, onSave, isSubmitting, tenantSlug }: PlanModalProps) {
    const { getToken } = useAuth();

    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [interval, setInterval] = useState("month");
    const [description, setDescription] = useState("");
    const [vodEnabled, setVodEnabled] = useState(false);
    const [trialDays, setTrialDays] = useState(0);

    const [cardData, setCardData] = useState<{ image: Blob | null; title: string; subtitle: string; previewUrl: string }>({
        image: null, title: "", subtitle: "", previewUrl: ""
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(plan?.name || "");
            setPrice(plan ? (plan.price / 100).toFixed(2) : "");
            setInterval(plan?.interval || "month");
            setDescription(plan?.description || "");
            setVodEnabled(plan?.vodEnabled || false);
            setTrialDays(plan?.trialDays || 0);
            setCardData({
                image: null,
                title: plan?.overlayTitle || "",
                subtitle: plan?.overlaySubtitle || "",
                previewUrl: plan?.imageUrl || ""
            });
        }
    }, [isOpen, plan]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            let imageUrl = plan?.imageUrl;

            if (cardData.image) {
                const token = await getToken();
                const uploadFormData = new FormData();
                const file = new File([cardData.image], "card.jpg", { type: "image/jpeg" });
                uploadFormData.append("file", file);

                const apiUrl = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";
                const res = await fetch(`${apiUrl}/uploads/r2-image`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "X-Tenant-Slug": tenantSlug
                    },
                    body: uploadFormData
                });

                if (!res.ok) throw new Error("Image upload failed");
                const data = await res.json() as { url: string };
                imageUrl = data.url;
            }

            await onSave(
                {
                    name,
                    price: Number(price) * 100,
                    interval,
                    description,
                    imageUrl,
                    overlayTitle: cardData.title,
                    overlaySubtitle: cardData.subtitle,
                    vodEnabled,
                    trialDays: Number(trialDays),
                },
                plan?.id
            );
        } catch (err: any) {
            toast.error("Failed to save plan: " + err.message);
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
                    <div className="space-y-4">
                        <Label>Card Appearance</Label>
                        <CardCreator
                            initialImage={plan?.imageUrl}
                            initialTitle={cardData.title}
                            initialSubtitle={cardData.subtitle}
                            onChange={(newData) => setCardData(prev => ({ ...prev, ...newData }))}
                        />
                        <p className="text-xs text-zinc-500">
                            Upload an image or generate a card with custom colors and text overlays. Recommended image size: <strong>600×450px</strong> (4:3 ratio, max 5 MB).
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Plan Name (Internal)</Label>
                            <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gold Unlimited" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Price ($)</Label>
                                <Input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Interval</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                                    value={interval}
                                    onChange={e => setInterval(e.target.value)}
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
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="vodEnabled"
                                checked={vodEnabled}
                                onChange={e => setVodEnabled(e.target.checked)}
                                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label htmlFor="vodEnabled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Include VOD Access
                                </label>
                                <p className="text-sm text-zinc-500">Allows entry to On-Demand Library</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Free Trial (days)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="365"
                                value={trialDays}
                                onChange={e => setTrialDays(Number(e.target.value))}
                                placeholder="0 = no trial"
                            />
                            <p className="text-xs text-zinc-500">Set to 0 to disable the free trial for this plan.</p>
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
