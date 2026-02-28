
import { useLoaderData } from "react-router";

import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Tag, Plus, Trash } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    let coupons = [];
    try {
        const res = await apiRequest("/commerce/coupons", token, { headers: { 'X-Tenant-Slug': slug } });
        coupons = res.coupons || [];
    } catch (e) {
        console.error("Failed to load coupons", e);
    }

    return { coupons, token, slug };
};

export default function CouponsPage() {
    const { coupons: initialCoupons, token, slug } = useLoaderData<any>();
    const [coupons, setCoupons] = useState(initialCoupons);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Create Form
    const [form, setForm] = useState({ code: "", type: "percent", value: "10" });
    const [loading, setLoading] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState<string | null>(null);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        // Convert logic: if type=amount, value input "10" means 1000 cents.
        const numericVal = parseInt(form.value);
        const finalValue = form.type === 'amount' ? numericVal * 100 : numericVal;

        try {
            const res = await apiRequest("/commerce/coupons", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ ...form, value: finalValue }) // Send adjusted value
            });

            if (res.error) {
                alert(res.error);
            } else {
                // Refresh
                const refreshed = await apiRequest("/commerce/coupons", token, { headers: { 'X-Tenant-Slug': slug } });
                setCoupons(refreshed.coupons || []);
                setIsCreateOpen(false);
                setForm({ code: "", type: "percent", value: "10" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        setCouponToDelete(id);
    }

    async function handleConfirmDelete() {
        if (!couponToDelete) return;
        try {
            await apiRequest(`/commerce/coupons/${couponToDelete}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug },
            });
            // Optimistic remove
            setCoupons((prev: any[]) => prev.filter(c => c.id !== couponToDelete));
            setCouponToDelete(null);
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Coupons</h1>
                    <p className="text-zinc-500">Manage promo codes and coupons.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(!isCreateOpen)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-zinc-800"
                >
                    <Plus className="h-4 w-4" /> Create Code
                </button>
            </div>

            {isCreateOpen && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-6 mb-8">
                    <h3 className="font-semibold text-zinc-900 mb-4">New Coupon</h3>
                    <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Code</label>
                            <input
                                type="text"
                                className="w-full border border-zinc-300 rounded px-3 py-2 uppercase font-mono"
                                placeholder="SUMMER20"
                                value={form.code}
                                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Type</label>
                            <select
                                className="w-full border border-zinc-300 rounded px-3 py-2"
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                            >
                                <option value="percent">% Percent</option>
                                <option value="amount">$ Amount</option>
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Value</label>
                            <input
                                type="number"
                                className="w-full border border-zinc-300 rounded px-3 py-2"
                                placeholder="10"
                                value={form.value}
                                onChange={e => setForm({ ...form, value: e.target.value })}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? "Saving..." : "Save Coupon"}
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Code</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Value</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {coupons.map((c: any) => (
                            <tr key={c.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-zinc-400" />
                                        <span className="font-mono font-medium text-zinc-900">{c.code}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-zinc-600">
                                    {c.type === 'percent' ? `${c.value}% Off` : `$${(c.value / 100).toFixed(2)} Off`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {c.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    {c.active && (
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash className="h-4 w-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {coupons.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 italic">
                                    No coupons created yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={!!couponToDelete}
                onOpenChange={(open) => !open && setCouponToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Deactivate Coupon"
                description="Are you sure? This will deactivate the code and prevent future uses."
                confirmText="Deactivate"
                variant="destructive"
            />
        </div>
    );
}
