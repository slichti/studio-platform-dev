import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useAuth } from "@clerk/react-router";
import { apiRequest, API_URL } from "../utils/api";
import { useState, Fragment } from "react";
import { Dialog, Transition, Tab, Menu } from "@headlessui/react";

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
}

export async function loader(args: any): Promise<LoaderData> {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const [backupsRes, tenantsRes, historyRes] = await Promise.all([
            fetch(`${API_URL}/admin/backups`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/tenants`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/history`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);

        const backupsData = await backupsRes.json() as any;
        const tenantsData = await tenantsRes.json() as any;
        const historyData = await historyRes.json() as any;

        return {
            backups: backupsData.backups || [],
            r2Summary: backupsData.r2Summary || { system: 0, tenant: 0 },
            tenants: tenantsData.tenants || [],
            history: historyData.history || []
        };
    } catch (error) {
        console.error("Failed to load backup data:", error);
        return { backups: [], r2Summary: { system: 0, tenant: 0 }, tenants: [], history: [] };
    }
}

export default function AdminBackups() {
    const data = useLoaderData<typeof loader>() as LoaderData;
    const { backups, r2Summary, tenants, history } = data;
    const navigate = useNavigate();
    const { getToken } = useAuth();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [restoreModalOpen, setRestoreModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<TenantWithBackup | null>(null);
    const [selectedBackup, setSelectedBackup] = useState<string>("");
    const [tenantBackups, setTenantBackups] = useState<Backup[]>([]);
    const [restorePreview, setRestorePreview] = useState<any>(null);

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
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

        try {
            const token = await getToken();
            const data: any = await apiRequest(`/admin/backups/tenants/${tenant.id}`, token);
            setTenantBackups(data.backups || []);
        } catch (error) {
            console.error('Failed to load tenant backups:', error);
        }
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
                    <h1 className="text-2xl font-bold text-gray-900">Backup Management</h1>
                    <p className="text-gray-500 mt-1">System and tenant backup administration</p>
                </div>

                <Menu as="div" className="relative">
                    <Menu.Button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50" disabled={loading}>
                        {loading ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        )}
                        Trigger Backup
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg ring-1 ring-black/5 z-10">
                        <div className="p-1">
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => triggerBackup('system')}
                                        className={`${active ? 'bg-indigo-50' : ''} w-full text-left px-3 py-2 rounded-md text-sm`}
                                    >
                                        🗄️ Full System Backup
                                    </button>
                                )}
                            </Menu.Item>
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => triggerBackup('all-tenants')}
                                        className={`${active ? 'bg-indigo-50' : ''} w-full text-left px-3 py-2 rounded-md text-sm`}
                                    >
                                        🏢 All Tenant Backups
                                    </button>
                                )}
                            </Menu.Item>
                        </div>
                    </Menu.Items>
                </Menu>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-gray-500 text-sm">System Backups</div>
                    <div className="text-2xl font-bold text-gray-900">{r2Summary.system}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-gray-500 text-sm">Tenant Backups</div>
                    <div className="text-2xl font-bold text-gray-900">{r2Summary.tenant}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-gray-500 text-sm">Active Tenants</div>
                    <div className="text-2xl font-bold text-gray-900">{tenants.length}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-gray-500 text-sm">Restore Operations</div>
                    <div className="text-2xl font-bold text-gray-900">{history.length}</div>
                </div>
            </div>

            {/* Tabs */}
            <Tab.Group>
                <Tab.List className="flex space-x-2 mb-6 border-b border-gray-200">
                    <Tab className={({ selected }) =>
                        `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                    }>
                        Tenant Backups
                    </Tab>
                    <Tab className={({ selected }) =>
                        `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                    }>
                        Restore History
                    </Tab>
                </Tab.List>

                <Tab.Panels>
                    {/* Tenant Backups Panel */}
                    <Tab.Panel>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Backups</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Backup</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {tenants.map((tenant: TenantWithBackup) => (
                                        <tr key={tenant.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{tenant.name}</div>
                                                <div className="text-sm text-gray-500">{tenant.slug}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {tenant.backupCount} backups
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {tenant.latestBackup ? formatDate(tenant.latestBackup.uploaded) : 'No backups'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {tenant.latestBackup ? formatBytes(tenant.latestBackup.size) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => triggerBackup('tenant', tenant.id)}
                                                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                                    >
                                                        Backup
                                                    </button>
                                                    <button
                                                        onClick={() => openRestoreModal(tenant)}
                                                        className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                                                        disabled={tenant.backupCount === 0}
                                                    >
                                                        Restore
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {tenants.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No tenants found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Tab.Panel>

                    {/* Restore History Panel */}
                    <Tab.Panel>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restored</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {history.map((entry: RestoreHistory) => (
                                        <tr key={entry.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.type === 'system' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
                                                    }`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {entry.tenantId || 'Full System'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {formatDate(entry.restoredAt)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {entry.recordsRestored?.toLocaleString() || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {entry.durationMs ? `${(entry.durationMs / 1000).toFixed(2)}s` : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.status === 'success' ? 'bg-green-100 text-green-800' :
                                                        entry.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {entry.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                            <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                                <div className="p-6 border-b border-gray-200">
                                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                                        Restore Tenant: {selectedTenant?.name}
                                    </Dialog.Title>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Select a backup to restore. This will overwrite all current data.
                                    </p>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* Backup Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Select Backup
                                        </label>
                                        <select
                                            value={selectedBackup}
                                            onChange={(e) => {
                                                setSelectedBackup(e.target.value);
                                                setRestorePreview(null);
                                            }}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                        >
                                            <option value="">Choose a backup...</option>
                                            {tenantBackups.map((backup) => (
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
                                        className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        Preview Restore
                                    </button>

                                    {/* Preview Results */}
                                    {restorePreview && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                            <h4 className="font-medium text-amber-800 mb-2">Restore Preview</h4>
                                            <div className="text-sm text-amber-700 space-y-1">
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

                                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                                    <button
                                        onClick={() => setRestoreModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
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
