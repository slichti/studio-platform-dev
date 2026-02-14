
import { Activity, Globe, Users, LogIn, Bell, Smartphone, Monitor, ShoppingCart, Mail, Video, CreditCard, Settings, AlertTriangle } from "lucide-react";
import { PrivacyBlur } from "../../PrivacyBlur";

interface TenantDetailViewProps {
    t: any;
    showFinancials: boolean;
    subscriptionDetails: any;
    tenantFeatures: any;
    tenantStats: any;
    invoices: any[];
    featuresLoading: boolean;
    exportLoading: string | null;
    platformConfig: any[];
    FEATURES: any[];
    handlers: {
        handleIntervalChange: (id: string, interval: string) => void;
        handleSubscriptionUpdate: (id: string, days: number) => void;
        handleCancelSubscription: (id: string) => void;
        openRefundModal: (id: string) => void;
        handleLimitUpdate: (id: string, key: string, value: any) => void;
        handleWaiveUsage: (id: string) => void;
        handleExport: (id: string, type: any) => void;
        handleGracePeriod: (id: string, enabled: boolean) => void;
        handleArchive: (id: string) => void;
        handleRestore: (id: string) => void;
        handleImpersonate: (tenant: any) => void;
        setSelectedTenantForOwners: (tenant: any) => void;
        setOwnersModalOpen: (open: boolean) => void;
        openNotifyModal: (id: string) => void;
        setExportModal: (data: any) => void;
        handleFeatureToggle: (tenantId: string, featureKey: string, currentValue: boolean) => void;
        openZoomConfig: (id: string) => void;
        setRenewalDateChange: (data: any) => void;
        setSelectedTenantForRefund: (id: string) => void;
        setRefundPaymentIntent: (id: string) => void;
        setRefundAmount: (amount: string) => void;
        setRefundModalOpen: (open: boolean) => void;
        setDeleteModalOpen: (open: boolean) => void;
        setTenantToDelete: (id: string | null) => void;
        setDeleteInput: (input: string) => void;
    };
}

