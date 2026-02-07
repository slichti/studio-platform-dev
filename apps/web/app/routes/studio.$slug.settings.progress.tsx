import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { apiRequest } from "~/utils/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/Card";
import { Plus, Trash2, Eye, EyeOff, Activity, MoreVertical, Trophy, Dumbbell, Heart, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/DropdownMenu";
import { Badge } from "~/components/ui/Badge";
import { Switch } from "~/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog"; // Standard Dialog

// Helper for icons
const iconOptions = [
    { value: 'Trophy', label: 'Trophy', icon: Trophy },
    { value: 'Dumbbell', label: 'Dumbbell', icon: Dumbbell },
    { value: 'Heart', label: 'Heart', icon: Heart },
    { value: 'Calendar', label: 'Calendar', icon: Calendar },
    { value: 'Activity', label: 'Activity', icon: Activity },
    { value: 'Flame', label: 'Flame', icon: Calendar }, // Reusing Calendar or custom
];

export default function ProgressSettingsPage() {
    const { slug } = useParams();
    const [metrics, setMetrics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form State
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadMetrics();
    }, [slug]);

    const loadMetrics = async () => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const data = await apiRequest(`/tenant/progress/metrics`, token, {
                headers: { 'X-Tenant-Slug': slug || '' }
            });
            setMetrics(data.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0)));
        } catch (e) {
            console.error(e);
            toast.error("Failed to load metrics");
        } finally {
            setLoading(false);
        }
    };

    const updateMetric = async (id: string, updates: any) => {
        // Optimistic
        setMetrics(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/progress/metrics/${id}`, token, {
                method: 'PUT',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify(updates)
            });
            toast.success("Updated");
        } catch (e) {
            toast.error("Failed to update");
            loadMetrics(); // Revert
        }
    };

    const deleteMetric = async () => {
        if (!deleteId) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/progress/metrics/${deleteId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug || '' }
            });
            setMetrics(prev => prev.filter(m => m.id !== deleteId));
            toast.success("Metric deleted");
        } catch (e) {
            toast.error("Failed to delete");
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="max-w-5xl pb-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Metric Management</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Configure what metrics are tracked for your students.</p>
                </div>
                <AddMetricDialog
                    open={isAddOpen}
                    onOpenChange={setIsAddOpen}
                    onSuccess={(newMetric: any) => {
                        setMetrics(prev => [...prev, newMetric]);
                        setIsAddOpen(false);
                    }}
                    slug={slug}
                />
            </div>

            <div className="space-y-4">
                {metrics.map(metric => (
                    <div key={metric.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500">
                                {iconOptions.find(i => i.value === metric.icon)?.icon ?
                                    (iconOptions.find(i => i.value === metric.icon)!.icon as any)({ className: "h-5 w-5" }) :
                                    <Activity className="h-5 w-5" />
                                }
                            </div>
                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    {metric.name}
                                    {!metric.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                                </h3>
                                <div className="text-xs text-zinc-500 flex gap-2">
                                    <span className="capitalize">{metric.category}</span>
                                    <span>•</span>
                                    <span>{metric.aggregation.toUpperCase()}</span>
                                    <span>•</span>
                                    <span>Unit: {metric.unit}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`visible-${metric.id}`} className="text-xs text-zinc-500">Student Visible</Label>
                                <Switch
                                    id={`visible-${metric.id}`}
                                    checked={metric.visibleToStudents}
                                    onCheckedChange={(c) => updateMetric(metric.id, { visibleToStudents: c })}
                                />
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => updateMetric(metric.id, { active: !metric.active })}>
                                        {metric.active ? 'Deactivate' : 'Activate'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(metric.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}

                {metrics.length === 0 && !loading && (
                    <div className="text-center py-12 text-zinc-500">
                        No metrics defined. Add one to start tracking.
                    </div>
                )}
            </div>

            <ConfirmationDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={deleteMetric}
                title="Delete Metric"
                message="Are you sure? This will delete all historical data for this metric."
                confirmText="Delete"
                isDestructive
            />
        </div>
    );
}

function AddMetricDialog({ open, onOpenChange, onSuccess, slug }: any) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        const body = {
            name: fd.get("name"),
            unit: fd.get("unit"),
            category: fd.get("category"),
            aggregation: fd.get("aggregation"),
            icon: fd.get("icon"),
            visibleToStudents: true
        };

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res = await apiRequest(`/tenant/progress/metrics`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify(body)
            });
            onSuccess(res);
            toast.success("Metric created");
        } catch (e: any) {
            toast.error(e.message || "Failed to create");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Metric
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Custom Metric</DialogTitle>
                    <DialogDescription>Define a new metric to track for your students.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Metric Name</Label>
                        <Input name="name" placeholder="e.g. Burpees" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select name="category" defaultValue="custom">
                                <option value="mindfulness">Mindfulness</option>
                                <option value="strength">Strength</option>
                                <option value="cardio">Cardio</option>
                                <option value="custom">Custom</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Unit</Label>
                            <Input name="unit" placeholder="e.g. reps, mins" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Aggregation</Label>
                            <Select name="aggregation" defaultValue="sum">
                                <option value="sum">Sum (Total)</option>
                                <option value="max">Max (Record)</option>
                                <option value="avg">Average</option>
                                <option value="latest">Latest Value</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Icon</Label>
                            <Select name="icon" defaultValue="Activity">
                                {iconOptions.map(i => (
                                    <option key={i.value} value={i.value}>
                                        {i.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Metric"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
