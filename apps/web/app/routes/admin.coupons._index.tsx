
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Card } from "~/components/ui/Card";
import { toast } from "sonner";
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    const coupons = await apiRequest("/coupons", token, {}, apiUrl);
    return { coupons, apiUrl, token };
};

export default function CouponsPage() {
    const { coupons, apiUrl, token } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        type: 'percent', // percent | amount
        value: 10,
        usageLimit: '',
        expiresAt: ''
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiRequest("/coupons", token, {
                method: "POST",
                body: JSON.stringify({
                    ...formData,
                    value: Number(formData.value),
                    usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
                    expiresAt: formData.expiresAt || null
                })
            }, apiUrl);
            toast.success("Coupon created");
            setIsCreateOpen(false);
            setFormData({ code: '', type: 'percent', value: 10, usageLimit: '', expiresAt: '' });
            revalidator.revalidate();
        } catch (err: any) {
            toast.error(err.message || "Failed to create coupon");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await apiRequest(`/coupons/${id}`, token, { method: "DELETE" }, apiUrl);
            toast.success("Coupon deleted/archived");
            revalidator.revalidate();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Coupons</h1>
                    <p className="text-zinc-500">Manage discount codes and promotions.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                    + Create Coupon
                </button>
            </div>

            <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-3 font-medium text-zinc-500">Code</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Discount</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Usage</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Expires</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Status</th>
                            <th className="px-6 py-3 font-medium text-zinc-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {coupons.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                                    No coupons found. Create one to get started.
                                </td>
                            </tr>
                        ) : (
                            coupons.map((c: any) => (
                                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <td className="px-6 py-4 font-mono font-medium">{c.code}</td>
                                    <td className="px-6 py-4">
                                        {c.type === 'percent' ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.redemptions} {c.usageLimit ? `/ ${c.usageLimit}` : '(Unlimited)'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.expiresAt ? format(new Date(c.expiresAt), 'MMM d, yyyy') : 'Never'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                            }`}>
                                            {c.active ? 'Active' : 'Archived'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-800">
                        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-semibold text-lg">Create Coupon</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-zinc-500 hover:text-zinc-700">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Coupon Code</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent uppercase font-mono"
                                    placeholder="SUMMER2025"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="amount">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Value</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        value={formData.value}
                                        onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Usage Limit</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        placeholder="Unlimited"
                                        value={formData.usageLimit}
                                        onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Expires At</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        value={formData.expiresAt}
                                        onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Coupon'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
