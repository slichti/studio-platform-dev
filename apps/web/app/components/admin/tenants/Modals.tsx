
import { Modal } from "../../Modal";
import { ErrorDialog, ConfirmationDialog } from "../../Dialogs";
import { AlertTriangle, Activity } from "lucide-react";
import { ManageOwnersModal } from "../../ManageOwnersModal";
import { DataExportModal } from "../../DataExportModal";

interface AdminTenantsModalsProps {
    state: {
        errorDialog: { isOpen: boolean, message: string };
        successDialog: { isOpen: boolean, message: string, shouldRefresh?: boolean };
        tierChange: { id: string, tier: string } | null;
        intervalChange: { id: string, interval: string } | null;
        renewalDateChange: { id: string, date: string } | null;
        waiveUsageId: string | null;
        restoreId: string | null;
        archiveId: string | null;
        archiveInput: string;
        archiveLoading: boolean;
        deleteModalOpen: boolean;
        tenantToDelete: string | null;
        deleteInput: string;
        deleteLoading: boolean;
        ownersModalOpen: boolean;
        selectedTenantForOwners: { id: string, name: string } | null;
        seedModalOpen: boolean;
        seedOptions: any;
        seedingLoading: boolean;
        zoomModalOpen: boolean;
        zoomData: any;
        refundModalOpen: boolean;
        refundPaymentIntent: string;
        refundAmount: string;
        refundReason: string;
        cancelModalOpen: boolean;
        gracePeriodModalOpen: boolean;
        selectedTenantForGrace: { id: string, enabled: boolean } | null;
        editModalOpen: boolean;
        tenantToEdit: { id: string, name: string, ownerEmail: string } | null;
        editEmail: string;
        isCreateOpen: boolean;
        formData: any;
        loading: boolean;
        exportModal: any;
        notifyModalOpen: boolean;
        notifySubject: string;
        notifyMessage: string;
        impersonateModalOpen: boolean;
        tenantToImpersonate: { id: string, name: string } | null;
    };
    handlers: any;
    FEATURES: any[];
}

