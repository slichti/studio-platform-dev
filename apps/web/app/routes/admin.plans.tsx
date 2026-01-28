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

    const KNOWN_FEATURES = {
        "Core Features": [
            "Unlimited Students",
            "Basic Financials & Reporting",
            "Waiver Management",
            "Visual Website Builder",
            "Retail Point of Sale (POS)",
            "Transactional Email Notifications",
            "Class Packs & Drop-ins"
        ],
        "Growth & Marketing": [
            "Zoom Integration (Auto-Meeting)",
            "Video on Demand (VOD)",
            "Marketing Automations (Win-back, Welcome)",
            "Inventory Tracking & Low Stock Alerts",
            "SMS Notifications & Marketing",
            "Recurring Memberships"
        ],
        "Scale & Enterprise": [
            "White Label Branding Options",
            "API Access",
            "Priority Support",
            "Dedicated Account Manager",
            "0% Platform Fees"
        ],
        "Common Limits": [
            "5 Instructors", "15 Instructors", "Unlimited Instructors",
            "1 Location", "3 Locations", "Unlimited Locations",
            "5GB Storage", "50GB Storage", "1TB Video Storage"
        ]
    };

    // Feature List Editor Component
    const FeatureListEditor = ({ features, onChange }: { features: string[], onChange: (f: string[]) => void }) => {
        const [newFeature, setNewFeature] = useState("");
        const [showLibrary, setShowLibrary] = useState(false);

        const addFeature = (feat: string) => {
            const val = feat.trim();
            if (val && !features.includes(val)) {
                onChange([...features, val]);
                setNewFeature("");
            }
        };

        const removeFeature = (index: number) => {
            onChange(features.filter((_, i) => i !== index));
        };

        return (
            <div className="space-y-3 min-w-[400px]">
                {/* Active Features List */}
                <div className="space-y-2">
                    {features.map((feature, i) => (
                        <div key={i} className="flex gap-2 group">
                            <div className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded text-sm flex items-center justify-between shadow-sm">
                                <span>{feature}</span>
                                <button
                                    onClick={() => removeFeature(i)}
                                    className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {features.length === 0 && <div className="text-zinc-400 text-sm italic py-2">No features added yet.</div>}
                </div>

                {/* Input Area */}
                <div className="flex gap-2">
                    <input
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature(newFeature))}
                        className="flex-1 border border-zinc-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Type functionality or limit..."
                    />
                    <button
                        onClick={() => addFeature(newFeature)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 rounded transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Library Toggle */}
                <div className="pt-2 border-t border-zinc-100">
                    <button
                        onClick={() => setShowLibrary(!showLibrary)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        {showLibrary ? "Hide Feature Library" : "+ Add from Feature Library"}
                    </button>

                    {showLibrary && (
                        <div className="mt-3 grid grid-cols-1 gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-lg shadow-inner max-h-[300px] overflow-y-auto">
                            {Object.entries(KNOWN_FEATURES).map(([category, items]) => (
                                <div key={category}>
                                    <h5 className="font-bold text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{category}</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {items.map(item => {
                                            const isActive = features.includes(item);
                                            return (
                                                <button
                                                    key={item}
                                                    onClick={() => !isActive && addFeature(item)}
                                                    disabled={isActive}
                                                    className={`text-xs px-2 py-1.5 rounded border transition-all text-left
                                                        ${isActive
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-default opactiy-70'
                                                            : 'bg-white border-zinc-200 hover:border-blue-300 hover:shadow-sm text-zinc-700 hover:translate-y-[-1px]'
                                                        }`}
                                                >
                                                    {isActive && <Check size={10} className="inline mr-1" />}
                                                    {item}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Inline Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});

    const startEdit = (plan: any) => {
        setEditingId(plan.id);
        const features = Array.isArray(plan.features) ? plan.features : [];
        setEditForm({
            name: plan.name,
            trialDays: plan.trialDays,
            features: features,
            active: plan.active
        });
    };

    const saveEdit = async () => {
        try {
            // Features are already an array in state now
            await handleUpdate(editingId!, {
                name: editForm.name,
                trialDays: parseInt(editForm.trialDays),
                features: editForm.features,
                active: editForm.active
            });
            setEditingId(null);
        } catch (e) {
            toast.error("Update failed");
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
                    {/* New Plan button could be implemented similarly */}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Pricing (Stripe)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Trial</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-1/3">Features</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                        {plans.map((plan) => (
                            <tr key={plan.id} className="hover:bg-zinc-50 transition-colors align-top">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === plan.id ? (
                                        <input
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="border rounded px-2 py-1 w-full font-medium"
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
                                <td className="px-6 py-4 text-sm text-zinc-500">
                                    {editingId === plan.id ? (
                                        <FeatureListEditor
                                            features={editForm.features}
                                            onChange={(f) => setEditForm({ ...editForm, features: f })}
                                        />
                                    ) : (
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {(plan.features || []).map((f: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <Check size={12} className="mt-0.5 text-green-500 flex-shrink-0" />
                                                    <span>{f}</span>
                                                </div>
                                            ))}
                                            {(plan.features || []).length === 0 && <span className="text-zinc-400 italic">No features configured</span>}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === plan.id ? (
                                        <select
                                            value={editForm.active ? 'true' : 'false'}
                                            onChange={e => setEditForm({ ...editForm, active: e.target.value === 'true' })}
                                            className="border rounded px-2 py-1 text-sm"
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
                                            <button onClick={saveEdit} className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded"><Check size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-50 p-1 rounded"><X size={18} /></button>
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
