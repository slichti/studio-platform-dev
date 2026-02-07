import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useAuth } from "@clerk/react-router";
import { apiRequest, API_URL } from "../utils/api";
import { useState, Fragment } from "react";
import { Dialog, Transition, Tab, Menu } from "@headlessui/react";
import { ChevronDown, ChevronRight, Download, Trash2, RefreshCw, Clock, Database, Calendar } from "lucide-react";

interface Backup {
    key: string;
    size: number;
    uploaded: string;
    filename?: string;
}

interface TenantWithBackup {
    id: string;
    slug: string;
    name: string;
    backupCount: number;
    latestBackup: Backup | null;
    allBackups?: Backup[];
}

interface RestoreHistory {
    id: string;
    type: string;
    tenantId: string;
    backupKey: string;
    restoredBy: string;
    restoredAt: string;
    status: string;
    recordsRestored: number;
    durationMs: number;
}

interface LoaderData {
    backups: any[];
    r2Summary: { system: number; tenant: number };
    tenants: TenantWithBackup[];
    history: RestoreHistory[];
    systemBackups: Backup[];
}

export async function loader(args: any): Promise<LoaderData> {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const [backupsRes, tenantsRes, historyRes, systemRes] = await Promise.all([
            fetch(`${API_URL}/admin/backups`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/tenants`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/history`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/system`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);

        const backupsData = await backupsRes.json() as any;
        const tenantsData = await tenantsRes.json() as any;
        const historyData = await historyRes.json() as any;
        const systemData = await systemRes.json() as any;

        return {
            backups: backupsData.backups || [],
            r2Summary: backupsData.r2Summary || { system: 0, tenant: 0 },
            tenants: tenantsData.tenants || [],
            history: historyData.history || [],
            systemBackups: systemData.backups || []
        };
    } catch (error) {
        console.error("Failed to load backup data:", error);
        return { backups: [], r2Summary: { system: 0, tenant: 0 }, tenants: [], history: [], systemBackups: [] };
    }
}

// Backup schedule config
const BACKUP_SCHEDULE = {
    time: "2:00 AM UTC",
    frequency: "Daily",
    retention: "90 days"
};

export default function AdminBackups() {
    const data = useLoaderData<typeof loader>() as LoaderData;
    const { backups, r2Summary, tenants, history, systemBackups } = data;
    const navigate = useNavigate();
    const { getToken } = useAuth();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());
    const [expandedSystem, setExpandedSystem] = useState(false);
    const [tenantBackupsCache, setTenantBackupsCache] = useState<Record<string, Backup[]>>({});
    const [restoreModalOpen, setRestoreModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<TenantWithBackup | null>(null);
    const [selectedBackup, setSelectedBackup] = useState<string>("");
    const [restorePreview, setRestorePreview] = useState<any>(null);

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const formatRelativeDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const toggleTenantExpand = async (tenantId: string) => {
        if (expandedTenants.has(tenantId)) {
            const next = new Set(expandedTenants);
            next.delete(tenantId);
            setExpandedTenants(next);
        } else {
            const next = new Set(expandedTenants);
            next.add(tenantId);
            setExpandedTenants(next);

            // Load backups if not cached
            if (!tenantBackupsCache[tenantId]) {
                try {
                    const token = await getToken();
                    const data: any = await apiRequest(`/admin/backups/tenants/${tenantId}`, token);
                    setTenantBackupsCache(prev => ({ ...prev, [tenantId]: data.backups || [] }));
                } catch (error) {
                    console.error('Failed to load tenant backups:', error);
                }
            }
        }
    };

    const expandAll = async () => {
        if (expandedTenants.size === tenants.length) {
            setExpandedTenants(new Set());
        } else {
            setExpandedTenants(new Set(tenants.map(t => t.id)));
            // Load all backups
            const token = await getToken();
            for (const tenant of tenants) {
                if (!tenantBackupsCache[tenant.id]) {
                    try {
                        const data: any = await apiRequest(`/admin/backups/tenants/${tenant.id}`, token);
                        setTenantBackupsCache(prev => ({ ...prev, [tenant.id]: data.backups || [] }));
                    } catch (error) {
                        console.error('Failed to load tenant backups:', error);
                    }
                }
            }
        }
    };

    const triggerBackup = async (type: 'system' | 'all-tenants' | 'tenant', tenantId?: string) => {
        setLoading(true);
        try {
            const token = await getToken();
            await apiRequest('/admin/backups/trigger', token, {
                method: 'POST',
                body: JSON.stringify({ type, tenantId })
            });
            showMessage('success', 'Backup triggered successfully!');
            navigate('.', { replace: true });
        } catch (error: any) {
            showMessage('error', error.message || 'Backup failed');
        } finally {
            setLoading(false);
        }
    };

    const openRestoreModal = async (tenant: TenantWithBackup) => {
        setSelectedTenant(tenant);
        setRestoreModalOpen(true);
        setSelectedBackup("");
        setRestorePreview(null);
    };

    const previewRestore = async () => {
        if (!selectedTenant || !selectedBackup) return;

        try {
            const token = await getToken();
            const data: any = await apiRequest(`/admin/backups/restore/tenant/${selectedTenant.id}`, token, {
                method: 'POST',
                body: JSON.stringify({ backupKey: selectedBackup, dryRun: true })
            });
            setRestorePreview(data);
        } catch (error: any) {
            showMessage('error', error.message);
        }
    };

    const executeRestore = async () => {
        if (!selectedTenant || !selectedBackup) return;

        const confirmed = window.confirm(
            `⚠️ DANGER: This will OVERWRITE all data for ${selectedTenant.name}.\n\n` +
            `Are you absolutely sure you want to restore from backup?\n\n` +
            `This action cannot be undone.`
        );

        if (!confirmed) return;

        setLoading(true);
        try {
            const token = await getToken();
            const data: any = await apiRequest(`/admin/backups/restore/tenant/${selectedTenant.id}`, token, {
                method: 'POST',
                body: JSON.stringify({
                    backupKey: selectedBackup,
                    dryRun: false,
                    confirmToken: 'CONFIRM_RESTORE'
                })
            });
            showMessage('success', `Restore completed! ${data.recordsRestored} records restored.`);
            setRestoreModalOpen(false);
            navigate('.', { replace: true });
        } catch (error: any) {
            showMessage('error', error.message || 'Restore failed');
        } finally {
            setLoading(false);
        }
    };

    const deleteBackup = async (key: string) => {
        if (!confirm('Are you sure you want to delete this backup?')) return;

        try {
            const token = await getToken();
            await apiRequest(`/admin/backups/${encodeURIComponent(key)}`, token, { method: 'DELETE' });
            showMessage('success', 'Backup deleted');
            navigate('.', { replace: true });
        } catch (error: any) {
            showMessage('error', error.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Toast Message */}
            {message && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backup Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">System and tenant backup administration</p>
                </div>

                <Menu as="div" className="relative">
                    <Menu.Button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50" disabled={loading}>
                        {loading ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Database className="h-4 w-4" />
                        )}
                        Trigger Backup
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg ring-1 ring-black/5 z-10">
                        <div className="p-1">
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => triggerBackup('system')}
                                        className={`${active ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''} w-full text-left px-3 py-2 rounded-md text-sm text-gray-900 dark:text-white`}
                                    >
                                        🗄️ Full System Backup
                                    </button>
                                )}
                            </Menu.Item>
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => triggerBackup('all-tenants')}
                                        className={`${active ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''} w-full text-left px-3 py-2 rounded-md text-sm text-gray-900 dark:text-white`}
                                    >
                                        🏢 All Tenant Backups
                                    </button>
                                )}
                            </Menu.Item>
                        </div>
                    </Menu.Items>
                </Menu>
            </div>

            {/* Schedule Info Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-indigo-600" />
                            <div>
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Schedule</div>
                                <div className="font-semibold text-gray-900 dark:text-white">{BACKUP_SCHEDULE.frequency} at {BACKUP_SCHEDULE.time}</div>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-indigo-200 dark:bg-indigo-700" />
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                            <div>
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Retention</div>
                                <div className="font-semibold text-gray-900 dark:text-white">{BACKUP_SCHEDULE.retention}</div>
                            </div>
                        </div>
                    </div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400">
                        Next backup: {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()} at 2:00 AM UTC
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">System Backups</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{r2Summary.system}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">Tenant Backups</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{r2Summary.tenant}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">Active Tenants</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{tenants.length}</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">Restore Operations</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{history.length}</div>
                </div>
            </div>

            {/* Tabs */}
            <Tab.Group>
                <Tab.List className="flex space-x-2 mb-6 border-b border-gray-200 dark:border-zinc-800">
                    <Tab className={({ selected }) =>
                        `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`
                    }>
                        System Backups
                    </Tab>
                    <Tab className={({ selected }) =>
                        `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`
                    }>
                        Tenant Backups
                    </Tab>
                    <Tab className={({ selected }) =>
                        `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`
                    }>
                        Restore History
                    </Tab>
                </Tab.List>

                <Tab.Panels>
                    {/* System Backups Panel */}
                    <Tab.Panel>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                            {/* System Backup Row - Expandable */}
                            <div
                                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                                onClick={() => setExpandedSystem(!expandedSystem)}
                            >
                                <div className="flex items-center gap-4">
                                    {expandedSystem ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                                    <Database className="h-6 w-6 text-indigo-600" />
                                    <div>
                                        <div className="font-semibold text-gray-900 dark:text-white">Full System Backups</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Complete database snapshots (all tables)</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{systemBackups.length} backups</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Latest: {systemBackups.length > 0 ? formatRelativeDate(systemBackups[0].uploaded) : 'None'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); triggerBackup('system'); }}
                                        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                                    >
                                        Backup Now
                                    </button>
                                </div>
                            </div>

                            {/* Expanded System Backups List */}
                            {expandedSystem && (
                                <div className="border-t border-gray-200 dark:border-zinc-800">
                                    <div className="bg-gray-50 dark:bg-zinc-950 px-6 py-3">
                                        <div className="grid grid-cols-4 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                            <div>Backup</div>
                                            <div>Date</div>
                                            <div>Size</div>
                                            <div className="text-right">Actions</div>
                                        </div>
                                    </div>
                                    {systemBackups.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            No system backups yet. Click "Backup Now" to create one.
                                        </div>
                                    ) : (
                                        systemBackups.map((backup: Backup) => (
                                            <div key={backup.key} className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900">
                                                <div className="grid grid-cols-4 gap-4 items-center">
                                                    <div className="text-sm text-gray-900 dark:text-white font-mono">
                                                        {backup.key.split('/').pop()}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {formatDate(backup.uploaded)}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {formatBytes(backup.size)}
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button className="p-1.5 text-gray-400 hover:text-indigo-600" title="Download">
                                                            <Download className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteBackup(backup.key)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </Tab.Panel>

                    {/* Tenant Backups Panel */}
                    <Tab.Panel>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                            {/* Header */}
                            <div className="px-6 py-3 bg-gray-50 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                <div className="grid grid-cols-5 gap-4 flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    <div className="col-span-2">Tenant</div>
                                    <div>Backups</div>
                                    <div>Latest</div>
                                    <div className="text-right">Actions</div>
                                </div>
                                <button
                                    onClick={expandAll}
                                    className="ml-4 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    {expandedTenants.size === tenants.length && tenants.length > 0 ? 'Collapse All' : 'Expand All'}
                                </button>
                            </div>

                            {/* Tenant Rows */}
                            {tenants.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    No tenants found
                                </div>
                            ) : (
                                tenants.map((tenant: TenantWithBackup) => (
                                    <Fragment key={tenant.id}>
                                        {/* Tenant Row */}
                                        <div
                                            className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                                            onClick={() => toggleTenantExpand(tenant.id)}
                                        >
                                            <div className="grid grid-cols-5 gap-4 items-center">
                                                <div className="col-span-2 flex items-center gap-3">
                                                    {expandedTenants.has(tenant.id) ? (
                                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-gray-400" />
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-gray-900 dark:text-white">{tenant.name}</div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">{tenant.slug}</div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                                        {tenant.backupCount} backups
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {tenant.latestBackup ? formatRelativeDate(tenant.latestBackup.uploaded) : 'No backups'}
                                                </div>
                                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => triggerBackup('tenant', tenant.id)}
                                                        className="px-3 py-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm rounded"
                                                    >
                                                        Backup
                                                    </button>
                                                    <button
                                                        onClick={() => openRestoreModal(tenant)}
                                                        className="px-3 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm rounded"
                                                        disabled={tenant.backupCount === 0}
                                                    >
                                                        Restore
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Tenant Details */}
                                        {expandedTenants.has(tenant.id) && (
                                            <div className="bg-gray-50/50 dark:bg-zinc-950/50 border-t border-gray-100 dark:border-zinc-800">
                                                <div className="px-6 py-4 pl-14">
                                                    {/* Schedule & Rotation Info */}
                                                    <div className="grid grid-cols-3 gap-6 mb-4 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
                                                        <div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Schedule</div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{BACKUP_SCHEDULE.frequency} at {BACKUP_SCHEDULE.time}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Retention</div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{BACKUP_SCHEDULE.retention}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Total Size</div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {formatBytes((tenantBackupsCache[tenant.id] || []).reduce((sum, b) => sum + b.size, 0))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Backups List */}
                                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Backup History</div>
                                                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden">
                                                        {(tenantBackupsCache[tenant.id] || []).length === 0 ? (
                                                            <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                                                                No backups available
                                                            </div>
                                                        ) : (
                                                            <table className="min-w-full">
                                                                <thead className="bg-gray-50 dark:bg-zinc-950">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
                                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expires</th>
                                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                                                    {(tenantBackupsCache[tenant.id] || []).map((backup: Backup) => {
                                                                        const expiresDate = new Date(backup.uploaded);
                                                                        expiresDate.setDate(expiresDate.getDate() + 90);
                                                                        return (
                                                                            <tr key={backup.key} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                                                    {formatDate(backup.uploaded)}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                                                                    {formatBytes(backup.size)}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                                                                    {expiresDate.toLocaleDateString()}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-right">
                                                                                    <div className="flex justify-end gap-1">
                                                                                        <button className="p-1 text-gray-400 hover:text-indigo-600" title="Download">
                                                                                            <Download className="h-4 w-4" />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => deleteBackup(backup.key)}
                                                                                            className="p-1 text-gray-400 hover:text-red-600"
                                                                                            title="Delete"
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </div>
                    </Tab.Panel>

                    {/* Restore History Panel */}
                    <Tab.Panel>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                                <thead className="bg-gray-50 dark:bg-zinc-950">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tenant</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Restored</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Records</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {history.map((entry: RestoreHistory) => (
                                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.type === 'system' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                                    }`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                                {entry.tenantId || 'Full System'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {formatDate(entry.restoredAt)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {entry.recordsRestored?.toLocaleString() || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {entry.durationMs ? `${(entry.durationMs / 1000).toFixed(2)}s` : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                                        entry.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                                                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                                    }`}>
                                                    {entry.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No restore operations yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>

            {/* Restore Modal */}
            <Transition show={restoreModalOpen} as={Fragment}>
                <Dialog onClose={() => setRestoreModalOpen(false)} className="relative z-50">
                    <Transition.Child
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/30" />
                    </Transition.Child>

                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Transition.Child
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                                <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Restore Tenant: {selectedTenant?.name}
                                    </Dialog.Title>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Select a backup to restore. This will overwrite all current data.
                                    </p>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* Backup Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Select Backup
                                        </label>
                                        <select
                                            value={selectedBackup}
                                            onChange={(e) => {
                                                setSelectedBackup(e.target.value);
                                                setRestorePreview(null);
                                            }}
                                            className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                                        >
                                            <option value="">Choose a backup...</option>
                                            {(tenantBackupsCache[selectedTenant?.id || ''] || []).map((backup: Backup) => (
                                                <option key={backup.key} value={backup.key}>
                                                    {formatDate(backup.uploaded)} ({formatBytes(backup.size)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Preview Button */}
                                    <button
                                        onClick={previewRestore}
                                        disabled={!selectedBackup}
                                        className="w-full py-2 px-4 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                                    >
                                        Preview Restore
                                    </button>

                                    {/* Preview Results */}
                                    {restorePreview && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                            <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">Restore Preview</h4>
                                            <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                                                <p>Backup Date: {restorePreview.preview?.backupDate}</p>
                                                <p>Total Records: {restorePreview.preview?.recordCount}</p>
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    {Object.entries(restorePreview.preview?.tables || {}).map(([table, count]) => (
                                                        <div key={table} className="flex justify-between">
                                                            <span>{table}:</span>
                                                            <span className="font-mono">{count as number}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3">
                                    <button
                                        onClick={() => setRestoreModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={executeRestore}
                                        disabled={!selectedBackup || !restorePreview || loading}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {loading ? 'Restoring...' : '⚠️ Execute Restore'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}
