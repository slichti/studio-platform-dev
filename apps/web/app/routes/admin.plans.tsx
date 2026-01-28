import { useLoaderData, useFetcher } from "react-router";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { Check, RefreshCw, Plus, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useUser, useAuth } from "@clerk/react-router";

export async function loader() {
    // In a real app, you'd use the cookie token on the server
    // For client-side fetch pattern adherence in this codebase, we often load on client or defer
    // But let's try to assume we can fetch if we had auth. 
    // Since this is an admin route, we might rely on client-side fetching if SSR auth isn't fully set up with token forwarding.
    // However, Remix/RRv7 Loaders run on server. 
    // Let's return null and fetch client-side for simplicity/consistency with existing patterns if needed, 
    // but better is to standard fetch. 
    return null;
}

export default function AdminPlans() {
    const { getToken } = useAuth();
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch on mount
    useEffect(() => {
        async function load() {
            try {
                const token = await getToken();
                const res = await apiRequest('/admin/plans', token);
                if (Array.isArray(res)) setPlans(res);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load plans");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [getToken]);

    const handleSync = async () => {
        const token = await getToken();
        toast.promise(
            apiRequest('/admin/plans/sync', token, { method: 'POST' }),
            {
                loading: 'Syncing with Stripe...',
                success: (data: any) => {
                    // Reload plans
                    apiRequest('/admin/plans', token).then((res: any) => setPlans(res));
                    return `Synced ${data.synced || 0} prices`;
                },
                error: 'Sync failed'
            }
        );
    };

    const handleUpdate = async (planId: string, data: any) => {
        const token = await getToken();
        try {
            await apiRequest(`/admin/plans/${planId}`, token, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            toast.success("Plan updated");
            // Update local state
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...data } : p));
        } catch (e) {
            toast.error("Update failed");
        }
    };

    // Inline Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});

    const startEdit = (plan: any) => {
        setEditingId(plan.id);
        setEditForm({
            name: plan.name,
            trialDays: plan.trialDays,
            features: JSON.stringify(plan.features || [], null, 2), // JSON Editing for simplicity
            active: plan.active
        });
    };

    const saveEdit = async () => {
        try {
            const parsedFeatures = JSON.parse(editForm.features);
            await handleUpdate(editingId!, {
                name: editForm.name,
                trialDays: parseInt(editForm.trialDays),
                features: parsedFeatures,
                active: editForm.active
            });
            setEditingId(null);
        } catch (e) {
            toast.error("Invalid JSON for features");
        }
    };

    const StatusBadge = ({ active }: { active: boolean }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {active ? 'Active' : 'Inactive'}
        </span>
    );

    if (loading) return <div className="p-10">Loading plans...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Platform Plans</h1>
                    <p className="text-zinc-500">Manage SaaS tiers, pricing, and features.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSync} className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-700 font-medium transition-colors">
                        <RefreshCw size={16} /> Sync Stripe
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 font-medium transition-colors">
                        <Plus size={16} /> New Plan
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Pricing (Stripe)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Trial</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Features</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                        {plans.map((plan) => (
                            <tr key={plan.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === plan.id ? (
                                        <input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="border rounded px-2 py-1 w-full"
                                        />
                                    ) : (
                                        <div>
                                            <div className="font-medium text-zinc-900">{plan.name}</div>
                                            <div className="text-xs text-zinc-500 font-mono">{plan.slug}</div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-zinc-900">
                                        Wait: {plan.monthlyPriceCents ? `$${plan.monthlyPriceCents / 100}/mo` : 'Free'}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        Annual: {plan.annualPriceCents ? `$${plan.annualPriceCents / 100}/yr` : 'Free'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                    {editingId === plan.id ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={editForm.trialDays}
                                                onChange={e => setEditForm({ ...editForm, trialDays: e.target.value })}
                                                className="border rounded px-2 py-1 w-16"
                                            /> days
                                        </div>
                                    ) : (
                                        `${plan.trialDays} Days`
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-zinc-500 max-w-xs truncate">
                                    {editingId === plan.id ? (
                                        <textarea
                                            value={editForm.features}
                                            onChange={e => setEditForm({ ...editForm, features: e.target.value })}
                                            className="border rounded px-2 py-1 w-full h-20 text-xs font-mono"
                                        />
                                    ) : (
                                        <span>{(plan.features || []).length} features configured</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === plan.id ? (
                                        <select
                                            value={editForm.active ? 'true' : 'false'}
                                            onChange={e => setEditForm({ ...editForm, active: e.target.value === 'true' })}
                                            className="border rounded px-2 py-1"
                                        >
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
                                    ) : (
                                        <StatusBadge active={plan.active} />
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {editingId === plan.id ? (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={saveEdit} className="text-green-600 hover:text-green-900"><Check size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEdit(plan)} className="text-blue-600 hover:text-blue-900">
                                            <Edit3 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
