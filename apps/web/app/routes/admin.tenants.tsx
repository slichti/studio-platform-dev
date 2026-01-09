import { Link, useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, Fragment } from "react";
import { useAuth } from "@clerk/react-router";
import { Modal } from "../components/Modal";
import { ErrorDialog, ConfirmationDialog } from "../components/Dialogs";
import { ChevronDown, ChevronRight, Activity, CreditCard, Video, Monitor, ShoppingCart, Mail, Settings } from "lucide-react";
import { PrivacyBlur } from "../components/PrivacyBlur";

interface TenantStats {
    owners: number;
    instructors: number;
    subscribers: number;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
    tier: string;
    status: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
    billingExempt?: boolean;
    smsLimit?: number;
    emailLimit?: number;
    storageUsage: number;
    streamingUsage?: number;
    emailUsage?: number;
    stats?: TenantStats;
    zoomCredentials?: { clientId: string; accountId: string }; // Minimal type
}

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const tenants = await apiRequest<Tenant[]>("/admin/tenants", token);
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
        { key: 'pos', label: 'POS & Retail', icon: ShoppingCart },
        { key: 'marketing', label: 'Marketing & CRM', icon: Mail },
        { key: 'payroll', label: 'Payroll & Compensation', icon: CreditCard },
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

    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const [statusFilter, setStatusFilter] = useState('all');
    const [tierFilter, setTierFilter] = useState('all');

    const [showFinancials, setShowFinancials] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('admin_show_financials') === 'true';
        return false;
    });

    // Zoom Config State
    const [zoomModalOpen, setZoomModalOpen] = useState(false);
    const [zoomTenantId, setZoomTenantId] = useState<string | null>(null);
    const [zoomData, setZoomData] = useState({ accountId: '', clientId: '', clientSecret: '' });

    const openZoomConfig = (tenantId: string) => {
        setZoomTenantId(tenantId);
        setZoomData({ accountId: '', clientId: '', clientSecret: '' }); // Reset or fetch? Ideally fetch, but secrets are hidden.
        setZoomModalOpen(true);
    };

    const saveZoomCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!zoomTenantId) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${zoomTenantId}/credentials/zoom`, token, {
                method: 'PUT',
                body: JSON.stringify(zoomData)
            });

            if (res.error) throw new Error(res.error);

            setSuccessDialog({ isOpen: true, message: 'Zoom credentials updated successfully.' });
            setZoomModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const toggleFinancials = () => {
        const newValue = !showFinancials;
        setShowFinancials(newValue);
        localStorage.setItem('admin_show_financials', String(newValue));
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const sortedTenants = () => {
        if (!Array.isArray(tenants)) return [];

        let filtered = [...tenants];

        // Apply Filters
        if (statusFilter !== 'all') {
            filtered = filtered.filter((t: any) => (t.status || 'active') === statusFilter);
        }
        if (tierFilter !== 'all') {
            filtered = filtered.filter((t: any) => (t.tier || 'basic') === tierFilter);
        }

        return filtered.sort((a: any, b: any) => {
            const getVal = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
            const valA = getVal(a, sortField);
            const valB = getVal(b, sortField);

            if (valA === valB) return 0;
            const res = valA > valB ? 1 : -1;
            return sortDir === 'asc' ? res : -res;
        });
    };

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
                    tier: formData.plan,
                    trialDays: (formData as any).trialDays
                })
            });

            if (res.error) {
                setErrorDialog({ isOpen: true, message: res.error });
            } else {
                setTenants([...tenants, res]); // res returns the new tenant
                setIsCreateOpen(false);
                setFormData({ name: "", slug: "", ownerEmail: "", plan: "basic" });
                setSuccessDialog({ isOpen: true, message: `Tenant ${res.name} (${res.slug}) has been provisioned successfully.` });
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

    const handleSubscriptionUpdate = async (tenantId: string, daysToAdd: number) => {
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantId}/subscription`, token, {
                method: "PATCH",
                body: JSON.stringify({ trialDays: daysToAdd })
            });
            if (res.error) throw new Error(res.error);
            // Reload tenants to get fresh date
            const updated = await apiRequest("/admin/tenants", token);
            setTenants(updated);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        }
    };

    const handleDateUpdate = async (tenantId: string, dateStr: string) => {
        if (!dateStr) return;
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantId}/subscription`, token, {
                method: "PATCH",
                body: JSON.stringify({ currentPeriodEnd: dateStr })
            });
            if (res.error) throw new Error(res.error);
            // Reload tenants
            const updated = await apiRequest("/admin/tenants", token);
            setTenants(updated);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        }
    };

    const handleLimitUpdate = async (tenantId: string, key: string, value: any) => {
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantId}/quotas`, token, {
                method: "PATCH",
                body: JSON.stringify({ [key]: value })
            });
            if (res.error) throw new Error(res.error);
            // Optimistic update or reload
            setTenants(tenants.map((t: any) =>
                t.id === tenantId ? { ...t, [key]: value } : t
            ));
            setSuccessDialog({ isOpen: true, message: "Limits updated." });
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        }
    };


    const toggleTenantExpand = async (tenantId: string) => {
        // ... (keep existing)
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
                apiRequest(`/admin/tenants/${tenantId}/stats`, token)
            ]);
            setTenantFeatures(featuresRes.features || {});
            setTenantStats(statsRes || {});
        } catch (e) {
            console.error(e);
        } finally {
            setFeaturesLoading(false);
        }
    };

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

    // ... (keep Form Code - skipping to return block)

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
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">Tenant Management</h2>

                    {/* Filters */}
                    <div className="flex gap-2 items-center">
                        <select
                            className="text-sm border border-zinc-300 rounded-md px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="suspended">Suspended</option>
                        </select>
                        <select
                            className="text-sm border border-zinc-300 rounded-md px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={tierFilter}
                            onChange={(e) => setTierFilter(e.target.value)}
                        >
                            <option value="all">All Tiers</option>
                            <option value="basic">Launch</option>
                            <option value="growth">Growth</option>
                            <option value="scale">Scale</option>
                        </select>

                        <div className="h-6 w-px bg-zinc-300 mx-2"></div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleFinancials}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showFinancials ? 'bg-indigo-600' : 'bg-zinc-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showFinancials ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <span className="text-sm text-zinc-600 font-medium">
                                {showFinancials ? 'Financials Visible' : 'Privacy Mode'}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                    <span className="text-lg">+</span> Spin Up Tenant
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
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
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('name')}>
                                Tenant {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('tier')}>
                                Tier {sortField === 'tier' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('stats.owners')}>
                                People {sortField === 'stats.owners' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('storageUsage')}>
                                Usage {sortField === 'storageUsage' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-100" onClick={() => handleSort('status')}>
                                Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {sortedTenants().map((t: any) => (
                            <Fragment key={t.id}>
                                <tr className="hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => toggleTenantExpand(t.id)}>
                                    <td className="pl-4">
                                        {expandedTenant === t.id ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900">{t.name}</div>
                                        <div className="text-zinc-500 text-xs font-mono mt-0.5 bg-zinc-100 inline-block px-1 rounded">{t.slug}</div>
                                    </td>
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
                                            <div className="flex flex-col items-center" title="Owners">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Own</span>
                                                <span className="text-sm font-bold text-zinc-700">{t.stats?.owners || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center" title="Instructors">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Inst</span>
                                                <span className="text-sm font-bold text-zinc-700">{t.stats?.instructors || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center" title="Subscribers">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Subs</span>
                                                <PrivacyBlur revealed={showFinancials} placeholder="***">
                                                    <span className="text-sm font-bold text-blue-600">{t.stats?.subscribers || 0}</span>
                                                </PrivacyBlur>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-4 justify-center">
                                            <div className="flex flex-col items-center" title="Storage GB">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Storage</span>
                                                <span className="text-xs font-bold text-zinc-700">{(t.storageUsage / (1024 * 1024 * 1024)).toFixed(1)}G</span>
                                            </div>
                                            <div className="flex flex-col items-center" title="VOD Minutes">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">VOD</span>
                                                <span className="text-xs font-bold text-zinc-700">{t.streamingUsage || 0}m</span>
                                            </div>
                                            <div className="flex flex-col items-center" title="Emails">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Email</span>
                                                <span className="text-xs font-bold text-zinc-700">{t.emailUsage || 0}</span>
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
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                                                        <Activity size={16} /> Entitlements & Features
                                                    </h4>

                                                    {/* Subscription Info */}
                                                    <div className="text-right bg-zinc-50 p-3 rounded border border-zinc-200">
                                                        <div className="text-xs text-zinc-500">Subscription Status</div>
                                                        <div className="font-medium text-zinc-900 capitalize">{t.subscriptionStatus || 'trialing'}</div>

                                                        <div className="text-xs text-zinc-500 mt-2">Period Ends</div>
                                                        <div className="flex items-center justify-end gap-2 mt-1">
                                                            <input
                                                                type="date"
                                                                className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                                                                defaultValue={t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toISOString().split('T')[0] : ''}
                                                                onBlur={(e) => {
                                                                    // Only save if changed and valid
                                                                    if (e.target.value) {
                                                                        const confirm = window.confirm(`Update renewal date to ${e.target.value}?`);
                                                                        if (confirm) handleDateUpdate(t.id, e.target.value);
                                                                    }
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="mt-2 flex gap-2 justify-end">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleSubscriptionUpdate(t.id, 30); }}
                                                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                                                            >
                                                                extend +30d
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleSubscriptionUpdate(t.id, 9999); }}
                                                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                                                            >
                                                                infinite
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Limits & Billing */}
                                                    <div className="text-right bg-zinc-50 p-3 rounded border border-zinc-200 mt-2">
                                                        <div className="text-xs text-zinc-500 font-bold mb-2">Usage Limits</div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-[10px] uppercase text-zinc-400 font-bold block">SMS</label>
                                                                <input type="number"
                                                                    className="w-full text-xs border rounded px-1 py-0.5 text-right"
                                                                    defaultValue={t.smsLimit || 0}
                                                                    onBlur={(e) => handleLimitUpdate(t.id, 'smsLimit', parseInt(e.target.value))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase text-zinc-400 font-bold block">Email</label>
                                                                <input type="number"
                                                                    className="w-full text-xs border rounded px-1 py-0.5 text-right"
                                                                    defaultValue={t.emailLimit || 0}
                                                                    onBlur={(e) => handleLimitUpdate(t.id, 'emailLimit', parseInt(e.target.value))}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 flex items-center justify-end gap-2 px-1">
                                                            <label className="text-xs text-zinc-700 cursor-pointer select-none" htmlFor={`exempt-${t.id}`}>Billing Exempt</label>
                                                            <input type="checkbox"
                                                                id={`exempt-${t.id}`}
                                                                defaultChecked={!!t.billingExempt}
                                                                onChange={(e) => handleLimitUpdate(t.id, 'billingExempt', e.target.checked)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

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
                                                                        <div className="flex items-center gap-2">
                                                                            {f.key === 'zoom' && state.enabled && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); openZoomConfig(t.id); }}
                                                                                    className="p-1 text-zinc-500 hover:text-blue-600 hover:bg-zinc-200 rounded"
                                                                                    title="Configure Zoom Credentials"
                                                                                >
                                                                                    <Settings size={16} />
                                                                                </button>
                                                                            )}
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
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))
                        }
                    </tbody >
                </table >
                {(!Array.isArray(tenants) || tenants.length === 0) && (
                    <div className="p-8 text-center text-zinc-500">
                        No tenants found. Create one to get started.
                    </div>
                )
                }
            </div >

            {/* Zoom Configuration Modal */}
            <Modal
                isOpen={zoomModalOpen}
                onClose={() => setZoomModalOpen(false)}
                title="Configure Zoom Integration"
            >
                <div className="mb-4 text-sm text-zinc-500">
                    Provide the Server-to-Server OAuth credentials from the Zoom App Marketplace.
                    This allows the platform to create meetings on behalf of this tenant.
                </div>
                <form onSubmit={saveZoomCredentials} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Account ID</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={zoomData.accountId}
                            onChange={(e) => setZoomData({ ...zoomData, accountId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Client ID</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={zoomData.clientId}
                            onChange={(e) => setZoomData({ ...zoomData, clientId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Client Secret</label>
                        <input
                            type="password"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={zoomData.clientSecret}
                            onChange={(e) => setZoomData({ ...zoomData, clientSecret: e.target.value })}
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setZoomModalOpen(false)} className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">
                            {loading ? "Saving..." : "Save Credentials"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Create Tenant Modal */}
            < Modal
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Plan Tier</label>
                            <select
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={formData.plan}
                                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                            >
                                <option value="basic">Launch (Basic)</option>
                                <option value="growth">Growth</option>
                                <option value="scale">Scale</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Trial Period (Days)</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="14"
                                value={(formData as any).trialDays || ''}
                                onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) } as any)}
                            />
                            <p className="text-xs text-zinc-500 mt-1">Leave empty for no trial</p>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-500">
                        This studio will be created under your admin account with billing bypassed.
                    </p>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">
                            {loading ? "Provisioning..." : "Launch Studio"}
                        </button>
                    </div>
                </form>
            </Modal >
        </div >
    );
}
