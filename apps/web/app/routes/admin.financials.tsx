import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { DollarSign, CheckCircle, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { PrivacyBlur } from "../components/PrivacyBlur";
import { ConfirmationDialog, ErrorDialog } from "~/components/Dialogs";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const preview = await apiRequest("/admin/billing/preview", token);
        return { preview, token };
    } catch (e: any) {
        return { error: e.message, token };
    }
};

export default function AdminFinancials() {
    const { preview: initialPreview, error: loadError, token } = useLoaderData<any>();
    const [preview, setPreview] = useState<any>(initialPreview);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Dialog State
    const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
    const [showError, setShowError] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });

    const refreshPreview = async () => {
        setLoading(true);
        try {
            const res = await apiRequest("/admin/billing/preview", token);
            setPreview(res);
            setResult(null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCharge = async () => {
        setShowInvoiceConfirm(false);
        setLoading(true);
        try {
            const res = await apiRequest("/admin/billing/charge", token, {
                method: "POST"
            });
            setResult(res);
            // Refresh after charge
            // Wait a sec for DB consistency?
            setTimeout(refreshPreview, 1000);
        } catch (e: any) {
            setShowError({ isOpen: true, message: "Charge failed: " + e.message });
        } finally {
            setLoading(false);
        }
    };

    const tenants = preview?.tenants || [];
    const totalRevenue = tenants.reduce((acc: number, t: any) => acc + t.total, 0).toFixed(2);
    const fees = preview?.fees || { sms: 0.0075, email: 0.0006, streaming: 0.05, storage: 0.02 };

    if (loadError) return <div className="p-8 text-red-600">Error loading billing data: {loadError}</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20 dark:text-zinc-100">
            <ConfirmationDialog
                isOpen={showInvoiceConfirm}
                onClose={() => setShowInvoiceConfirm(false)}
                onConfirm={handleCharge}
                title="Confirm Invoicing"
                message={`Are you sure you want to invoice ${tenants.length} tenants for a total of $${totalRevenue}?`}
                confirmText="Invoice Tenants"
            />

            <ErrorDialog
                isOpen={showError.isOpen}
                onClose={() => setShowError({ ...showError, isOpen: false })}
                message={showError.message}
            />

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Financials & Chargebacks</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Review usage and invoice tenants for subscriptions and overages.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={refreshPreview}
                        disabled={loading}
                        className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh Preview
                    </button>
                    <button
                        onClick={() => setShowInvoiceConfirm(true)}
                        disabled={loading || tenants.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <DollarSign size={16} />
                        Invoice {tenants.length} Tenants
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Projected Total Revenue</div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100"><PrivacyBlur revealed={true}>${totalRevenue}</PrivacyBlur></div>
                    <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle size={12} /> Ready to invoice
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Active Tenants</div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{tenants.length}</div>
                    <div className="text-xs text-zinc-400 mt-2">
                        Managed by platform
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Fee Schedule</div>
                    <div className="text-sm space-y-1 mt-2">
                        <div className="flex justify-between border-b border-zinc-50 dark:border-zinc-800 pb-1 mb-1"><span className="text-zinc-500 dark:text-zinc-400">Service Fee</span> <span className="font-mono">{fees.applicationFeePercent ? `${fees.applicationFeePercent * 100}%` : 'Var'}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">SMS</span> <span className="font-mono">${fees.sms}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Email</span> <span className="font-mono">${fees.email}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Stream</span> <span className="font-mono">${fees.streaming}/min</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Storage</span> <span className="font-mono">${fees.storage}/GB</span></div>
                    </div>
                </div>
            </div>

            {/* Result Message */}
            {result && (
                <div className={`mb-8 p-4 rounded-lg border ${result.success ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'}`}>
                    <h3 className="font-bold flex items-center gap-2">
                        {result.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        {result.success ? "Invoicing Complete" : "Invoicing Failed"}
                    </h3>
                    <div className="mt-2 text-sm">
                        {result.success ? (
                            <p>Successfully processed {result.charged} invoices.</p>
                        ) : (
                            <p>{result.error}</p>
                        )}
                        {result.details && (
                            <ul className="mt-2 list-disc list-inside opacity-80 h-32 overflow-y-auto">
                                {result.details.map((d: any, i: number) => (
                                    <li key={i}>
                                        {d.error ? (
                                            <span className="text-red-600 font-medium">Failed: {d.tenantId} - {d.error}</span>
                                        ) : (
                                            <span>Charged {d.name}: ${d.total.toFixed(2)} ({d.items.length} items)</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Preview Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex justify-between items-center">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Billing Preview</h3>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Including Base Subscription + Usage Overages</span>
                </div>

                {tenants.length === 0 ? (
                    <div className="p-12 text-center text-zinc-500">
                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-zinc-900">All Clear</h3>
                        <p className="max-w-sm mx-auto mt-1">No active tenants found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-zinc-900 dark:text-zinc-100">
                        <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tenant</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Base Plan</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Usage Breakdown</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {tenants.map((t: any) => (
                                <tr key={t.tenant.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{t.tenant.name}</div>
                                        <div className="text-zinc-500 dark:text-zinc-400 text-xs font-mono">{t.tenant.slug}</div>
                                        {t.tenant.stripeCustomerId ? (
                                            <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                                                <CheckCircle size={10} /> Billing Active
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                                                <AlertCircle size={10} /> No Billing ID
                                            </div>
                                        )}
                                        {t.tenant.stripeAccountId ? (
                                            <div className="text-[10px] text-blue-600 mt-0.5 flex items-center gap-1">
                                                <CheckCircle size={10} /> Payouts Active
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-amber-500 mt-0.5 flex items-center gap-1">
                                                <AlertCircle size={10} /> Payouts Pending
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {t.subscription && (
                                            <div>
                                                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.subscription.name}</div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400">${t.subscription.amount.toFixed(2)}/mo</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {Object.entries(t.costs).length === 0 ? (
                                            <span className="text-xs text-zinc-400 italic">No usage overages</span>
                                        ) : (
                                            <div className="space-y-1 text-sm">
                                                {Object.entries(t.costs).map(([key, val]: [string, any]) => (
                                                    <div key={key} className="flex justify-between max-w-[200px]">
                                                        <span className="text-zinc-600 dark:text-zinc-400 capitalize">{key}:</span>
                                                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                            {Math.round(val.quantity).toLocaleString()} units (${val.amount.toFixed(2)})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-zinc-900 dark:text-zinc-100">${t.total.toFixed(2)}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm border border-blue-100 dark:border-blue-900/50 flex gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <div>
                    <strong>Note on Invoicing:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 opacity-90 ml-1">
                        <li>The "Invoice" button generates standard Stripe Invoice Items for <strong>Usage Overages</strong>.</li>
                        <li>Base Plan fees are typically handled automatically by Stripe Subscriptions if configured. The total above is a <em>projection</em> of comprehensive revenue.</li>
                        <li>Verify Stripe Subscription status before manual invoicing to avoid double-charging base fees.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
