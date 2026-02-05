
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

    // Use Admin API Route
    try {
        const coupons = await apiRequest("/admin/coupons", token, {}, apiUrl);
        return { coupons: Array.isArray(coupons) ? coupons : [], apiUrl, token };
    } catch (e) {
        console.error("Failed to load coupons", e);
        return { coupons: [], apiUrl, token, error: "Failed to load coupons" };
    }
};

export default function CouponsPage() {
    const { coupons, apiUrl, token, error } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State (Stripe focused)
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        percent_off: '',
        amount_off: '',
        duration: 'forever', // 'forever', 'once', 'repeating'
        duration_in_months: '',
        max_redemptions: '',
        redeem_by: ''
    });

    if (error) {
        return <div className="p-8 text-red-500">Error loading coupons: {error}</div>;
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const body: any = {
                code: formData.code,
                name: formData.name || formData.code,
                duration: formData.duration
            };

            if (formData.percent_off) body.percent_off = Number(formData.percent_off);
            if (formData.amount_off) body.amount_off = Number(formData.amount_off) * 100; // Cents
            if (formData.duration === 'repeating') body.duration_in_months = Number(formData.duration_in_months);
            if (formData.max_redemptions) body.max_redemptions = Number(formData.max_redemptions);
            if (formData.redeem_by) body.redeem_by = formData.redeem_by;

            await apiRequest("/admin/coupons", token, {
                method: "POST",
                body: JSON.stringify(body)
            }, apiUrl);

            toast.success("Coupon created");
            setIsCreateOpen(false);
            setFormData({
                code: '', name: '', percent_off: '', amount_off: '',
                duration: 'forever', duration_in_months: '', max_redemptions: '', redeem_by: ''
            });
            revalidator.revalidate();
        } catch (err: any) {
            toast.error(err.message || "Failed to create coupon");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This cannot be undone.")) return;
        try {
            await apiRequest(`/admin/coupons/${id}`, token, { method: "DELETE" }, apiUrl);
            toast.success("Coupon deleted");
            revalidator.revalidate();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Platform Coupons</h1>
                    <p className="text-zinc-500">Manage Stripe discount codes for studio subscriptions.</p>
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
                            <th className="px-6 py-3 font-medium text-zinc-500">Code / Name</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Discount</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Duration</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Redemptions</th>
                            <th className="px-6 py-3 font-medium text-zinc-500">Created</th>
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
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-medium">{c.name}</div>
                                        <div className="text-xs text-zinc-500">{c.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.percent_off ? `${c.percent_off}%` : c.amount_off ? `$${(c.amount_off / 100).toFixed(2)}` : 'Unknown'}
                                    </td>
                                    <td className="px-6 py-4 capitalize">
                                        {c.duration} {c.duration_in_months ? `(${c.duration_in_months} mo)` : ''}
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.times_redeemed} {c.max_redemptions ? `/ ${c.max_redemptions}` : '(Unlimited)'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {format(new Date(c.created * 1000), 'MMM d, yyyy')}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-800">
                        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-semibold text-lg">Create Platform Coupon</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-zinc-500 hover:text-zinc-700">✕</button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Code (ID)</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent uppercase font-mono"
                                    placeholder="SUMMER2025"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Name (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                    placeholder="Summer Sale"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Discount Type</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        onChange={e => {
                                            if (e.target.value === 'percent') setFormData({ ...formData, amount_off: '' });
                                            else setFormData({ ...formData, percent_off: '' });
                                        }}
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="amount">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Value</label>
                                    {formData.amount_off === '' ? (
                                        <input
                                            type="number"
                                            placeholder="%"
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                            value={formData.percent_off}
                                            onChange={e => setFormData({ ...formData, percent_off: e.target.value, amount_off: '' })}
                                        />
                                    ) : (
                                        <input
                                            type="number"
                                            placeholder="$"
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                            value={formData.amount_off}
                                            onChange={e => setFormData({ ...formData, amount_off: e.target.value, percent_off: '' })}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Duration</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        value={formData.duration}
                                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                    >
                                        <option value="forever">Forever</option>
                                        <option value="once">Once</option>
                                        <option value="repeating">Repeating</option>
                                    </select>
                                </div>
                                <div>
                                    {formData.duration === 'repeating' && (
                                        <>
                                            <label className="block text-sm font-medium mb-1">Months</label>
                                            <input
                                                type="number"
                                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                                value={formData.duration_in_months}
                                                onChange={e => setFormData({ ...formData, duration_in_months: e.target.value })}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Max Redemptions</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        placeholder="Unlimited"
                                        value={formData.max_redemptions}
                                        onChange={e => setFormData({ ...formData, max_redemptions: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Redeem By</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        value={formData.redeem_by}
                                        onChange={e => setFormData({ ...formData, redeem_by: e.target.value })}
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
