import { useParams } from "react-router";
import { useState } from "react";
import { MapPin, Plus, Edit, Trash2, Star, Clock, Phone, Building, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";

import { useLocations, type Location } from "~/hooks/useLocations";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

export default function LocationsSettings() {
    const { slug } = useParams();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    // Data
    const { data: locations = [], isLoading, error } = useLocations(slug!);

    // State
    const [isEditing, setIsEditing] = useState<Location | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handlers
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['locations', slug] });

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            const token = await getToken();
            await apiRequest(`/locations/${confirmDeleteId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug! }
            });
            toast.success("Location deleted");
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete location");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleSetPrimary = async (id: string) => {
        try {
            const token = await getToken();
            await apiRequest(`/locations/${id}/set-primary`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! }
            });
            toast.success("Primary location updated");
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to update primary location");
        }
    };

    const handleSave = async (data: any) => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const id = isEditing?.id;

            const payload = {
                name: data.name,
                address: data.address,
                timezone: data.timezone,
                isPrimary: data.isPrimary,
                isActive: data.isActive,
                settings: {
                    phone: data.phone,
                    hours: data.hours
                }
            };

            await apiRequest(id ? `/locations/${id}` : '/locations', token, {
                method: id ? 'PATCH' : 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(payload)
            });

            toast.success(id ? "Location updated" : "Location created");
            refresh();
            setIsEditing(null);
            setIsCreating(false);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to save location");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 dark:bg-zinc-100 rounded-lg text-white dark:text-zinc-900">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Locations</h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Manage your physical or virtual locations.
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => setIsCreating(true)}>
                        <Plus size={16} className="mr-2" /> Add Location
                    </Button>
                </div>
            </header>

            <ComponentErrorBoundary>
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2].map((i) => (
                                <Card key={i} className="opacity-50">
                                    <div className="p-6 h-32 animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
                                </Card>
                            ))}
                        </div>
                    ) : locations.length === 0 ? (
                        <div className="text-center py-20 text-zinc-500 dark:text-zinc-400">
                            <Building size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No locations configured</p>
                            <Button variant="link" onClick={() => setIsCreating(true)} className="mt-2">
                                Add your first location
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {locations.map((location) => (
                                <Card key={location.id} className={cn(
                                    "transition-all",
                                    location.isPrimary ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10" : "hover:border-zinc-300 dark:hover:border-zinc-700"
                                )}>
                                    <CardContent className="p-5 flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "p-3 rounded-xl",
                                                location.isPrimary ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                            )}>
                                                <MapPin size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{location.name}</h3>
                                                    {location.isPrimary && (
                                                        <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-100/50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-900/30 flex items-center gap-1 scale-90">
                                                            <Star size={10} fill="currentColor" /> Primary
                                                        </Badge>
                                                    )}
                                                    {!location.isActive && (
                                                        <Badge variant="secondary">Inactive</Badge>
                                                    )}
                                                </div>
                                                {location.address && (
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{location.address}</p>
                                                )}
                                                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                                                    {location.timezone && <span className="flex items-center gap-1"><Clock size={12} /> {location.timezone}</span>}
                                                    {location.settings?.phone && <span className="flex items-center gap-1"><Phone size={12} /> {location.settings.phone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!location.isPrimary && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSetPrimary(location.id)}
                                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-900/20"
                                                    title="Set as primary"
                                                >
                                                    <Star size={16} />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(location)}>
                                                <Edit size={16} className="text-zinc-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(location.id)}>
                                                <Trash2 size={16} className="text-red-500" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </ComponentErrorBoundary>

            {/* Edit/Create Modal */}
            <LocationModal
                isOpen={!!isEditing || isCreating}
                location={isEditing}
                onClose={() => { setIsEditing(null); setIsCreating(false); }}
                onSave={handleSave}
                isSubmitting={isSubmitting}
            />

            <ConfirmationDialog
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete Location"
                message="Are you sure you want to delete this location? This action cannot be undone."
                confirmText="Delete"
                isDestructive
            />
        </div>
    );
}

function LocationModal({ isOpen, location, onClose, onSave, isSubmitting }: { isOpen: boolean; location?: Location | null; onClose: () => void; onSave: (data: any) => void; isSubmitting: boolean }) {
    const [name, setName] = useState(location?.name || "");
    const [address, setAddress] = useState(location?.address || "");
    const [timezone, setTimezone] = useState(location?.timezone || "UTC");
    const [phone, setPhone] = useState(location?.settings?.phone || "");
    const [hours, setHours] = useState(location?.settings?.hours || "");
    const [isPrimary, setIsPrimary] = useState(location?.isPrimary || false);
    const [isActive, setIsActive] = useState(location?.isActive !== false);

    // Reset when modal opens with new data
    useState(() => {
        if (isOpen) {
            setName(location?.name || "");
            setAddress(location?.address || "");
            setTimezone(location?.timezone || "UTC");
            setPhone(location?.settings?.phone || "");
            setHours(location?.settings?.hours || "");
            setIsPrimary(location?.isPrimary || false);
            setIsActive(location?.isActive !== false);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, address, timezone, phone, hours, isPrimary, isActive });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{location ? "Edit Location" : "New Location"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Name</label>
                        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Studio" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Address</label>
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Timezone</label>
                            <select
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                            >
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">Eastern</option>
                                <option value="America/Chicago">Central</option>
                                <option value="America/Denver">Mountain</option>
                                <option value="America/Los_Angeles">Pacific</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Phone</label>
                            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded border-zinc-300" />
                            Primary location
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-zinc-300" />
                            Active
                        </label>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
