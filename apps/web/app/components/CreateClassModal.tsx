import { useState } from "react";
import { Modal } from "./Modal";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";

interface CreateClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newClass: any) => void;
    tenantId?: string; // If needed for creating
}

export function CreateClassModal({ isOpen, onClose, onSuccess }: CreateClassModalProps) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        instructorId: "", // TODO: Fetch instructors to populate dropdown
        startTime: "",
        durationMinutes: 60,
        capacity: 20,
        price: 0,
        isRecurring: false,
        recurrencePattern: "weekly", // daily, weekly
        recurrenceEndDate: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const token = await getToken();

            let recurrenceRule = undefined;
            if (formData.isRecurring) {
                const { RRule } = await import("rrule");
                const rule = new RRule({
                    freq: formData.recurrencePattern === "weekly" ? RRule.WEEKLY : RRule.DAILY,
                    interval: 1, // Defaulting to 1 for now
                    // End date handling is often done via 'until', but API separates it. 
                    // Let's generate the basic rule string like "FREQ=WEEKLY"
                });
                // RRule toString() often includes newline. We just want the options string.
                // Or simpler: strictly constructing string
                recurrenceRule = formData.recurrencePattern === "weekly" ? "FREQ=WEEKLY" : "FREQ=DAILY";
                // If we want exact days (e.g. MO,TU), we need RRule object. 
                // For this simple UI "Weekly" implies "Weekly on this day".
                // RRule defaults to the start date's day if BYDAY is not specified? Yes.
            }

            const res = await apiRequest("/classes", token, {
                method: "POST",
                body: JSON.stringify({
                    title: formData.name,
                    description: formData.description,
                    startTime: new Date(formData.startTime).toISOString(),
                    durationMinutes: Number(formData.durationMinutes),
                    capacity: Number(formData.capacity),
                    price: Number(formData.price),
                    isRecurring: formData.isRecurring,
                    recurrenceRule: recurrenceRule,
                    recurrenceEnd: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : undefined
                })
            });

            if (res.error) {
                setError(res.error);
            } else {
                onSuccess(res.class);
                onClose();
                // Reset form
                setFormData({
                    name: "",
                    description: "",
                    instructorId: "",
                    startTime: "",
                    durationMinutes: 60,
                    capacity: 20,
                    price: 0,
                    isRecurring: false,
                    recurrencePattern: "weekly",
                    recurrenceEndDate: ""
                });
            }
        } catch (e: any) {
            setError(e.message || "Failed to create class");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Schedule Class">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Class Name</label>
                    <input
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Morning Vinyasa"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Start Time</label>
                        <input
                            type="datetime-local"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Duration (min)</label>
                        <input
                            type="number"
                            required
                            min="15"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.durationMinutes}
                            onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Capacity</label>
                        <input
                            type="number"
                            required
                            min="1"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Price ($)</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        />
                    </div>
                </div>

                {/* Recurrence Placeholder - Logic needs to be built in API first */}
                <div className="border-t border-zinc-200 pt-4 mt-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Repeat this class</span>
                    </label>

                    {formData.isRecurring && (
                        <div className="mt-3 p-3 bg-zinc-50 rounded border border-zinc-200 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">Frequency</label>
                                    <select
                                        className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                        value={formData.recurrencePattern}
                                        onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value })}
                                    >
                                        <option value="weekly">Weekly</option>
                                        <option value="daily">Daily</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        required={formData.isRecurring}
                                        className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                        value={formData.recurrenceEndDate}
                                        onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                                        min={formData.startTime ? new Date(formData.startTime).toISOString().split('T')[0] : undefined}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "Scheduling..." : "Schedule Class"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
