// @ts-ignore
import { Link, useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState, Fragment } from "react";
import { useAuth } from "@clerk/react-router";
import { Modal } from "../components/Modal";
import { ErrorDialog, ConfirmationDialog } from "../components/Dialogs";
import { ChevronDown, ChevronRight, Activity, CreditCard, Video, Monitor } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const tenants = await apiRequest("/admin/tenants", token);
        return { tenants, error: null };
    } catch (e: any) {
        console.error("Loader failed", e);
        return {
            tenants: [],
            error: e.message || "Unauthorized",
            debug: e.data?.debug
        };
    }
};

export default function AdminTenants() {
    const { tenants: initialTenants } = useLoaderData<any>();
    const [tenants, setTenants] = useState(initialTenants);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Feature Toggles State
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [tenantFeatures, setTenantFeatures] = useState<Record<string, any>>({});
    const [tenantStats, setTenantStats] = useState<any>({});
    const [featuresLoading, setFeaturesLoading] = useState(false);

    const FEATURES = [
        { key: 'financials', label: 'Financials & Payouts', icon: CreditCard },
        { key: 'vod', label: 'Video on Demand', icon: Video },
        { key: 'zoom', label: 'Zoom Integration', icon: Monitor }, // Placeholder for now
    ];

    // Dialog State
    const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: "" });
    const [successDialog, setSuccessDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: "" });

    const { getToken } = useAuth();
    const navigate = useNavigate();

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        ownerEmail: "", // In a real app we'd look up user or create invite
        plan: "basic"
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = await getToken();
            const res: any = await apiRequest("/admin/tenants", token, {
                method: "POST",
                body: JSON.stringify({
                    name: formData.name,
                    slug: formData.slug,
                    ownerEmail: formData.ownerEmail,
                    tier: formData.plan
                })
            });

            if (res.error) {
                setErrorDialog({ isOpen: true, message: res.error });
            } else {
                setTenants([...tenants, res.tenant]);
                setIsCreateOpen(false);
                setFormData({ name: "", slug: "", ownerEmail: "", plan: "basic" });
                setSuccessDialog({ isOpen: true, message: `Tenant ${res.tenant.name} (${res.tenant.slug}) has been provisioned successfully.` });
            }
        } catch (e: any) {
            console.error(e);
            setErrorDialog({ isOpen: true, message: e.message || "Failed to create tenant. Please try again." });
        } finally {
            setLoading(false);
        }
    };


    const handleStatusChange = async (tenantId: string, newStatus: string) => {
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantId}/status`, token, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });

            if (res.error) {
                setErrorDialog({ isOpen: true, message: res.error });
            } else {
                setTenants(tenants.map((t: any) => t.id === tenantId ? { ...t, status: newStatus } : t));
                setSuccessDialog({ isOpen: true, message: `Tenant status updated to ${newStatus}.` });
            }
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message || "Failed to update status." });
        }
    };


    const toggleTenantExpand = async (tenantId: string) => {
        if (expandedTenant === tenantId) {
            setExpandedTenant(null);
            return;
        }

        setExpandedTenant(tenantId);
        setFeaturesLoading(true);
        try {
            const token = await getToken();
            const [featuresRes, statsRes]: [any, any] = await Promise.all([
                apiRequest(`/admin/tenants/${tenantId}/features`, token),
                apiRequest(`/admin/tenants/${tenantId}/stats`, token) // New endpoint I added in admin.ts
            ]);
            setTenantFeatures(featuresRes.features || {});
            setTenantStats(statsRes || {});
        } catch (e) {
            console.error(e);
        } finally {
            setFeaturesLoading(false);
        }
    };

    // ... handleFeatureToggle ...

    const handleFeatureToggle = async (tenantId: string, featureKey: string, currentValue: boolean) => {
        // Optimistic Update
        setTenantFeatures(prev => ({
            ...prev,
            [featureKey]: { ...prev[featureKey], enabled: !currentValue, source: 'manual' }
        }));

        try {
            const token = await getToken();
            await apiRequest(`/admin/tenants/${tenantId}/features`, token, {
                method: 'POST',
                body: JSON.stringify({ featureKey, enabled: !currentValue, source: 'manual' })
            });
        } catch (e) {
            console.error(e);
            // Revert on error
            setTenantFeatures(prev => ({
                ...prev,
                [featureKey]: { ...prev[featureKey], enabled: currentValue }
            }));
        }
    };

    return (
        <div>
            {/* Dialogs */}
            <ErrorDialog
                isOpen={errorDialog.isOpen}
                onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })}
                title="Error"
                message={errorDialog.message}
            />
            <ConfirmationDialog
                isOpen={successDialog.isOpen}
                onClose={() => setSuccessDialog({ ...successDialog, isOpen: false })}
                onConfirm={() => setSuccessDialog({ ...successDialog, isOpen: false })}
                title="Success"
                message={successDialog.message}
                confirmText="Done"
                cancelText="Close"
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Tenant Management</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                    <span className="text-lg">+</span> Spin Up Tenant
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                {/* Error Display */}
                {(tenants as any)?.error && (
                    <div className="p-4 bg-red-50 text-red-700 border-b border-red-100 mb-4">
                        <div className="font-bold">Access Denied: {(tenants as any).error}</div>
                        {(tenants as any).debug && (
                            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                                {JSON.stringify((tenants as any).debug, null, 2)}
                            </pre>
                        )}
                        <p className="text-xs mt-2">Try refreshing to re-trigger admin bootstrapping.</p>
                    </div>
                )}

                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="w-8"></th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tenant</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Slug</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tier</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Stats</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {Array.isArray(tenants) && tenants.map((t: any) => (
                            <Fragment key={t.id}>
                                <tr key={t.id} className="hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => toggleTenantExpand(t.id)}>
                                    <td className="pl-4">
                                        {expandedTenant === t.id ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-zinc-900">{t.name}</td>
                                    <td className="px-6 py-4 text-zinc-600 font-mono text-xs bg-zinc-100 rounded self-start inline-block px-1 mt-1">{t.slug}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide border ${t.tier === 'scale' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                            t.tier === 'growth' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                'bg-zinc-100 text-zinc-600 border-zinc-200'
                                            }`}>
                                            {t.tier || 'basic'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-4 justify-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Own</span>
                                                <span className="text-sm font-bold text-zinc-700">{t.stats?.owners || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Inst</span>
                                                <span className="text-sm font-bold text-zinc-700">{t.stats?.instructors || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Subs</span>
                                                <span className="text-sm font-bold text-blue-600">{t.stats?.subscribers || 0}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${t.status === 'suspended' ? 'bg-red-100 text-red-800' :
                                            t.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                            {t.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <Link
                                                to={`/studio/${t.slug}`}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold uppercase tracking-wide border border-blue-200 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
                                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                            >
                                                Enter
                                            </Link>
                                            <div className="h-4 w-px bg-zinc-200"></div>

                                            {t.status === 'paused' ? (
                                                <button
                                                    className="text-emerald-600 hover:text-emerald-700 text-xs font-medium transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, 'active'); }}
                                                >
                                                    Resume
                                                </button>
                                            ) : (
                                                <button
                                                    className="text-zinc-500 hover:text-amber-600 text-xs font-medium transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, 'paused'); }}
                                                >
                                                    Pause
                                                </button>
                                            )}

                                            {t.status === 'suspended' ? (
                                                <button
                                                    className="text-emerald-600 hover:text-emerald-700 text-xs font-medium transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, 'active'); }}
                                                >
                                                    Activate
                                                </button>
                                            ) : (
                                                <button
                                                    className="text-zinc-500 hover:text-red-600 text-xs font-medium transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, 'suspended'); }}
                                                >
                                                    Suspend
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedTenant === t.id && (
                                    <tr className="bg-zinc-50/50">
                                        <td colSpan={7} className="px-6 pb-6 pt-2">
                                            <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-inner">
                                                <h4 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                                                    <Activity size={16} /> Entitlements & Features
                                                </h4>

                                                {featuresLoading ? (
                                                    <div className="text-sm text-zinc-500 py-2">Loading capabilities...</div>
                                                ) : (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {FEATURES.map(f => {
                                                                const state = tenantFeatures[f.key] || { enabled: false, source: 'manual' };
                                                                return (
                                                                    <div key={f.key} className="flex items-center justify-between p-3 border rounded-md bg-zinc-50">
                                                                        <div className="flex items-center gap-3">
                                                                            <f.icon size={18} className="text-zinc-500" />
                                                                            <div>
                                                                                <div className="text-sm font-medium text-zinc-900">{f.label}</div>
                                                                                <div className="text-xs text-zinc-500">Source: {state.source}</div>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleFeatureToggle(t.id, f.key, state.enabled);
                                                                            }}
                                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${state.enabled ? 'bg-blue-600' : 'bg-gray-200'
                                                                                }`}
                                                                        >
                                                                            <span
                                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.enabled ? 'translate-x-6' : 'translate-x-1'
                                                                                    }`}
                                                                            />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Usage Stats (New Section) */}
                                                        <div>
                                                            <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Usage Metrics</h5>
                                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                                <div className="bg-zinc-50 p-3 rounded-md border border-zinc-200">
                                                                    <p className="text-xs text-zinc-500 mb-1">Emails Sent</p>
                                                                    <p className="text-xl font-bold text-zinc-900">{tenantStats.emailCount || 0}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
                {(!Array.isArray(tenants) || tenants.length === 0) && (
                    <div className="p-8 text-center text-zinc-500">
                        No tenants found. Create one to get started.
                    </div>
                )}
            </div>

            {/* Create Tenant Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Spin Up New Tenant"
            >
                <div className="mb-6">
                    <p className="text-zinc-500 text-sm">
                        Automated provisioning: This will create a database record, set up initial owner permissions, and allocate resources.
                    </p>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Studio Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Zen Garden Yoga"
                            value={formData.name}
                            onChange={(e) => {
                                const newName = e.target.value;
                                setFormData(prev => {
                                    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '-');
                                    const expectedSlug = slugify(prev.name);
                                    const isAuto = !prev.slug || prev.slug === expectedSlug;

                                    return {
                                        ...prev,
                                        name: newName,
                                        slug: isAuto ? slugify(newName) : prev.slug
                                    };
                                });
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">URL Slug</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 text-zinc-500 text-sm">
                                /studio/
                            </span>
                            <input
                                type="text"
                                required
                                className="flex-1 px-3 py-2 border border-zinc-300 rounded-r-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                placeholder="zen-garden"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Owner Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="owner@example.com"
                            value={formData.ownerEmail}
                            onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                        />
                        <p className="text-xs text-zinc-500 mt-1">We'll link to an existing user or create a placeholder.</p>
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
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                        >
                            {loading ? "Provisioning..." : "Launch Studio"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