export function TenantDetailView({
    t,
    showFinancials,
    subscriptionDetails,
    tenantFeatures,
    tenantStats,
    invoices,
    featuresLoading,
    exportLoading,
    platformConfig,
    FEATURES,
    handlers
}: TenantDetailViewProps) {
    const details = subscriptionDetails[t.id] || {};
    const tenantInvoices = invoices[t.id] || [];

    return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-inner space-y-6">

            {/* Subscription & Billing Header */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Subscription Information</div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${t.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                                t.subscriptionStatus === 'past_due' ? 'bg-orange-100 text-orange-800' :
                                    t.subscriptionStatus === 'canceled' ? 'bg-red-100 text-red-800' :
                                        'bg-zinc-200 text-zinc-800'
                                }`}>
                                {t.subscriptionStatus === 'past_due' ? 'Past Due' : t.subscriptionStatus || 'trialing'}
                            </span>
                            <select
                                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
                                value={details?.interval || 'monthly'}
                                onChange={(e) => handlers.handleIntervalChange(t.id, e.target.value)}
                            >
                                <option value="monthly">Monthly</option>
                                <option value="annual">Annual</option>
                            </select>
                        </div>
                        {details?.cancelAtPeriodEnd && (
                            <div className="text-[10px] text-red-600 font-medium mt-1">Cancels at end of period</div>
                        )}
                    </div>

                    <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block"></div>

                    <div>
                        <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Period Ends</div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                className="text-xs border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-zinc-400 transition-colors"
                                defaultValue={t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toISOString().split('T')[0] : ''}
                                onBlur={(e) => {
                                    if (e.target.value && e.target.value !== (t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toISOString().split('T')[0] : '')) {
                                        handlers.setRenewalDateChange({ id: t.id, date: e.target.value });
                                    }
                                }}
                            />
                            <div className="flex text-[10px] gap-1">
                                <button onClick={(e) => { e.stopPropagation(); handlers.handleSubscriptionUpdate(t.id, 30); }} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">+30d</button>
                                <button onClick={(e) => { e.stopPropagation(); handlers.handleSubscriptionUpdate(t.id, 9999); }} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600">∞</button>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button onClick={(e) => { e.stopPropagation(); handlers.handleCancelSubscription(t.id); }} className="text-[10px] text-red-600 hover:underline">Cancel Subs</button>
                            <button onClick={(e) => { e.stopPropagation(); handlers.openRefundModal(t.id); }} className="text-[10px] text-zinc-500 hover:text-zinc-800 hover:underline">Refund</button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 border-l border-zinc-200 dark:border-zinc-800 pl-6 border-l-0 md:border-l">
                    <div>
                        <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">SMS Limit</label>
                        <input type="number"
                            className={`w-20 text-xs border rounded px-2 py-1 ${t.billingExempt ? 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500' : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'}`}
                            defaultValue={t.smsLimit || 0}
                            onBlur={(e) => handlers.handleLimitUpdate(t.id, 'smsLimit', parseInt(e.target.value))}
                        />
                        <div className="mt-2 w-full">
                            {t.billingExempt ? (
                                <div className="text-center">
                                    <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Unlimited</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>{t.smsUsage || 0} sent</span>
                                        <span>{Math.round(((t.smsUsage || 0) / (t.smsLimit || 1)) * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${(t.smsUsage || 0) >= (t.smsLimit || 0) ? 'bg-red-500' :
                                                ((t.smsUsage || 0) / (t.smsLimit || 1)) > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${Math.min(100, ((t.smsUsage || 0) / (t.smsLimit || 1)) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 text-right">{t.smsLimit || 0} limit</div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">Email Limit</label>
                        <input type="number"
                            className={`w-20 text-xs border rounded px-2 py-1 ${t.billingExempt ? 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500' : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'}`}
                            defaultValue={t.emailLimit || 0}
                            onBlur={(e) => handlers.handleLimitUpdate(t.id, 'emailLimit', parseInt(e.target.value))}
                        />
                        <div className="mt-2 w-full">
                            {t.billingExempt ? (
                                <div className="text-center">
                                    <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Unlimited</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>{t.emailUsage || 0} sent</span>
                                        <span>{Math.round(((t.emailUsage || 0) / (t.emailLimit || 1)) * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${(t.emailUsage || 0) >= (t.emailLimit || 0) ? 'bg-red-500' :
                                                ((t.emailUsage || 0) / (t.emailLimit || 1)) > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${Math.min(100, ((t.emailUsage || 0) / (t.emailLimit || 1)) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 text-right">{t.emailLimit || 0} limit</div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 pt-0">
                        <div className="flex items-center gap-2">
                            <input type="checkbox"
                                id={`exempt-${t.id}`}
                                className="rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 text-blue-600 focus:ring-blue-500"
                                defaultChecked={!!t.billingExempt}
                                onChange={(e) => handlers.handleLimitUpdate(t.id, 'billingExempt', e.target.checked)}
                            />
                            <label className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none font-medium" htmlFor={`exempt-${t.id}`}>Billing Exempt</label>
                        </div>
                        {t.billingExempt && (
                            <span className="text-[10px] text-zinc-400 pl-5">Limits ignored</span>
                        )}
                        {!t.billingExempt && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handlers.handleWaiveUsage(t.id); }}
                                className="mt-2 text-[10px] text-zinc-400 hover:text-blue-600 hover:underline text-left pl-5"
                            >
                                Waive Usage (Reset)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Testing & Access */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mt-4 mb-6">
                <h4 className="text-[10px] uppercase text-zinc-500 font-bold mb-3">Testing & Access</h4>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <a
                        href={`/?__studio=${t.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 border border-blue-200 px-3 py-2 rounded-md transition-colors w-fit"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Globe size={16} />
                        Open Public Site
                    </a>
                    <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                        <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[10px] font-mono">?__studio={t.slug}</span>
                        <span className="italic">Use Incognito window to view as guest.</span>
                    </span>
                </div>
            </div>

            {/* Ownership & Access */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mt-4 mb-6">
                <h4 className="text-[10px] uppercase text-zinc-500 font-bold mb-3">Ownership & Access</h4>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); handlers.setSelectedTenantForOwners({ id: t.id, name: t.name }); handlers.setOwnersModalOpen(true); }}
                        className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <Users size={16} />
                        Manage Owners
                    </button>
                    <button
                        className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handlers.handleImpersonate({ id: t.id, name: t.name }); }}
                    >
                        <LogIn size={16} />
                        Log in as Owner
                    </button>
                    <button
                        className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handlers.openNotifyModal(t.id); }}
                    >
                        <Bell size={16} />
                        Send Notification
                    </button>
                </div>
            </div>

            {/* Lifecycle & Data Export */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mt-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] uppercase text-zinc-500 font-bold">Lifecycle & Data</div>
                    <div className="flex gap-2">
                        {t.status === 'archived' ? (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); handlers.handleRestore(t.id) }} className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded hover:bg-emerald-200">
                                    Restore Tenant
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlers.setTenantToDelete(t.id);
                                        handlers.setDeleteInput("");
                                        handlers.setDeleteModalOpen(true);
                                    }}
                                    className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                                >
                                    Delete Tenant
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlers.handleGracePeriod(t.id, !t.studentAccessDisabled) }}
                                    className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors ${t.studentAccessDisabled ? 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200' : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}
                                >
                                    {t.studentAccessDisabled ? 'Enable Student Access' : 'Start Grace Period'}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handlers.handleArchive(t.id) }} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded hover:bg-red-100">
                                    Archive
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); handlers.setExportModal({ isOpen: true, tenantId: t.id, tenantName: t.name, dataType: 'subscribers' }); }}
                        className="text-left bg-zinc-50 border border-zinc-200 rounded p-2 hover:bg-zinc-100 group transition-all"
                    >
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="bg-white p-0.5 rounded border border-zinc-200 text-zinc-500 group-hover:text-blue-600 text-[10px]">⬇</span>
                            <span className="text-xs font-bold text-zinc-700">Subscribers</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">View & select members</div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlers.setExportModal({ isOpen: true, tenantId: t.id, tenantName: t.name, dataType: 'financials' }); }}
                        className="text-left bg-zinc-50 border border-zinc-200 rounded p-2 hover:bg-zinc-100 group transition-all"
                    >
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="bg-white p-0.5 rounded border border-zinc-200 text-zinc-500 group-hover:text-green-600 text-[10px]">⬇</span>
                            <span className="text-xs font-bold text-zinc-700">Financials</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">View & select transactions</div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlers.setExportModal({ isOpen: true, tenantId: t.id, tenantName: t.name, dataType: 'products' }); }}
                        className="text-left bg-zinc-50 border border-zinc-200 rounded p-2 hover:bg-zinc-100 group transition-all"
                    >
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="bg-white p-0.5 rounded border border-zinc-200 text-zinc-500 group-hover:text-purple-600 text-[10px]">⬇</span>
                            <span className="text-xs font-bold text-zinc-700">Products</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">View & select products</div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlers.handleExport(t.id, 'classes') }}
                        disabled={!!exportLoading}
                        className="text-left bg-zinc-50 border border-zinc-200 rounded p-2 hover:bg-zinc-100 disabled:opacity-50 group transition-all"
                    >
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="bg-white p-0.5 rounded border border-zinc-200 text-zinc-500 group-hover:text-amber-600 text-[10px]">⬇</span>
                            <span className="text-xs font-bold text-zinc-700">Classes</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">Schedule & Attendance</div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlers.handleExport(t.id, 'vod') }}
                        disabled={!!exportLoading}
                        className="text-left bg-zinc-50 border border-zinc-200 rounded p-2 hover:bg-zinc-100 disabled:opacity-50 group transition-all"
                    >
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="bg-white p-0.5 rounded border border-zinc-200 text-zinc-500 group-hover:text-red-500 text-[10px]">⬇</span>
                            <span className="text-xs font-bold text-zinc-700">VOD Usage</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">Storage & Streaming</div>
                    </button>
                </div>
            </div>

            {/* Payment History */}
            <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Recent Payments</h4>
                <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                            <tr>
                                <th className="px-4 py-2 font-medium">Date</th>
                                <th className="px-4 py-2 font-medium">Amount</th>
                                <th className="px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {tenantInvoices.length ? (
                                tenantInvoices.map((inv: any) => (
                                    <tr key={inv.id} className="hover:bg-zinc-50">
                                        <td className="px-4 py-2 text-zinc-600">
                                            {new Date(inv.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-2 font-medium text-zinc-900">
                                            ${(inv.amount / 100).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                                                inv.status === 'open' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-zinc-100 text-zinc-600'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right flex justify-end gap-3">
                                            {inv.hostedUrl && (
                                                <a href={inv.hostedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Invoice</a>
                                            )}
                                            {inv.paymentIntentId && inv.amount > 0 && inv.status === 'paid' && (
                                                <button
                                                    onClick={() => {
                                                        handlers.setSelectedTenantForRefund(t.id);
                                                        handlers.setRefundPaymentIntent(inv.paymentIntentId);
                                                        handlers.setRefundAmount('');
                                                        handlers.setRefundModalOpen(true);
                                                    }}
                                                    className="text-zinc-500 hover:text-red-600"
                                                >
                                                    Refund
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-4 py-4 text-center text-zinc-400 italic">No payment history available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {featuresLoading ? (
                <div className="text-sm text-zinc-500 py-2">Loading capabilities...</div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map(f => {
                            const state = (tenantFeatures[t.id] || {})[f.key] || { enabled: false, source: 'manual' };
                            const globalKey = `feature_${f.key}`;
                            const globalFeature = platformConfig?.find((c: any) => c.key === globalKey);
                            const isDisabledByPlatform = !globalFeature || !globalFeature.enabled;

                            return (
                                <div key={f.key} className={`flex items-center justify-between p-3 border rounded-md ${isDisabledByPlatform ? 'bg-zinc-100 opacity-60' : 'bg-zinc-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <f.icon size={18} className={isDisabledByPlatform ? "text-zinc-400" : "text-zinc-500"} />
                                        <div>
                                            <div className={`text-sm font-medium ${isDisabledByPlatform ? 'text-zinc-500' : 'text-zinc-900'}`}>{f.label}</div>
                                            <div className="text-xs text-zinc-500">{isDisabledByPlatform ? 'Disabled by Platform' : `Source: ${state.source}`}</div>
                                            <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[180px]" title={f.sections}>{f.sections}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {f.key === 'zoom' && state.enabled && !isDisabledByPlatform && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handlers.openZoomConfig(t.id); }}
                                                className="p-1 text-zinc-500 hover:text-blue-600 hover:bg-zinc-200 rounded"
                                                title="Configure Zoom Credentials"
                                            >
                                                <Settings size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isDisabledByPlatform) return;
                                                handlers.handleFeatureToggle(t.id, f.key, state.enabled);
                                            }}
                                            disabled={isDisabledByPlatform}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isDisabledByPlatform ? 'bg-zinc-300 cursor-not-allowed' :
                                                state.enabled ? 'bg-blue-600' : 'bg-gray-200'
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
    );
}

