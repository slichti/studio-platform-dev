import { ActionFunction, LoaderFunction } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext, useSubmit } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { Modal } from "../components/Modal";
import { CardCreator } from "../components/CardCreator";
import { useAuth } from "@clerk/react-router";

// Loader: Fetch plans
export const loader: LoaderFunction = async (args) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const plans = await apiRequest("/memberships/plans", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { plans };
    } catch (e: any) {
        console.error("Failed to load plans", e);
        return { plans: [], error: e.message };
    }
};

// Action: Create Plan
export const action: ActionFunction = async (args) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();

    console.log("Submitting Membership Plan:", { slug: params.slug });

    const name = formData.get("name");
    const price = Number(formData.get("price") || 0) * 100; // Convert to cents
    const interval = formData.get("interval");
    const description = formData.get("description");
    const imageUrl = formData.get("imageUrl");
    const overlayTitle = formData.get("overlayTitle");
    const overlaySubtitle = formData.get("overlaySubtitle");

    try {
        const result = await apiRequest("/memberships/plans", token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({
                name,
                price,
                interval,
                description,
                imageUrl,
                overlayTitle,
                overlaySubtitle
            })
        });
        console.log("Membership Plan Created:", result);
        return { success: true };
    } catch (e: any) {
        console.error("Failed to create membership plan:", e);
        return { error: e.message };
    }
};

export default function StudioMemberships() {
    const { plans, error } = useLoaderData<any>();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const submit = useSubmit();
    const { getToken } = useAuth();

    // Card Creator State
    const [cardData, setCardData] = useState<{ image: Blob | null, title: string, subtitle: string, previewUrl: string }>({
        image: null, title: '', subtitle: '', previewUrl: ''
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (actionData?.success && !isSubmitting) {
            setIsCreateOpen(false);
            setCardData({ image: null, title: '', subtitle: '', previewUrl: '' });
        }
    }, [actionData, isSubmitting]);

    const handleCreateWrapper = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUploading(true);

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            // Upload Image if present
            if (cardData.image) {
                const token = await getToken();
                const slug = window.location.pathname.split('/')[2];
                const uploadFormData = new FormData();
                const file = new File([cardData.image], "card.jpg", { type: "image/jpeg" });
                uploadFormData.append('file', file);

                // Use configured API URL or fallback
                const apiUrl = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
                const res = await fetch(`${apiUrl}/uploads/r2-image`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Tenant-Slug': slug
                    },
                    body: uploadFormData
                });

                if (!res.ok) throw new Error("Image upload failed");
                const data = await res.json();
                formData.append('imageUrl', data.url);
            }

            // Append Overlay Text
            formData.append('overlayTitle', cardData.title);
            formData.append('overlaySubtitle', cardData.subtitle);

            submit(formData, { method: "post" });
        } catch (err) {
            console.error(err);
            alert("Failed to create plan: " + err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ color: 'var(--text)' }}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Memberships</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    style={{ background: 'var(--accent)', color: 'white' }}
                    className="px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium"
                >
                    + New Plan
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    Failed to load plans: {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {plans.length === 0 ? (
                    <div style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border)' }} className="col-span-full text-center p-12 rounded-lg">
                        <h3 className="font-medium mb-1" style={{ color: 'var(--text)' }}>No Membership Plans</h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Create tiers like "Unlimited" or "10-Pack" for your students.</p>
                        <button onClick={() => setIsCreateOpen(true)} className="text-blue-600 hover:underline">Create first plan</button>
                    </div>
                ) : (
                    plans.map((plan: any) => (
                        <div key={plan.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="rounded-lg shadow-sm transition-colors overflow-hidden group">
                            {/* Card Header Image */}
                            <div className="relative h-48 w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                {plan.imageUrl ? (
                                    <img src={plan.imageUrl} alt={plan.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                        No Image
                                    </div>
                                )}

                                {/* Overlay Text */}
                                {(plan.overlayTitle || plan.overlaySubtitle) && (
                                    <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center text-center p-4">
                                        <div className="bg-white/90 dark:bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg max-w-[90%]">
                                            {plan.overlayTitle && <h3 className="font-bold text-lg text-zinc-900 dark:text-white uppercase tracking-wider">{plan.overlayTitle}</h3>}
                                            {plan.overlaySubtitle && <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">{plan.overlaySubtitle}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6">
                                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{plan.name}</h3>
                                <div className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>
                                    ${(plan.price / 100).toFixed(2)}
                                    <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/{plan.interval}</span>
                                </div>
                                <p className="text-sm mb-6 min-h-[40px]" style={{ color: 'var(--text-muted)' }}>{plan.description || "No description provided."}</p>
                                <button style={{ border: '1px solid var(--border)', color: 'var(--text)' }} className="w-full py-2 rounded hover:opacity-80 font-medium text-sm">
                                    Edit Plan
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* List Active Subscriptions (Placeholder for now) */}
            <h3 className="text-lg font-bold mb-4">Active Subscriptions</h3>
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shadow-sm">
                <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                    No active subscriptions yet. Assign a plan to a student to see it here.
                </div>
            </div>

            {/* Create Plan Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Create Membership Plan"
                maxWidth="max-w-4xl" // Wider for card creator
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Card Visuals */}
                    <div>
                        <h4 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Card Appearance</h4>
                        <CardCreator
                            onChange={setCardData}
                        />
                    </div>

                    {/* Right: Plan Details */}
                    <Form method="post" onSubmit={handleCreateWrapper} className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Plan Details</h4>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Plan Name (Internal)</label>
                            <input
                                name="name"
                                required
                                placeholder="e.g. Gold Unlimited"
                                style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
                                className="w-full px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Price ($)</label>
                                <input
                                    type="number"
                                    name="price"
                                    step="0.01"
                                    required
                                    style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
                                    className="w-full px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Interval</label>
                                <select name="interval" style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }} className="w-full px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <option value="month">Monthly</option>
                                    <option value="week">Weekly</option>
                                    <option value="year">Yearly</option>
                                    <option value="one_time">One Time</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
                            <textarea
                                name="description"
                                rows={3}
                                style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
                                className="w-full px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                                className="flex-1 px-4 py-2 rounded-md hover:opacity-80 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || uploading}
                                style={{ background: 'var(--accent)', color: 'white' }}
                                className="flex-1 px-4 py-2 rounded-md hover:opacity-90 font-medium disabled:opacity-50"
                            >
                                {uploading ? "Uploading..." : (isSubmitting ? "Creating..." : "Create Plan")}
                            </button>
                        </div>
                    </Form>
                </div>
            </Modal>
        </div>
    );
}
