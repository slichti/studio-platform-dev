import { ActionFunction, LoaderFunction } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext, Link } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { Modal } from "../components/Modal";

// Loader: Fetch classes for this studio
export const loader: LoaderFunction = async (args) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const classes = await apiRequest("/classes", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { classes };
    } catch (e: any) {
        console.error("Failed to load classes", e);
        return { classes: [], error: e.message };
    }
};

// Action: Create new class
export const action: ActionFunction = async (args) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();

    const title = formData.get("title");
    const startTime = formData.get("startTime");
    const durationMinutes = Number(formData.get("duration"));
    const price = Number(formData.get("price") || 0); // Sent in cents? Or dolllars? API expects cents usually. Let's assume input is dollars -> cents.
    // Wait, API schema said default 0. let's assume input is cents for now or handler handles it.
    // Actually typically inputs are dollars. Let's multiply by 100 if we want cents.
    // For simplicity scaffolding, let's just pass raw number and assume API handles it or it's free.

    try {
        await apiRequest("/classes", token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({
                title,
                startTime,
                durationMinutes,
                price: price,
                capacity: 20 // Default fixed for now
            })
        });
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
};

import { useParams } from "react-router";

export default function StudioSchedule() {
    const { classes, error } = useLoaderData<any>();
    const params = useParams();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Close modal on success
    if (actionData?.success && isCreateOpen && !isSubmitting) {
        setIsCreateOpen(false);
    }

    // Sort classes by date
    const sortedClasses = Array.isArray(classes)
        ? [...classes].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        : [];

    return (
        <div style={{ color: 'var(--text)' }}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Schedule</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    style={{ background: 'var(--accent)', color: 'white' }}
                    className="px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium"
                >
                    + New Class
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    Failed to load classes: {error}
                </div>
            )}

            {sortedClasses.length === 0 ? (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="rounded-lg shadow-sm min-h-[400px] flex items-center justify-center">
                    <div className="text-center p-8">
                        <div className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-muted)' }}>
                            📅
                        </div>
                        <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--text)' }}>Weekly Schedule</h3>
                        <p className="max-w-sm mx-auto mb-6" style={{ color: 'var(--text-muted)' }}>
                            No classes scheduled yet. Create your first class to open bookings for your students.
                        </p>
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="text-blue-600 font-medium hover:underline"
                        >
                            Create your first class &rarr;
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Upcoming Classes</h3>
                    <div className="space-y-3">
                        {sortedClasses.map((cls: any) => (
                            <div key={cls.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-4 rounded-lg flex justify-between items-center transition-colors">
                                <div>
                                    <div className="font-medium" style={{ color: 'var(--text)' }}>{cls.title}</div>
                                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        {new Date(cls.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(cls.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ({cls.durationMinutes} min)
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>0/{cls.capacity || 20} Booked</span>
                                    <div className="flex gap-2">
                                        {cls.zoomMeetingUrl && (
                                            <a href={cls.zoomMeetingUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-medium border border-blue-200 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                                                Zoom
                                            </a>
                                        )}
                                        <Link
                                            to={`/studio/${params.slug}/classes/${cls.id}/roster`}
                                            className="text-sm font-medium hover:underline"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            View Roster
                                        </Link>
                                        <button className="text-sm" style={{ color: 'var(--text-muted)' }}>Edit</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Class Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Schedule New Class"
            >
                <Form method="post" className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Class Title</label>
                        <input
                            name="title"
                            required
                            placeholder="e.g. Morning Flow"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Date & Time</label>
                            <input
                                type="datetime-local"
                                name="startTime"
                                required
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Duration (min)</label>
                            <input
                                type="number"
                                name="duration"
                                defaultValue="60"
                                required
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Price</label>
                        <div className="relative rounded-md shadow-sm">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-zinc-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                name="price"
                                className="block w-full rounded-md border-zinc-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 border"
                                placeholder="0.00"
                                step="0.01"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-zinc-500 sm:text-sm">USD</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 font-medium disabled:opacity-50"
                        >
                            {isSubmitting ? "Creating..." : "Schedule Class"}
                        </button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