export function AdminTenantsModals({ state, handlers, FEATURES }: AdminTenantsModalsProps) {
    return (
        <>
            <ErrorDialog
                isOpen={state.errorDialog.isOpen}
                onClose={() => handlers.setErrorDialog({ ...state.errorDialog, isOpen: false })}
                title="Error"
                message={state.errorDialog.message}
            />
            <Modal
                isOpen={state.successDialog.isOpen}
                onClose={() => {
                    handlers.setSuccessDialog({ ...state.successDialog, isOpen: false });
                    if (state.successDialog.shouldRefresh) {
                        window.location.reload();
                    }
                }}
                title="Success"
            >
                <div className="space-y-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {state.successDialog.message}
                    </p>
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                handlers.setSuccessDialog({ ...state.successDialog, isOpen: false });
                                if (state.successDialog.shouldRefresh) {
                                    window.location.reload();
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmationDialog
                isOpen={!!state.tierChange}
                onClose={() => handlers.setTierChange(null)}
                onConfirm={handlers.confirmTierChange}
                title="Change Tenant Tier"
                message={`Are you sure you want to change this tenant to ${state.tierChange?.tier}?`}
                confirmText="Change Tier"
            />

            <ConfirmationDialog
                isOpen={!!state.intervalChange}
                onClose={() => handlers.setIntervalChange(null)}
                onConfirm={handlers.confirmIntervalChange}
                title="Change Billing Interval"
                message={`Switch billing interval to ${state.intervalChange?.interval}? This will update the Stripe Subscription immediately.`}
                confirmText="Update Interval"
            />

            <ConfirmationDialog
                isOpen={!!state.renewalDateChange}
                onClose={() => handlers.setRenewalDateChange(null)}
                onConfirm={handlers.confirmRenewalDateUpdate}
                title="Update Renewal Date"
                message={`Are you sure you want to update the renewal date to ${state.renewalDateChange?.date}?`}
                confirmText="Update Date"
            />

            <ConfirmationDialog
                isOpen={!!state.waiveUsageId}
                onClose={() => handlers.setWaiveUsageId(null)}
                onConfirm={handlers.confirmWaiveUsage}
                title="Waive Usage"
                message="Are you sure you want to WAIVE all current usage for this tenant? This resets counters to 0."
                confirmText="Waive Usage"
                isDestructive={true}
            />

            <ConfirmationDialog
                isOpen={!!state.restoreId}
                onClose={() => handlers.setRestoreId(null)}
                onConfirm={handlers.confirmRestore}
                title="Restore Tenant"
                message="Restore this tenant to active status?"
                confirmText="Restore"
            />

            <Modal isOpen={!!state.archiveId} onClose={() => { handlers.setArchiveId(null); handlers.setArchiveInput(""); }} title="Archive Tenant">
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 rounded-lg text-sm border border-red-100 dark:border-red-900/50 flex gap-3">
                        <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                        <div>
                            <strong>Warning:</strong> This will disable all access for the tenant. Data will be retained but the studio will be offline.
                        </div>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        To confirm, please type <strong>ARCHIVE</strong> below:
                    </p>
                    <input
                        type="text"
                        className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-red-500 outline-none"
                        placeholder="Type ARCHIVE"
                        value={state.archiveInput}
                        onChange={(e) => handlers.setArchiveInput(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => { handlers.setArchiveInput(""); handlers.setArchiveId(null); }} className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-sm">Cancel</button>
                        <button
                            onClick={handlers.handleArchiveConfirm}
                            disabled={state.archiveInput !== 'ARCHIVE' || state.archiveLoading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                            {state.archiveLoading && <Activity className="animate-spin" size={14} />}
                            Archive Tenant
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={state.deleteModalOpen} onClose={() => { handlers.setDeleteModalOpen(false); handlers.setTenantToDelete(null); handlers.setDeleteInput(""); }} title="Delete Tenant">
                <div className="space-y-4">
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100 flex items-start gap-2">
                        <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                        <div>
                            <span className="font-bold block mb-1">Danger: Irreversible Action</span>
                            This will explicitly delete the tenant and all associated data.
                        </div>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        To confirm, please type <strong>DELETE</strong> below:
                    </p>
                    <input
                        type="text"
                        className="w-full text-sm border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 bg-white dark:bg-zinc-800"
                        placeholder="DELETE"
                        value={state.deleteInput}
                        onChange={(e) => handlers.setDeleteInput(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => { handlers.setDeleteModalOpen(false); handlers.setTenantToDelete(null); handlers.setDeleteInput(""); }} className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-sm">Cancel</button>
                        <button
                            onClick={handlers.handleDeleteTenant}
                            disabled={state.deleteInput !== 'DELETE' || state.deleteLoading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {state.deleteLoading && <Activity className="animate-spin" size={14} />}
                            Delete Tenant
                        </button>
                    </div>
                </div>
            </Modal>

            <ManageOwnersModal
                isOpen={state.ownersModalOpen}
                onClose={() => { handlers.setOwnersModalOpen(false); handlers.setSelectedTenantForOwners(null); }}
                tenantId={state.selectedTenantForOwners?.id || null}
                tenantName={state.selectedTenantForOwners?.name || ''}
            />

            <Modal isOpen={state.seedModalOpen} onClose={() => handlers.setSeedModalOpen(false)} title="Seed Test Tenant">
                <div className="space-y-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Configure the parameters for the generated test tenant.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tenant Name (Optional)</label>
                            <input
                                type="text"
                                className="w-full text-sm border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800"
                                placeholder="Auto-generated"
                                value={state.seedOptions.tenantName}
                                onChange={(e) => handlers.setSeedOptions({ ...state.seedOptions, tenantName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Slug (Optional)</label>
                            <input
                                type="text"
                                className="w-full text-sm border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800"
                                placeholder="Auto-generated"
                                value={state.seedOptions.tenantSlug}
                                onChange={(e) => handlers.setSeedOptions({ ...state.seedOptions, tenantSlug: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tier</label>
                            <select
                                className="w-full text-sm border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800"
                                value={state.seedOptions.tier}
                                onChange={(e) => handlers.setSeedOptions({ ...state.seedOptions, tier: e.target.value as any })}
                            >
                                <option value="basic">Launch</option>
                                <option value="growth">Growth</option>
                                <option value="scale">Scale</option>
                            </select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Features</label>
                                <div className="flex gap-2 text-xs">
                                    <button
                                        className={`px-2 py-0.5 rounded border ${state.seedOptions.featureMode === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-transparent border-zinc-200 text-zinc-500'}`}
                                        onClick={() => handlers.setSeedOptions({ ...state.seedOptions, featureMode: 'all' })}
                                    >All</button>
                                    <button
                                        className={`px-2 py-0.5 rounded border ${state.seedOptions.featureMode === 'none' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-transparent border-zinc-200 text-zinc-500'}`}
                                        onClick={() => handlers.setSeedOptions({ ...state.seedOptions, featureMode: 'none' })}
                                    >None</button>
                                    <button
                                        className={`px-2 py-0.5 rounded border ${state.seedOptions.featureMode === 'custom' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-transparent border-zinc-200 text-zinc-500'}`}
                                        onClick={() => handlers.setSeedOptions({ ...state.seedOptions, featureMode: 'custom' })}
                                    >Custom</button>
                                </div>
                            </div>

                            {state.seedOptions.featureMode === 'custom' && (
                                <div className="grid grid-cols-2 gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-100 dark:border-zinc-800 h-24 overflow-y-auto">
                                    {FEATURES.map(f => (
                                        <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                                checked={state.seedOptions.features.includes(f.key)}
                                                onChange={(e) => {
                                                    const newFeatures = e.target.checked
                                                        ? [...state.seedOptions.features, f.key]
                                                        : state.seedOptions.features.filter((k: string) => k !== f.key);
                                                    handlers.setSeedOptions({ ...state.seedOptions, features: newFeatures });
                                                }}
                                            />
                                            <span className="text-xs text-zinc-600 dark:text-zinc-400">{f.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between text-xs font-medium mb-1">
                                <span>Owners</span>
                                <span>{state.seedOptions.ownerCount}</span>
                            </div>
                            <input
                                type="range" min="1" max="20" step="1"
                                className="w-full accent-blue-600 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                                value={state.seedOptions.ownerCount}
                                onChange={(e) => handlers.setSeedOptions({ ...state.seedOptions, ownerCount: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-xs font-medium mb-1">
                                <span>Instructors</span>
                                <span>{state.seedOptions.instructorCount}</span>
                            </div>
                            <input
                                type="range" min="0" max="100" step="1"
                                className="w-full accent-blue-600 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                                value={state.seedOptions.instructorCount}
                                onChange={(e) => handlers.setSeedOptions({ ...state.seedOptions, instructorCount: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-xs font-medium mb-1">
                                <span>Customers (Students)</span>
                                <span>{state.seedOptions.studentCount}</span>
                            </div>
                            <input
                                type="range" min="0" max="2000" step="10"
                                className="w-full accent-blue-600 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                                value={state.seedOptions.studentCount}
                                onChange={(e) => handlers.setSeedOptions({ ...state.seedOptions, studentCount: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => handlers.setSeedModalOpen(false)} className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-sm">Cancel</button>
                        <button
                            onClick={handlers.handleSeedConfirm}
                            disabled={state.seedingLoading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {state.seedingLoading && <Activity className="animate-spin" size={14} />}
                            Generate Tenant
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={state.zoomModalOpen}
                onClose={() => handlers.setZoomModalOpen(false)}
                title="Configure Zoom Integration"
            >
                <div className="mb-4 text-sm text-zinc-500">
                    Provide the Server-to-Server OAuth credentials from the Zoom App Marketplace.
                    This allows the platform to create meetings on behalf of this tenant.
                </div>
                <form onSubmit={handlers.saveZoomCredentials} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Account ID</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={state.zoomData.accountId}
                            onChange={(e) => handlers.setZoomData({ ...state.zoomData, accountId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Client ID</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={state.zoomData.clientId}
                            onChange={(e) => handlers.setZoomData({ ...state.zoomData, clientId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Client Secret</label>
                        <input
                            type="password"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={state.zoomData.clientSecret}
                            onChange={(e) => handlers.setZoomData({ ...state.zoomData, clientSecret: e.target.value })}
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => handlers.setZoomModalOpen(false)} className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium">Cancel</button>
                        <button type="submit" disabled={state.loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">
                            {state.loading ? "Saving..." : "Save Credentials"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={state.refundModalOpen}
                onClose={() => handlers.setRefundModalOpen(false)}
                title="Issue Refund"
            >
                <div className="mb-4 text-sm text-zinc-500">
                    Refund a payment for this tenant. You need the Stripe Payment Intent ID (from Stripe Dashboard).
                </div>
                <form onSubmit={handlers.handleRefundSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Payment Intent ID</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="pi_..."
                            value={state.refundPaymentIntent}
                            onChange={(e) => handlers.setRefundPaymentIntent(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Amount (Optional - leave empty for full)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-zinc-500">$</span>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full pl-8 pr-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0.00"
                                value={state.refundAmount}
                                onChange={(e) => handlers.setRefundAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Reason</label>
                        <select
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={state.refundReason}
                            onChange={(e) => handlers.setRefundReason(e.target.value)}
                        >
                            <option value="requested_by_customer">Requested by Customer</option>
                            <option value="duplicate">Duplicate</option>
                            <option value="fraudulent">Fraudulent</option>
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => handlers.setRefundModalOpen(false)} className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium">Cancel</button>
                        <button type="submit" disabled={state.loading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50">
                            {state.loading ? "Processing..." : "Issue Refund"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={state.isCreateOpen}
                onClose={() => handlers.setIsCreateOpen(false)}
                title="Spin Up New Tenant"
            >
                <div className="mb-6">
                    <p className="text-zinc-500 text-sm">
                        Automated provisioning: This will create a database record, set up initial owner permissions, and allocate resources.
                    </p>
                </div>

                <form onSubmit={handlers.handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Studio Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Zen Garden Yoga"
                            value={state.formData.name}
                            onChange={(e) => {
                                const newName = e.target.value;
                                handlers.setFormData((prev: any) => {
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
                                value={state.formData.slug}
                                onChange={(e) => handlers.setFormData({ ...state.formData, slug: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Plan Tier</label>
                            <select
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={state.formData.plan}
                                onChange={(e) => handlers.setFormData({ ...state.formData, plan: e.target.value })}
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
                                value={state.formData.trialDays || ''}
                                onChange={(e) => handlers.setFormData({ ...state.formData, trialDays: parseInt(e.target.value) } as any)}
                            />
                            <p className="text-xs text-zinc-500 mt-1">Leave empty for no trial</p>
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => handlers.setIsCreateOpen(false)} className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium">Cancel</button>
                        <button type="submit" disabled={state.loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">
                            {state.loading ? "Provisioning..." : "Launch Studio"}
                        </button>
                    </div>
                </form>
            </Modal>

            {state.cancelModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl border border-red-100">
                        <div className="flex items-center gap-3 mb-4 text-red-600">
                            <AlertTriangle className="h-6 w-6" />
                            <h3 className="text-lg font-bold">Cancel Subscription?</h3>
                        </div>
                        <p className="text-sm text-zinc-600 mb-6">
                            Are you sure you want to cancel the subscription for this tenant? This action will disable billing at the end of the current period.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => handlers.setCancelModalOpen(false)}
                                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded"
                            >
                                No, Keep It
                            </button>
                            <button
                                onClick={handlers.confirmCancelSubscription}
                                disabled={state.loading}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium"
                            >
                                {state.loading ? 'Cancelling...' : 'Yes, Cancel Subscription'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {state.gracePeriodModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-md w-full shadow-xl border border-amber-100">
                        <div className="flex items-center gap-3 text-amber-600 mb-4 bg-amber-50 p-3 rounded-lg">
                            <Activity className="h-6 w-6" />
                            <span className="font-bold">{state.selectedTenantForGrace?.enabled ? 'Start Grace Period' : 'End Grace Period'}</span>
                        </div>
                        {state.selectedTenantForGrace?.enabled ? (
                            <>
                                <p className="text-zinc-600 text-sm mb-4">
                                    Enabling <strong>Grace Period</strong> will disable access to the Student Portal and Mobile App immediately.
                                </p>
                                <p className="text-zinc-600 text-sm mb-6">
                                    - Admins will retain access.<br />
                                    - Public schedules will be hidden.<br />
                                    - Tenant status remains "Active" for billing purposes unless changed.
                                </p>
                            </>
                        ) : (
                            <p className="text-zinc-600 text-sm mb-6">
                                Re-enabling access will restore Student Portal and Mobile App functionality immediately.
                            </p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => handlers.setGracePeriodModalOpen(false)}
                                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlers.confirmGracePeriod}
                                disabled={state.loading}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${state.selectedTenantForGrace?.enabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {state.loading ? 'Processing...' : (state.selectedTenantForGrace?.enabled ? 'Disable Access' : 'Restore Access')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={state.editModalOpen}
                onClose={() => handlers.setEditModalOpen(false)}
                title={`Edit Tenant: ${state.tenantToEdit?.name}`}
            >
                <form onSubmit={handlers.handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Owner Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={state.editEmail}
                            onChange={(e) => handlers.setEditEmail(e.target.value)}
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => handlers.setEditModalOpen(false)} className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium">Cancel</button>
                        <button type="submit" disabled={state.loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50">
                            {state.loading ? "Saving..." : "Update Owner"}
                        </button>
                    </div>
                </form>
            </Modal>

            {state.exportModal && (
                <DataExportModal
                    isOpen={state.exportModal.isOpen}
                    onClose={() => handlers.setExportModal(null)}
                    tenantId={state.exportModal.tenantId}
                    tenantName={state.exportModal.tenantName}
                    dataType={state.exportModal.dataType}
                />
            )}

            <ConfirmationDialog
                isOpen={state.impersonateModalOpen}
                onClose={() => handlers.setImpersonateModalOpen(false)}
                onConfirm={handlers.confirmImpersonate}
                title="Impersonate Tenant Owner"
                message={`Are you sure you want to log in as the owner of ${state.tenantToImpersonate?.name}? You will be logged out of your admin account.`}
                confirmText="Log In as Owner"
                isDestructive={false}
            />

            <Modal isOpen={state.notifyModalOpen} onClose={() => handlers.setNotifyModalOpen(false)} title="Send System Notification">
                <form onSubmit={handlers.handleNotifySend} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subject</label>
                        <input
                            type="text"
                            value={state.notifySubject}
                            onChange={(e) => handlers.setNotifySubject(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Message</label>
                        <textarea
                            value={state.notifyMessage}
                            onChange={(e) => handlers.setNotifyMessage(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 min-h-[100px]"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => handlers.setNotifyModalOpen(false)} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-md">Cancel</button>
                        <button type="submit" disabled={state.loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                            {state.loading ? "Sending..." : "Send Notification"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

