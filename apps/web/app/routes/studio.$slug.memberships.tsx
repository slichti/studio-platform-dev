import { ActionFunction, LoaderFunction } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { Modal } from "../components/Modal";

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

    const name = formData.get("name");
    const price = Number(formData.get("price") || 0) * 100; // Convert to cents
    const interval = formData.get("interval");
    const description = formData.get("description");

    try {
        await apiRequest("/memberships/plans", token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({
                name,
                price,
                interval,
                description
            })
        });
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
};

export default function StudioMemberships() {
    const { plans, error } = useLoaderData<any>();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        if (actionData?.success && !isSubmitting) {
            setIsCreateOpen(false);
        }
    }, [actionData, isSubmitting]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Memberships</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800 text-sm font-medium"
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
                    <div className="col-span-full text-center p-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
                        <h3 className="text-zinc-900 font-medium mb-1">No Membership Plans</h3>
                        <p className="text-zinc-500 text-sm mb-4">Create tiers like "Unlimited" or "10-Pack" for your students.</p>
                        <button onClick={() => setIsCreateOpen(true)} className="text-blue-600 hover:underline">Create first plan</button>
                    </div>
                ) : (
                    plans.map((plan: any) => (
                        <div key={plan.id} className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm hover:border-zinc-300 transition-colors">
                            <h3 className="font-bold text-lg text-zinc-900 mb-2">{plan.name}</h3>
                            <div className="text-2xl font-bold mb-4">
                                ${(plan.price / 100).toFixed(2)}
                                <span className="text-sm font-normal text-zinc-500">/{plan.interval}</span>
                            </div>
                            <p className="text-zinc-600 text-sm mb-6 min-h-[40px]">{plan.description || "No description provided."}</p>
                            <button className="w-full py-2 border border-zinc-300 rounded hover:bg-zinc-50 font-medium text-sm text-zinc-700">
                                Edit Plan
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* List Active Subscriptions (Placeholder for now) */}
            <h3 className="text-lg font-bold mb-4">Active Subscriptions</h3>
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                <div className="p-8 text-center text-zinc-500">
                    No active subscriptions yet. Assign a plan to a student to see it here.
                </div>
            </div>

            {/* Create Plan Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Create Membership Plan"
            >
                <Form method="post" className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Plan Name</label>
                        <input
                            name="name"
                            required
                            placeholder="e.g. Gold Unlimited"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-zinc-900"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Price ($)</label>
                            <input
                                type="number"
                                name="price"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-zinc-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Interval</label>
                            <select name="interval" className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-zinc-900">
                                <option value="month">Monthly</option>
                                <option value="week">Weekly</option>
                                <option value="year">Yearly</option>
                                <option value="one_time">One Time</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                        <textarea
                            name="description"
                            rows={3}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-zinc-900"
                        />
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
                            {isSubmitting ? "Create Plan" : "Create Plan"}
                        </button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
