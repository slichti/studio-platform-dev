// @ts-ignore
import { useLoaderData, useOutletContext } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Ticket, Plus, Trash2, Tag, AlertCircle } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken, userId } = await getAuth(args);
    if (!userId) return { error: "Unauthorized" };

    const token = await getToken();
    try {
        const res: any = await apiRequest("/commerce/coupons", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { coupons: res.coupons || [], error: null };
    } catch (e) {
        return { coupons: [], error: "Failed to load coupons" };
    }
};

export default function CouponsPage() {
    const { coupons: initialCoupons, error } = useLoaderData<typeof loader>();
    const { tenant, isStudentView } = useOutletContext<any>() || {};

    return <CouponsView initialCoupons={initialCoupons} tenant={tenant} isStudentView={isStudentView} />;
}

import { useAuth } from "@clerk/react-router";

function CouponsView({ initialCoupons, tenant, isStudentView }: any) {
    const [coupons, setCoupons] = useState(initialCoupons || []);
    const [loading, setLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState({ code: '', type: 'percent', value: '', usageLimit: '' });
    const { getToken } = useAuth();

    const fetchCoupons = async () => {
        const token = await getToken();
        // If student, this might need a different endpoint or the API handles it. 
        // For now using the same endpoint but filtered by UI permissions.
        const res: any = await apiRequest("/commerce/coupons", token, {
            headers: { 'X-Tenant-Slug': tenant.slug }
        });
        setCoupons(res.coupons || []);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/commerce/coupons", token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify(form)
            });

            if (res.error) throw new Error(res.error);

            setIsCreateOpen(false);
            setForm({ code: '', type: 'percent', value: '', usageLimit: '' });
            await fetchCoupons();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm("Are you sure you want to deactivate this coupon?")) return;
        setLoading(true);
        try {
            const token = await getToken();
            await apiRequest(`/commerce/coupons/${id}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            await fetchCoupons();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center">
                        <Tag className="text-pink-600 dark:text-pink-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{isStudentView ? "My Coupons" : "Coupons"}</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                            {isStudentView ? "View available discount codes." : "Manage discounts and promotional codes."}
                        </p>
                    </div>
                </div>
                {!isStudentView && (
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-500/10 flex items-center gap-2"
                    >
                        <Plus size={16} /> New Coupon
                    </button>
                )}
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Create Coupon</h3>
                        <form onSubmit={handleCreate}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Coupon Code</label>
                                <input
                                    type="text"
                                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                                    placeholder="e.g. SUMMER25"
                                    value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Type</label>
                                    <select
                                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="amount">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Value</label>
                                    <input
                                        type="number"
                                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                                        placeholder={form.type === 'percent' ? "e.g. 10" : "e.g. 1000 (cents)"}
                                        value={form.value}
                                        onChange={e => setForm({ ...form, value: e.target.value })}
                                        required
                                        min="1"
                                    />
                                    <p className="text-[10px] text-zinc-400 mt-1">
                                        {form.type === 'amount' ? 'In cents (e.g. 1000 = $10.00)' : 'Percentage value (1-100)'}
                                    </p>
                                </div>
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Usage Limit (Optional)</label>
                                <input
                                    type="number"
                                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                                    placeholder="Unlimited"
                                    value={form.usageLimit}
                                    onChange={e => setForm({ ...form, usageLimit: e.target.value })}
                                    min="1"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Coupon'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                {coupons.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                        <Tag className="mx-auto h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-zinc-900 dark:text-zinc-100 font-bold mb-1">No Coupons Yet</h3>
                        <p className="text-sm">Create your first discount code to get started.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Code</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Discount</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Usage Limit</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Status</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {coupons.map((coupon: any) => (
                                <tr key={coupon.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                        {coupon.code}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                                        {coupon.type === 'percent' ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                                {coupon.value}% OFF
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
                                                ${(coupon.value / 100).toFixed(2)} OFF
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {coupon.usageCount || 0} / {coupon.usageLimit ? coupon.usageLimit : '∞'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {coupon.active ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500">
                                                Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {coupon.active && !isStudentView && (
                                            <button
                                                onClick={() => handleDeactivate(coupon.id)}
                                                disabled={loading}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Deactivate Coupon"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
