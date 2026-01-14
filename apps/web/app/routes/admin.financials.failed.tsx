import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { CheckCircle, AlertCircle, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { ConfirmationDialog, ErrorDialog, SuccessDialog } from "~/components/Dialogs";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const failedSubs = await apiRequest("/admin/billing/failed", token);
        return { failedSubs, token };
    } catch (e: any) {
        return { error: e.message, token };
    }
};

export default function AdminFailedPayments() {
    const { failedSubs: initialData, error: loadError, token } = useLoaderData<any>();
    const [failedSubs, setFailedSubs] = useState<any[]>(initialData || []);
    const [loading, setLoading] = useState(false);

    // Dialog States
    const [retryId, setRetryId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const refreshData = async () => {
        setLoading(true);
        try {
            const data = await apiRequest("/admin/billing/failed", token);
            setFailedSubs(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async () => {
        if (!retryId) return;
        setLoading(true);
        setRetryId(null);
        try {
            // Re-trigger global charge for this tenant basically, or we could add a specific retry endpoint.
            // For now, let's use the global charge endpoint scoped to this tenant if possible, or just catch-all.
            // Our previous work allowd passing tenantIds to /admin/billing/charge!
            const sub = failedSubs.find(s => s.id === retryId);
            if (sub && sub.tenantId) {
                await apiRequest("/admin/billing/charge", token, {
                    method: 'POST',
                    body: JSON.stringify({ tenantIds: [sub.tenantId] })
                });
                setSuccess("Payment retry initiated. Check status in a moment.");
                setTimeout(refreshData, 2000);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loadError) return <div className="p-8 text-red-600">Error loading failed payments: {loadError}</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <ConfirmationDialog
                isOpen={!!retryId}
                onClose={() => setRetryId(null)}
                onConfirm={handleRetry}
                title="Retry Payment"
                message="Are you sure you want to retry charging this tenant immediately?"
                confirmText="Retry Charge"
            />

            <ErrorDialog
                isOpen={!!error}
                onClose={() => setError(null)}
                message={error || ''}
            />

            <SuccessDialog
                isOpen={!!success}
                onClose={() => setSuccess(null)}
                message={success || ''}
            />

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Failed Payments & Dunning</h1>
                    <p className="text-zinc-500">Manage subscriptions that are at risk of cancellation.</p>
                </div>
                <button
                    onClick={refreshData}
                    disabled={loading}
                    className="px-4 py-2 border border-zinc-200 bg-white rounded-lg hover:bg-zinc-50 text-zinc-600 flex items-center gap-2"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                {failedSubs.length === 0 ? (
                    <div className="p-12 text-center text-zinc-500">
                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-zinc-900">All Good</h3>
                        <p className="max-w-sm mx-auto mt-1">No subscriptions are currently in a failed or warning state.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tenant</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dunning Phase</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Attempt</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {failedSubs.map((sub: any) => (
                                <tr key={sub.id} className="hover:bg-zinc-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900">{sub.tenant?.name || 'Unknown'}</div>
                                        <div className="text-zinc-500 text-xs font-mono">{sub.tenant?.slug}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-800' :
                                                sub.status === 'past_due' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {sub.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {sub.dunningState === 'failed' && <AlertCircle size={16} className="text-red-600" />}
                                            {sub.dunningState?.startsWith('warning') && <AlertTriangle size={16} className="text-orange-500" />}
                                            <span className="capitalize">{sub.dunningState?.replace(/(\d)/, ' $1')}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">
                                        {sub.lastDunningAt ? new Date(sub.lastDunningAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setRetryId(sub.id)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-4"
                                        >
                                            Retry
                                        </button>
                                        {sub.stripeSubscriptionId && (
                                            <a
                                                href={`https://dashboard.stripe.com/subscriptions/${sub.stripeSubscriptionId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-zinc-400 hover:text-zinc-600 inline-flex items-center gap-1"
                                                title="View in Stripe"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
