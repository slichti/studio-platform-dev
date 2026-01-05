// @ts-ignore
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext, useSubmit } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { Modal } from "../components/Modal";
import { CardCreator } from "../components/CardCreator";
import { useAuth } from "@clerk/react-router";

// Loader: Fetch plans and subscriptions
export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const [plans, subscriptions] = await Promise.all([
            apiRequest("/memberships/plans", token, { headers: { 'X-Tenant-Slug': params.slug! } }),
            apiRequest("/memberships/subscriptions", token, { headers: { 'X-Tenant-Slug': params.slug! } })
        ]);

        return { plans: plans || [], subscriptions: subscriptions || [] };
    } catch (e: any) {
        console.error("Failed to load membership data", e);
        return { plans: [], subscriptions: [], error: e.message };
    }
};

// Action: Create, Update, Delete Plan
export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete_plan") {
        const planId = formData.get("planId");
        try {
            await apiRequest(`/memberships/plans/${planId}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': params.slug! }
            });
            return { success: true, intent: "delete_plan" };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    // Default: Create/Update
    const planId = formData.get("planId");

    const name = formData.get("name");
    const price = Number(formData.get("price") || 0) * 100;
    const interval = formData.get("interval");
    const description = formData.get("description");
    const imageUrl = formData.get("imageUrl");
    const overlayTitle = formData.get("overlayTitle");
    const overlaySubtitle = formData.get("overlaySubtitle");
    const vodEnabled = formData.get("vodEnabled") === "on";

    try {
        const url = planId ? `/memberships/plans/${planId}` : "/memberships/plans";
        const method = planId ? "PATCH" : "POST";

        const result = await apiRequest(url, token, {
            method,
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({
                name,
                price,
                interval,
                description,
                imageUrl,
                overlayTitle,
                overlaySubtitle,
                vodEnabled
            })
        });
        return { success: true, intent: planId ? "update_plan" : "create_plan" };
    } catch (e: any) {
        console.error("Failed to save membership plan:", e);
        return { error: e.message };
    }
};

export default function StudioMemberships() {
    const { plans, subscriptions, error } = useLoaderData<any>();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Modal State: Create or Edit
    const [modalState, setModalState] = useState<{ type: 'closed' } | { type: 'create' } | { type: 'edit', plan: any }>({ type: 'closed' });

    const submit = useSubmit();
    const { getToken } = useAuth(); // Clerk hook for client-side token

    // Card Creator State
    const [cardData, setCardData] = useState<{ image: Blob | null, title: string, subtitle: string, previewUrl: string }>({
        image: null, title: '', subtitle: '', previewUrl: ''
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (actionData?.success && !isSubmitting) {
            setModalState({ type: 'closed' });
            setCardData({ image: null, title: '', subtitle: '', previewUrl: '' });
        }
    }, [actionData, isSubmitting]);

    // Reset card data when modal opens
    useEffect(() => {
        if (modalState.type === 'create') {
            setCardData({ image: null, title: '', subtitle: '', previewUrl: '' });
        } else if (modalState.type === 'edit') {
            setCardData({
                image: null,
                title: modalState.plan.overlayTitle || '',
                subtitle: modalState.plan.overlaySubtitle || '',
                previewUrl: ''
            });
        }
    }, [modalState.type, modalState.type === 'edit' ? modalState.plan : null]);

    const handleCreateWrapper = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUploading(true);

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            // Upload Image if present (only if changed/new blob)
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
                const data = await res.json() as { url: string };
                formData.append('imageUrl', data.url);
            } else if (modalState.type === 'edit' && modalState.plan.imageUrl) {
                // Keep existing URL if no new image
                formData.append('imageUrl', modalState.plan.imageUrl);
            }

            // Append Overlay Text
            formData.append('overlayTitle', cardData.title);
            formData.append('overlaySubtitle', cardData.subtitle);

            if (modalState.type === 'edit') {
                formData.append('planId', modalState.plan.id);
            }

            submit(formData, { method: "post" });
        } catch (err) {
            console.error(err);
            alert("Failed to save plan: " + err);
        } finally {
            setUploading(false);
        }
    };

    const isOpen = modalState.type !== 'closed';
    const planToEdit = modalState.type === 'edit' ? modalState.plan : null;

    return (
        <div className="text-zinc-900 dark:text-zinc-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Memberships</h2>
                <button
                    onClick={() => setModalState({ type: 'create' })}
                    className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium"
                >
                    + New Plan
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded mb-4 text-sm">
                    Failed to load plans: {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {plans.length === 0 ? (
                    <div className="col-span-full text-center p-12 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700">
                        <h3 className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No Membership Plans</h3>
                        <p className="text-sm mb-4 text-zinc-500 dark:text-zinc-400">Create tiers like "Unlimited" or "10-Pack" for your students.</p>
                        <button onClick={() => setModalState({ type: 'create' })} className="text-blue-600 hover:underline">Create first plan</button>
                    </div>
                ) : (
                    plans.map((plan: any) => (
                        <div key={plan.id} className="rounded-lg shadow-sm transition-colors overflow-hidden group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
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
                                <h3 className="font-bold text-lg mb-2 text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                                <div className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
                                    ${(plan.price / 100).toFixed(2)}
                                    <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">/{plan.interval}</span>
                                </div>
                                <p className="text-sm mb-6 min-h-[40px] text-zinc-500 dark:text-zinc-400">{plan.description || "No description provided."}</p>
                                <button
                                    onClick={() => setModalState({ type: 'edit', plan })}
                                    className="w-full py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 transition-colors"
                                >
                                    Edit Plan
                                </button>
                                <Form method="post" onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                                    if (!confirm("Are you sure? This cannot be undone.")) e.preventDefault();
                                }}>
                                    <input type="hidden" name="intent" value="delete_plan" />
                                    <input type="hidden" name="planId" value={plan.id} />
                                    <button type="submit" className="w-full mt-2 text-red-600 hover:text-red-800 dark:hover:text-red-400 text-xs font-medium">
                                        Delete Plan
                                    </button>
                                </Form>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* List Active Subscriptions */}
            <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">Active Subscriptions</h3>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                {subscriptions && subscriptions.length > 0 ? (
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
                            {subscriptions.map((sub: any) => (
                                <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{sub.user.profile?.fullName || sub.user.email}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{sub.planName}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                                            }`}>
                                            {sub.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                                        {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                        No active subscriptions yet.
                    </div>
                )}
            </div>

            {/* Create/Edit Plan Modal */}
            <Modal
                isOpen={isOpen}
                onClose={() => setModalState({ type: 'closed' })}
                title={modalState.type === 'edit' ? "Edit Membership Plan" : "Create Membership Plan"}
                maxWidth="max-w-4xl"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Card Visuals */}
                    <div>
                        <h4 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Card Appearance</h4>
                        <CardCreator
                            key={planToEdit ? planToEdit.id : 'new'}
                            initialImage={planToEdit?.imageUrl}
                            initialTitle={planToEdit?.overlayTitle}
                            initialSubtitle={planToEdit?.overlaySubtitle}
                            onChange={setCardData}
                        />
                    </div>

                    {/* Right: Plan Details */}
                    <Form method="post" onSubmit={handleCreateWrapper} className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Plan Details</h4>
                            <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Plan Name (Internal)</label>
                            <input
                                name="name"
                                required
                                defaultValue={planToEdit?.name || ''}
                                placeholder="e.g. Gold Unlimited"
                                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Price ($)</label>
                                <input
                                    type="number"
                                    name="price"
                                    step="0.01"
                                    required
                                    defaultValue={planToEdit ? (planToEdit.price / 100).toFixed(2) : ''}
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Interval</label>
                                <select
                                    name="interval"
                                    defaultValue={planToEdit?.interval || 'month'}
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
                                >
                                    <option value="month">Monthly</option>
                                    <option value="week">Weekly</option>
                                    <option value="year">Yearly</option>
                                    <option value="one_time">One Time</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Description</label>
                            <textarea
                                name="description"
                                rows={3}
                                defaultValue={planToEdit?.description || ''}
                                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="vodEnabled"
                                id="vodEnabled"
                                defaultChecked={planToEdit?.vodEnabled || false}
                                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="vodEnabled" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Include VOD Access</label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">(Allows entry to On-Demand Library)</p>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setModalState({ type: 'closed' })}
                                className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || uploading}
                                className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:opacity-90 font-medium disabled:opacity-50 transition-colors"
                            >
                                {uploading ? "Uploading..." : (isSubmitting ? "Saving..." : (modalState.type === 'edit' ? "Save Changes" : "Create Plan"))}
                            </button>
                        </div>
                    </Form>
                </div>
            </Modal>
        </div>
    );
}
