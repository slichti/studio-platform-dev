
import { Link, useNavigate, useLoaderData } from "react-router";
import { apiRequest, API_URL } from "../../utils/api";
import { useState, Fragment, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { ChevronDown, ChevronRight, Activity, LogIn, Bell, Users } from "lucide-react";
import { PrivacyBlur } from "../PrivacyBlur";
import { TenantDetailView } from "../admin/tenants/TenantDetailView";
import { AdminTenantsModals } from "../admin/tenants/Modals";
import { FEATURES } from "../admin/tenants/constants";
import { ClientOnly } from "../ClientOnly";
import { TIER_KEYS, TENANT_STATUSES } from "@studio/db";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AdminTenantsPageComponent() {
    const {
        tenants: initialTenants,
        total,
        page: currentPage,
        limit,
        status: initialStatus,
        tier: initialTier,
        search: initialSearch,
        platformConfig
    } = useLoaderData<any>();

    const [tenants, setTenants] = useState(initialTenants);
    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Sync local tenants state with loader data when it changes
    useEffect(() => {
        setTenants(initialTenants);
    }, [initialTenants]);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [seedingLoading, setSeedingLoading] = useState(false);
    const [seedModalOpen, setSeedModalOpen] = useState(false);
    const [seedOptions, setSeedOptions] = useState<any>({
        tenantName: '', tenantSlug: '', ownerCount: 1, instructorCount: 2, studentCount: 10,
        tier: 'growth', features: [], featureMode: 'all'
    });

    const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());
    const [tenantFeatures, setTenantFeatures] = useState<Record<string, any>>({});
    const [tenantStats, setTenantStats] = useState<any>({});
    const [subscriptionDetails, setSubscriptionDetails] = useState<Record<string, any>>({});
    const [invoices, setInvoices] = useState<Record<string, any[]>>({});
    const [featuresLoading, setFeaturesLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState<string | null>(null);

    const [errorDialog, setErrorDialog] = useState({ isOpen: false, message: "" });
    const [successDialog, setSuccessDialog] = useState({ isOpen: false, message: "", shouldRefresh: false });

    // Action Selection States
    const [tierChange, setTierChange] = useState<{ id: string, tier: string } | null>(null);
    const [intervalChange, setIntervalChange] = useState<{ id: string, interval: string } | null>(null);
    const [waiveUsageId, setWaiveUsageId] = useState<string | null>(null);
    const [restoreId, setRestoreId] = useState<string | null>(null);
    const [renewalDateChange, setRenewalDateChange] = useState<{ id: string, date: string } | null>(null);

    const [archiveId, setArchiveId] = useState<string | null>(null);
    const [archiveInput, setArchiveInput] = useState("");
    const [archiveLoading, setArchiveLoading] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);
    const [deleteInput, setDeleteInput] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [notifyModalOpen, setNotifyModalOpen] = useState(false);
    const [notifyTenantId, setNotifyTenantId] = useState<string | null>(null);
    const [notifyMessage, setNotifyMessage] = useState("");
    const [notifySubject, setNotifySubject] = useState("");

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [tenantToEdit, setTenantToEdit] = useState<{ id: string, name: string, ownerEmail: string } | null>(null);
    const [editEmail, setEditEmail] = useState("");

    const [ownersModalOpen, setOwnersModalOpen] = useState(false);
    const [selectedTenantForOwners, setSelectedTenantForOwners] = useState<{ id: string, name: string } | null>(null);

    const [zoomModalOpen, setZoomModalOpen] = useState(false);
    const [zoomTenantId, setZoomTenantId] = useState<string | null>(null);
    const [zoomData, setZoomData] = useState({ accountId: '', clientId: '', clientSecret: '' });

    const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);
    const [tenantToImpersonate, setTenantToImpersonate] = useState<{ id: string, name: string } | null>(null);

    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [selectedTenantForRefund, setSelectedTenantForRefund] = useState<string | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundReason, setRefundReason] = useState('requested_by_customer');
    const [refundPaymentIntent, setRefundPaymentIntent] = useState('');

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [selectedTenantForCancel, setSelectedTenantForCancel] = useState<string | null>(null);

    const [gracePeriodModalOpen, setGracePeriodModalOpen] = useState(false);
    const [selectedTenantForGrace, setSelectedTenantForGrace] = useState<{ id: string, enabled: boolean } | null>(null);

    const [exportModal, setExportModal] = useState<any>(null);

    const [formData, setFormData] = useState({ name: "", slug: "", ownerEmail: "", plan: "launch" });
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');
    const [tierFilter, setTierFilter] = useState(initialTier || 'all');
    const [showFinancials, setShowFinancials] = useState(false);


    const { getToken } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('admin_show_financials');
            if (stored === 'true') setShowFinancials(true);
        }
    }, []);

    const showSuccess = (message: string, shouldRefresh = false) => {
        setSuccessDialog({ isOpen: true, message, shouldRefresh });
        setTimeout(() => {
            setSuccessDialog(prev => ({ ...prev, isOpen: false }));
        }, 3000);
    };

    // Handlers
    const confirmTierChange = async () => {
        if (!tierChange) return;
        const { id, tier } = tierChange;
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${id}/tier`, token, {
                method: "PATCH",
                body: JSON.stringify({ tier })
            });
            if (res.error) throw new Error(res.error);
            setTenants(tenants.map((t: any) => t.id === id ? { ...t, tier } : t));
            showSuccess(`Tenant tier updated to ${tier}.`);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message || "Failed to update tier." });
        } finally {
            setTierChange(null);
        }
    };

    const confirmIntervalChange = async () => {
        if (!intervalChange) return;
        const { id, interval } = intervalChange;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${id}/subscription`, token, {
                method: 'PATCH',
                body: JSON.stringify({ interval })
            });
            if (res.error) throw new Error(res.error);
            showSuccess("Subscription interval updated.");
            const details = await apiRequest(`/admin/tenants/${id}/billing/details`, token);
            setSubscriptionDetails(prev => ({ ...prev, [id]: details }));
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
            setIntervalChange(null);
        }
    };

    const confirmRenewalDateUpdate = async () => {
        if (!renewalDateChange) return;
        const { id, date } = renewalDateChange;
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${id}/subscription`, token, {
                method: "PATCH",
                body: JSON.stringify({ currentPeriodEnd: date })
            });
            if (res.error) throw new Error(res.error);
            const updated = await apiRequest("/admin/tenants", token);
            // API returns { tenants, total, ... } – we only need the array here
            setTenants(updated.tenants || updated);
            showSuccess("Date updated.");
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setRenewalDateChange(null);
        }
    };

    const confirmWaiveUsage = async () => {
        if (!waiveUsageId) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${waiveUsageId}/billing/waive`, token, { method: 'POST' });
            if (res.error) throw new Error(res.error);
            showSuccess("Usage waived.");
            setTenants(tenants.map((t: any) => t.id === waiveUsageId ? { ...t, smsUsage: 0, emailUsage: 0, streamingUsage: 0 } : t));
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
            setWaiveUsageId(null);
        }
    };

    const confirmRestore = async () => {
        if (!restoreId) return;
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${restoreId}/lifecycle/restore`, token, { method: 'POST' });
            if (res.error) throw new Error(res.error);
            setTenants(tenants.map((t: any) => t.id === restoreId ? { ...t, status: 'active' } : t));
            showSuccess("Tenant restored.");
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setRestoreId(null);
        }
    };

    const handleArchiveConfirm = async () => {
        if (!archiveId || archiveInput !== 'ARCHIVE') return;
        setArchiveLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${archiveId}/lifecycle/archive`, token, { method: 'POST' });
            if (res.error) throw new Error(res.error);
            setTenants(tenants.map((t: any) => t.id === archiveId ? { ...t, status: 'archived' } : t));
            setArchiveId(null);
            showSuccess("Tenant archived.");
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setArchiveLoading(false);
        }
    };

    const handleDeleteTenant = async () => {
        if (!tenantToDelete) return;
        setDeleteLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantToDelete}`, token, { method: "DELETE" });
            if (res.error) throw new Error(res.error);
            setTenants(tenants.filter((t: any) => t.id !== tenantToDelete));
            setDeleteModalOpen(false);
            setTenantToDelete(null);
            showSuccess("Tenant deleted.");
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSeedConfirm = async () => {
        setSeedingLoading(true);
        try {
            const token = await getToken();
            let fts: string[] = [];
            if (seedOptions.featureMode === 'all') fts = FEATURES.map(f => f.key);
            else if (seedOptions.featureMode === 'custom') fts = seedOptions.features;
            const res: any = await apiRequest("/admin/tenants/seed", token, {
                method: "POST",
                body: JSON.stringify({ ...seedOptions, features: fts })
            });
            if (res.error) throw new Error(res.error);
            const updated = await apiRequest("/admin/tenants", token);
            setTenants(updated.tenants || updated);
            setSeedModalOpen(false);
            showSuccess(`Created ${res.tenant?.name}`, true);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setSeedingLoading(false);
        }
    };

    const saveZoomCredentials = async (e: any) => {
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
            showSuccess('Zoom info updated.');
            setZoomModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRefundSubmit = async (e: any) => {
        e.preventDefault();
        if (!selectedTenantForRefund) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${selectedTenantForRefund}/billing/refund`, token, {
                method: 'POST',
                body: JSON.stringify({
                    paymentIntentId: refundPaymentIntent,
                    amount: refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined,
                    reason: refundReason
                })
            });
            if (res.error) throw new Error(res.error);
            showSuccess("Refund processed.");
            setRefundModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/admin/tenants", token, {
                method: "POST",
                body: JSON.stringify({ ...formData, trialDays: (formData as any).trialDays })
            });
            if (res.error) throw new Error(res.error);
            window.location.reload();
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const confirmCancelSubscription = async () => {
        if (!selectedTenantForCancel) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${selectedTenantForCancel}/subscription/cancel`, token, {
                method: 'POST',
                body: JSON.stringify({ immediate: false })
            });
            if (res.error) throw new Error(res.error);
            showSuccess("Subscription set to cancel.");
            const details = await apiRequest(`/admin/tenants/${selectedTenantForCancel}/billing/details`, token);
            setSubscriptionDetails(prev => ({ ...prev, [selectedTenantForCancel]: details }));
            setCancelModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const confirmGracePeriod = async () => {
        if (!selectedTenantForGrace) return;
        const { id, enabled } = selectedTenantForGrace;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${id}/lifecycle/grace-period`, token, {
                method: 'POST',
                body: JSON.stringify({ enabled })
            });
            if (res.error) throw new Error(res.error);
            setTenants(tenants.map((t: any) => t.id === id ? { ...t, studentAccessDisabled: enabled } : t));
            showSuccess(`Access ${enabled ? 'disabled' : 'enabled'}.`);
            setGracePeriodModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantToEdit) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantToEdit.id}/owner`, token, {
                method: 'PATCH',
                body: JSON.stringify({ email: editEmail })
            });
            if (res.error) throw new Error(res.error);
            showSuccess("Owner email updated.");
            setEditModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleNotifySend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!notifyTenantId) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${notifyTenantId}/notify`, token, {
                method: "POST",
                body: JSON.stringify({ subject: notifySubject, message: notifyMessage, level: 'info' })
            });
            if (res.error) throw new Error(res.error);
            showSuccess("Notification sent.");
            setNotifyModalOpen(false);
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const confirmImpersonate = async () => {
        if (!tenantToImpersonate) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantToImpersonate.id}/impersonate`, token, { method: "POST" });
            if (res.error) throw new Error(res.error);
            localStorage.setItem("impersonation_token", res.token);
            if (res.user?.email) {
                localStorage.setItem("impersonation_target_email", res.user.email);
            }
            window.location.href = res.redirectUrl || `/studio/${res.slug || 'studio'}`;
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message });
        } finally {
            setLoading(false);
            setImpersonateModalOpen(false);
        }
    };

    const handleFeatureToggle = async (tenantId: string, featureKey: string, currentValue: boolean) => {
        const cf = tenantFeatures[tenantId] || {};
        const uf = { ...cf, [featureKey]: { ...cf[featureKey], enabled: !currentValue, source: 'manual' } };
        setTenantFeatures(prev => ({ ...prev, [tenantId]: uf }));
        try {
            const token = await getToken();
            await apiRequest(`/admin/tenants/${tenantId}/features`, token, {
                method: 'POST',
                body: JSON.stringify({ featureKey, enabled: !currentValue, source: 'manual' })
            });
        } catch (e) {
            setTenantFeatures(prev => ({ ...prev, [tenantId]: cf }));
        }
    };

    const toggleTenantExpand = async (tenantId: string) => {
        if (expandedTenants.has(tenantId)) {
            const next = new Set(expandedTenants);
            next.delete(tenantId);
            setExpandedTenants(next);
            return;
        }
        const next = new Set(expandedTenants);
        next.add(tenantId);
        setExpandedTenants(next);
        setFeaturesLoading(true);
        try {
            const token = await getToken();
            const [featuresRes, statsRes, billingRes, historyRes]: [any, any, any, any] = await Promise.all([
                apiRequest(`/admin/tenants/${tenantId}/features`, token),
                apiRequest(`/admin/tenants/${tenantId}/stats`, token),
                apiRequest(`/admin/tenants/${tenantId}/billing/details`, token).catch(() => ({})),
                apiRequest(`/admin/tenants/${tenantId}/billing/history`, token).catch(() => ({ invoices: [] }))
            ]);
            setTenantFeatures((prev: any) => ({ ...prev, [tenantId]: featuresRes.features }));
            setTenantStats((prev: any) => ({ ...prev, [tenantId]: statsRes }));
            setSubscriptionDetails((prev: any) => ({ ...prev, [tenantId]: billingRes }));
            setInvoices((prev: any) => ({ ...prev, [tenantId]: historyRes.invoices || [] }));
        } catch (e) {
            console.error(e);
        } finally {
            setFeaturesLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const handleFilterChange = (updates: any) => {
        const params = new URLSearchParams(window.location.search);
        Object.entries(updates).forEach(([k, v]: [string, any]) => {
            if (v === 'all' || v === '') params.delete(k);
            else params.set(k, v);
        });
        params.set('page', '1'); // Reset to page 1 on filter change
        navigate(`/admin/tenants?${params.toString()}`);
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(window.location.search);
        params.set('page', newPage.toString());
        navigate(`/admin/tenants?${params.toString()}`);
    };

    const sortedTenants = () => {
        if (!Array.isArray(tenants)) return [];
        return [...tenants].sort((a: any, b: any) => {
            const getVal = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
            const valA = getVal(a, sortField);
            const valB = getVal(b, sortField);
            if (valA === valB) return 0;
            const res = valA > valB ? 1 : -1;
            return sortDir === 'asc' ? res : -res;
        });
    };


    const toggleAllTenants = () => {
        if (expandedTenants.size === sortedTenants().length) setExpandedTenants(new Set());
        else setExpandedTenants(new Set(sortedTenants().map((t: any) => t.id)));
    };

    const toggleFinancials = () => {
        const newValue = !showFinancials;
        setShowFinancials(newValue);
        localStorage.setItem('admin_show_financials', String(newValue));
    };

    const handlers = {
        setErrorDialog, setSuccessDialog, setRenewalDateChange,
        setOwnersModalOpen, setSelectedTenantForOwners,
        setSeedModalOpen, setSeedOptions, setZoomModalOpen, setZoomData,
        setRefundPaymentIntent, setRefundAmount, setRefundReason, setExportModal,
        setNotifyModalOpen, setNotifySubject, setNotifyMessage, setRefundModalOpen,
        setArchiveInput, setArchiveId, setDeleteModalOpen, setTenantToDelete, setDeleteInput, setRestoreId,
        openZoomConfig: (id: string) => { setZoomTenantId(id); setZoomData({ accountId: '', clientId: '', clientSecret: '' }); setZoomModalOpen(true); },
        openNotifyModal: (id: string) => { setNotifyTenantId(id); setNotifySubject("System Notification"); setNotifyMessage(""); setNotifyModalOpen(true); },
        openRefundModal: (id: string) => { setSelectedTenantForRefund(id); setRefundAmount(''); setRefundPaymentIntent(''); setRefundModalOpen(true); },
        handleIntervalChange: confirmIntervalChange,
        handleSubscriptionUpdate: async (tenantId: string, daysToAdd: number) => {
            try {
                const token = await getToken();
                await apiRequest(`/admin/tenants/${tenantId}/subscription`, token, {
                    method: "PATCH",
                    body: JSON.stringify({ trialDays: daysToAdd })
                });
                const updated = await apiRequest("/admin/tenants", token);
                setTenants(updated.tenants || updated);
            } catch (e: any) { setErrorDialog({ isOpen: true, message: e.message }); }
        },
        handleCancelSubscription: confirmCancelSubscription,
        handleLimitUpdate: async (tenantId: string, key: string, value: any) => {
            try {
                const token = await getToken();
                await apiRequest(`/admin/tenants/${tenantId}/quotas`, token, {
                    method: "PATCH",
                    body: JSON.stringify({ [key]: value })
                });
                setTenants(tenants.map((t: any) => t.id === tenantId ? { ...t, [key]: value } : t));
            } catch (e: any) { setErrorDialog({ isOpen: true, message: e.message }); }
        },
        handleWaiveUsage: confirmWaiveUsage,
        handleExport: async (tenantId: string, type: any) => {
            setExportLoading(type);
            try {
                const token = await getToken();
                const response = await fetch(`${API_URL}/admin/tenants/${tenantId}/export?type=${type}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error("Export failed");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `export_${type}_${tenantId}.csv`;
                document.body.appendChild(a); a.click(); a.remove();
            } catch (e) { setErrorDialog({ isOpen: true, message: "Export failed" }); }
            finally { setExportLoading(null); }
        },
        handleGracePeriod: (id: string, enabled: boolean) => {
            setSelectedTenantForGrace({ id, enabled });
            setGracePeriodModalOpen(true);
        },
        handleArchive: (id: string) => { setArchiveId(id); setArchiveInput(""); },
        handleRestore: (id: string) => { setRestoreId(id); confirmRestore(); },
        handleImpersonate: (tenant: any) => { setTenantToImpersonate(tenant); setImpersonateModalOpen(true); },
        handleFeatureToggle,
        handleSeedConfirm,
        confirmRestore, // Add confirmRestore to handlers to be accessible by Modals
        confirmTierChange,
        setTierChange,
        handleArchiveConfirm,
        handleDeleteTenant,
        setSelectedTenantForRefund,
        setImpersonateModalOpen,
        setTenantToImpersonate,
        confirmImpersonate
    };

    const state = {
        errorDialog, successDialog, tierChange, intervalChange, renewalDateChange, waiveUsageId,
        restoreId, archiveId, archiveInput, archiveLoading, deleteModalOpen, tenantToDelete,
        deleteInput, deleteLoading, ownersModalOpen, selectedTenantForOwners, seedModalOpen,
        seedOptions, seedingLoading, zoomModalOpen, zoomData, refundModalOpen, refundPaymentIntent,
        refundAmount, refundReason, cancelModalOpen, gracePeriodModalOpen, selectedTenantForGrace,
        editModalOpen, tenantToEdit, editEmail, isCreateOpen, formData, loading, exportModal,
        notifyModalOpen, notifySubject, notifyMessage, impersonateModalOpen, tenantToImpersonate
    };

    return (
        <div className="dark:text-zinc-100 p-8">
            <ClientOnly>
                <AdminTenantsModals state={state as any} handlers={handlers} FEATURES={FEATURES} />
            </ClientOnly>

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">Tenant Management</h2>
                    <div className="flex gap-2 items-center">
                        <select
                            className="text-xs border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-800"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                handleFilterChange({ status: e.target.value });
                            }}
                        >
                            <option value="all">Status: All</option>
                            {TENANT_STATUSES.map(s => (
                                <option key={s} value={s}>
                                    {capitalize(s)}
                                </option>
                            ))}
                        </select>
                        <select
                            className="text-sm border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-800"
                            value={tierFilter}
                            onChange={(e) => {
                                setTierFilter(e.target.value);
                                handleFilterChange({ tier: e.target.value });
                            }}
                        >
                            <option value="all">All Tiers</option>
                            {TIER_KEYS.map(t => (
                                <option key={t} value={t}>
                                    {t === 'launch' ? 'Launch' : capitalize(t)}
                                </option>
                            ))}
                        </select>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search tenants..."
                                className="text-xs border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-800 w-48"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleFilterChange({ search: searchTerm });
                                }}
                            />
                        </div>

                        <button onClick={toggleAllTenants} className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-md">
                            {expandedTenants.size === sortedTenants().length && sortedTenants().length > 0 ? 'Collapse All' : 'Expand All'}
                        </button>
                        <button onClick={() => setSeedModalOpen(true)} className="text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md flex items-center gap-1.5">
                            <Activity size={12} /> Seed Test Tenant
                        </button>
                        <button onClick={toggleFinancials} className={`relative inline-flex h-6 w-11 items-center rounded-full ${showFinancials ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showFinancials ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
                <button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm flex items-center gap-2">
                    <span className="text-lg">+</span> Spin Up Tenant
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="w-8"></th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase cursor-pointer" onClick={() => handleSort('name')}>Tenant</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase cursor-pointer" onClick={() => handleSort('tier')}>Tier</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer" onClick={() => handleSort('stats.owners')}>People</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer" onClick={() => handleSort('storageUsage')}>Usage</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase cursor-pointer" onClick={() => handleSort('status')}>Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {sortedTenants().map((t: any) => (
                            <Fragment key={t.id}>
                                <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" onClick={() => toggleTenantExpand(t.id)}>
                                    <td className="pl-4">{expandedTenants.has(t.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium flex items-center gap-2">
                                            {t.name}
                                            {t.isTest && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">TEST</span>}
                                        </div>
                                        <div className="text-zinc-500 text-xs font-mono">{t.slug}</div>
                                    </td>
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={t.tier || 'launch'}
                                            onChange={(e) => setTierChange({ id: t.id, tier: e.target.value })}
                                            className={`text-xs border rounded px-2 py-0.5 ${t.tier === 'scale' ? 'bg-purple-100 text-purple-800' : t.tier === 'growth' ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-600'}`}
                                        >
                                            {TIER_KEYS.map(tier => (
                                                <option key={tier} value={tier}>{capitalize(tier)}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-4 justify-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase">Own</span>
                                                <span className="text-sm font-bold">{t.stats?.owners || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase">Inst</span>
                                                <span className="text-sm font-bold">{t.stats?.instructors || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase">Cust</span>
                                                <PrivacyBlur revealed={showFinancials} placeholder="***">
                                                    <span className="text-sm font-bold text-blue-600">{t.stats?.totalStudents || 0}</span>
                                                </PrivacyBlur>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-4 justify-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase">Storage</span>
                                                <span className="text-xs font-bold">{(t.storageUsage / (1024 * 1024 * 1024)).toFixed(1)}G</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {t.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <Link to={`/studio/${t.slug}`} className="text-blue-600 text-xs font-bold border border-blue-200 bg-blue-50 px-3 py-1 rounded-full" onClick={(e) => e.stopPropagation()}>Enter</Link>
                                            <button onClick={(e) => { e.stopPropagation(); handlers.handleImpersonate(t); }}><LogIn size={16} className="text-zinc-400" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handlers.openNotifyModal(t.id); }}><Bell size={16} className="text-zinc-400" /></button>
                                        </div>
                                    </td>
                                </tr>
                                {expandedTenants.has(t.id) && (
                                    <tr>
                                        <td colSpan={7} className="px-6 pb-6 mt-2">
                                            <TenantDetailView
                                                t={t}
                                                showFinancials={showFinancials}
                                                subscriptionDetails={subscriptionDetails}
                                                tenantFeatures={tenantFeatures}
                                                tenantStats={tenantStats}
                                                invoices={invoices[t.id] || []}
                                                featuresLoading={featuresLoading}
                                                exportLoading={exportLoading}
                                                platformConfig={platformConfig}
                                                FEATURES={FEATURES}
                                                handlers={handlers}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    Showing <span className="font-medium">{Math.min(total, (currentPage - 1) * limit + 1)}</span> to <span className="font-medium">{Math.min(total, currentPage * limit)}</span> of <span className="font-medium">{total}</span> tenants
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage * limit >= total}
                        className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
