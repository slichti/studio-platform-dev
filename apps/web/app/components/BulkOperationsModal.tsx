import { useState } from "react";
import { useParams } from "react-router";
import { Plus, CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

type TabId = "schedule" | "reschedule" | "cancel";

interface BulkOperationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** When provided, "Bulk Schedule" tab shows a button to open the bulk schedule flow (e.g. open CreateBulkClassModal in parent) */
    onOpenBulkSchedule?: () => void;
    onSuccess?: () => void;
}

export function BulkOperationsModal({ isOpen, onClose, onOpenBulkSchedule, onSuccess }: BulkOperationsModalProps) {
    const { slug } = useParams();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabId>("schedule");

    // Reschedule state
    const [bulkMoveFrom, setBulkMoveFrom] = useState("");
    const [bulkMoveTo, setBulkMoveTo] = useState("");
    const [bulkShiftMinutes, setBulkShiftMinutes] = useState(60);
    const [bulkMoveLoading, setBulkMoveLoading] = useState(false);

    // Cancel state
    const [bulkFrom, setBulkFrom] = useState("");
    const [bulkTo, setBulkTo] = useState("");
    const [bulkNotify, setBulkNotify] = useState(true);
    const [bulkReason, setBulkReason] = useState("");
    const [bulkLoading, setBulkLoading] = useState(false);

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: "schedule", label: "Bulk Schedule", icon: <Plus className="h-4 w-4" /> },
        { id: "reschedule", label: "Bulk Reschedule", icon: <CalendarClock className="h-4 w-4" /> },
        { id: "cancel", label: "Bulk Cancel", icon: <Trash2 className="h-4 w-4" /> },
    ];

    const handleReschedule = async () => {
        if (!bulkMoveFrom || !bulkMoveTo || !slug) return;
        setBulkMoveLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/classes/bulk-move", token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug, "Content-Type": "application/json" },
                body: JSON.stringify({
                    from: new Date(bulkMoveFrom).toISOString(),
                    to: new Date(bulkMoveTo + "T23:59:59").toISOString(),
                    shiftMinutes: bulkShiftMinutes,
                }),
            });
            if (res?.success) {
                toast.success(`${res.affected} class${res.affected !== 1 ? "es" : ""} rescheduled.`);
                onClose();
                onSuccess?.();
                queryClient.invalidateQueries({ queryKey: ["classes-infinite", slug] });
            } else {
                toast.error(res?.error || "Failed to reschedule");
            }
        } catch (e: any) {
            toast.error(e?.message || "An error occurred");
        } finally {
            setBulkMoveLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!bulkFrom || !bulkTo || !slug) return;
        setBulkLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/classes/bulk-cancel", token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug, "Content-Type": "application/json" },
                body: JSON.stringify({
                    from: new Date(bulkFrom).toISOString(),
                    to: new Date(bulkTo + "T23:59:59").toISOString(),
                    notifyStudents: bulkNotify,
                    cancellationReason: bulkReason || undefined,
                }),
            });
            if (res?.success) {
                toast.success(`${res.affected} class${res.affected !== 1 ? "es" : ""} cancelled${res.notified > 0 ? `, ${res.notified} notified` : ""}.`);
                onClose();
                onSuccess?.();
                queryClient.invalidateQueries({ queryKey: ["classes-infinite", slug] });
            } else {
                toast.error(res?.error || "Failed to cancel");
            }
        } catch (e: any) {
            toast.error(e?.message || "An error occurred");
        } finally {
            setBulkLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle>Bulk Operations</DialogTitle>
                    <DialogDescription>Schedule, reschedule, or cancel classes in bulk.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-1 min-h-0">
                    <div className="w-48 border-r border-zinc-200 dark:border-zinc-800 flex flex-col py-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors",
                                    activeTab === tab.id
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-r-2 border-indigo-600"
                                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        {activeTab === "schedule" && (
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Create multiple classes at once by date range and days of the week.
                                </p>
                                {onOpenBulkSchedule ? (
                                    <Button
                                        onClick={() => {
                                            onClose();
                                            onOpenBulkSchedule();
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Open Bulk Schedule
                                    </Button>
                                ) : (
                                    <p className="text-xs text-zinc-500">Use the Bulk Schedule option from the Tile or List view.</p>
                                )}
                            </div>
                        )}
                        {activeTab === "reschedule" && (
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Shift all classes in a date range by a number of minutes. Positive = later, negative = earlier.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">From</label>
                                        <input
                                            type="date"
                                            value={bulkMoveFrom}
                                            onChange={(e) => setBulkMoveFrom(e.target.value)}
                                            className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">To</label>
                                        <input
                                            type="date"
                                            value={bulkMoveTo}
                                            onChange={(e) => setBulkMoveTo(e.target.value)}
                                            className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Shift (minutes)</label>
                                    <input
                                        type="number"
                                        value={bulkShiftMinutes}
                                        onChange={(e) => setBulkShiftMinutes(parseInt(e.target.value, 10) || 0)}
                                        placeholder="e.g. 60 or -30"
                                        className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">Positive = later, negative = earlier</p>
                                </div>
                                <DialogFooter className="pt-4">
                                    <Button variant="outline" onClick={onClose} disabled={bulkMoveLoading}>
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        disabled={!bulkMoveFrom || !bulkMoveTo || bulkMoveLoading}
                                        onClick={handleReschedule}
                                    >
                                        {bulkMoveLoading ? "Rescheduling…" : "Confirm Reschedule"}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                        {activeTab === "cancel" && (
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Cancel all classes in a date range. Affected bookings will also be cancelled.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">From</label>
                                        <input
                                            type="date"
                                            value={bulkFrom}
                                            onChange={(e) => setBulkFrom(e.target.value)}
                                            className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">To</label>
                                        <input
                                            type="date"
                                            value={bulkTo}
                                            onChange={(e) => setBulkTo(e.target.value)}
                                            className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Reason (optional)</label>
                                    <input
                                        type="text"
                                        value={bulkReason}
                                        onChange={(e) => setBulkReason(e.target.value)}
                                        placeholder="e.g. Instructor unavailable"
                                        className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={bulkNotify}
                                        onChange={(e) => setBulkNotify(e.target.checked)}
                                        className="rounded border-zinc-300 dark:border-zinc-700"
                                    />
                                    <span className="text-zinc-700 dark:text-zinc-300">Email affected students</span>
                                </label>
                                <DialogFooter className="pt-4">
                                    <Button variant="outline" onClick={onClose} disabled={bulkLoading}>
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={!bulkFrom || !bulkTo || bulkLoading}
                                        onClick={handleCancel}
                                    >
                                        {bulkLoading ? "Cancelling…" : "Confirm Bulk Cancel"}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
