import { useOutletContext } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "../../utils/api";
import { ConfirmationDialog, ErrorDialog, SuccessDialog } from "~/components/Dialogs";
import { Skeleton, SkeletonLoader } from "~/components/ui/SkeletonLoader";

export default function FinancesPage() {
    const { tenant, roles } = useOutletContext<any>();
    const isOwner = roles.includes('owner');

    const handleConnectStripe = () => {
        const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";
        window.location.href = `${url}/studios/stripe/connect?tenantId=${tenant.id}`;
    };

    const { getToken } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [lastId, setLastId] = useState<string | null>(null);
    const [balance, setBalance] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });
    const [successDialog, setSuccessDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });
    const [retryConfirmId, setRetryConfirmId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!tenant.stripeAccountId || !isOwner) return;
        setLoading(true);

        const token = await getToken();
        const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

        try {
            const [statsRes, transRes, balanceRes] = await Promise.all([
                apiRequest(`${url}/commerce/stats`, token),
                apiRequest(`${url}/commerce/transactions?limit=20`, token),
                apiRequest(`${url}/commerce/balance`, token)
            ]);

            if (statsRes) setStats(statsRes);
            if (transRes) {
                setTransactions(transRes.transactions || []);
                setHasMore(transRes.hasMore);
                setLastId(transRes.lastId);
            }
            if (balanceRes && !balanceRes.error) setBalance(balanceRes);
        } catch (e) {
            console.error("Failed to fetch finances:", e);
        } finally {
            setLoading(false);
        }
    }, [tenant.id, tenant.stripeAccountId, isOwner, getToken]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || !lastId) return;
        setLoadingMore(true);

        const token = await getToken();
        const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

        try {
            const res = await apiRequest(`${url}/commerce/transactions?limit=20&starting_after=${lastId}`, token);
            if (res && res.transactions) {
                setTransactions(prev => [...prev, ...res.transactions]);
                setHasMore(res.hasMore);
                setLastId(res.lastId);
            }
        } catch (e) {
            console.error("Failed to load more transactions:", e);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);


    const [activeTab, setActiveTab] = useState<'overview' | 'failed'>('overview');
    const [failedPayments, setFailedPayments] = useState<any[]>([]);
    const [retryLoading, setRetryLoading] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'failed' && isOwner) {
            const fetchFailed = async () => {
                const token = await getToken();
                const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";
                const res: any = await apiRequest(`${url}/failed-payments`, token);
                if (res?.payments) setFailedPayments(res.payments);
            };
            fetchFailed();
        }
    }, [activeTab, isOwner, getToken]);

    const confirmRetryPayment = async () => {
        if (!retryConfirmId) return;
        setRetryLoading(retryConfirmId);
        try {
            const token = await getToken();
            const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";
            const res: any = await apiRequest(`${url}/failed-payments/${retryConfirmId}/retry`, token, { method: 'POST' });

            if (res.success) {
                setSuccessDialog({ isOpen: true, message: `Payment successful! (Status: ${res.status})` });
                setFailedPayments(prev => prev.filter(p => p.id !== retryConfirmId));
            } else {
                setErrorDialog({ isOpen: true, message: res.error || "Retry failed" });
            }
        } catch (e) {
            setErrorDialog({ isOpen: true, message: "Error processing retry" });
        } finally {
            setRetryLoading(null);
            setRetryConfirmId(null);
        }
    };

    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [refundReason, setRefundReason] = useState<string>('');
    const [isRefunding, setIsRefunding] = useState(false);

    const handleOpenRefund = (t: any) => {
        setSelectedTransaction(t);
        setRefundAmount((t.amount / 100).toFixed(2));
        setIsRefundModalOpen(true);
    };

    const handleRefund = async () => {
        if (!selectedTransaction) return;
        setIsRefunding(true);
        try {
            const token = await getToken();
            let type = 'pos';
            if (selectedTransaction.description?.includes('Pack')) type = 'pack';
            if (selectedTransaction.description?.includes('Membership')) type = 'membership';

            const res = await apiRequest(`${import.meta.env.VITE_API_URL}/refunds`, token, {
                method: 'POST',
                body: JSON.stringify({
                    amount: Math.round(parseFloat(refundAmount) * 100),
                    reason: refundReason,
                    referenceId: selectedTransaction.id,
                    type: selectedTransaction.type || type
                })
            });

            if (res && !res.error) {
                setSuccessDialog({ isOpen: true, message: 'Refund processed successfully' });
                setIsRefundModalOpen(false);
            } else {
                setErrorDialog({ isOpen: true, message: res?.error || 'Refund failed' });
            }
        } catch (e: any) {
            setErrorDialog({ isOpen: true, message: e.message || 'Refund failed' });
        } finally {
            setIsRefunding(false);
        }
    };

    return (
        <div className="max-w-4xl text-zinc-900 dark:text-zinc-100">
            <ErrorDialog
                isOpen={errorDialog.isOpen}
                onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })}
                message={errorDialog.message}
            />
            <SuccessDialog
                isOpen={successDialog.isOpen}
                onClose={() => setSuccessDialog({ ...successDialog, isOpen: false })}
                message={successDialog.message}
            />
            <ConfirmationDialog
                isOpen={!!retryConfirmId}
                onClose={() => setRetryConfirmId(null)}
                onConfirm={confirmRetryPayment}
                title="Retry Payment"
                message="Attempt to charge the customer's payment method now?"
                confirmText="Charge Now"
            />

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Finances</h1>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'overview' ? 'bg-white dark:bg-black shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('failed')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-2 ${activeTab === 'failed' ? 'bg-white dark:bg-black shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        Failed Payments
                        {failedPayments.length > 0 && <span className="w-5 h-5 flex items-center justify-center bg-red-100 text-red-600 text-xs rounded-full">{failedPayments.length}</span>}
                    </button>
                </div>
            </div>

            {isRefundModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold mb-4">Process Refund</h3>
                        <p className="text-sm text-zinc-500 mb-6">
                            Refund for {selectedTransaction?.description} on {new Date(selectedTransaction?.date).toLocaleDateString()}
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Amount ($)</label>
                                <input
                                    type="number"
                                    value={refundAmount}
                                    onChange={e => setRefundAmount(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reason</label>
                                <textarea
                                    value={refundReason}
                                    onChange={e => setRefundReason(e.target.value)}
                                    placeholder="Customer requested..."
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 justify-end">
                            <button
                                onClick={() => setIsRefundModalOpen(false)}
                                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRefund}
                                disabled={isRefunding}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                                {isRefunding ? 'Processing...' : 'Confirm Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'failed' ? (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <h3 className="font-semibold">Failed Subscription Payments</h3>
                            <p className="text-sm text-zinc-500">Subscriptions currently suspended due to payment failure.</p>
                        </div>
                        {failedPayments.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500">
                                <p>No failed payments found. All subscriptions are healthy.</p>
                            </div>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                                        <th className="text-left px-4 py-3 font-medium text-zinc-500">Customer</th>
                                        <th className="text-left px-4 py-3 font-medium text-zinc-500">Plan</th>
                                        <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-zinc-500">Date</th>
                                        <th className="text-right px-4 py-3 font-medium text-zinc-500">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {failedPayments.map((sub: any) => (
                                        <tr key={sub.id} className="border-b last:border-0 border-zinc-200 dark:border-zinc-800">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{sub.member?.user?.name || 'Unknown'}</div>
                                                <div className="text-xs text-zinc-500">{sub.member?.user?.email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-600">{sub.planId}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sub.dunningState === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {sub.dunningState?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-500">
                                                {sub.lastDunningAt ? new Date(sub.lastDunningAt).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setRetryConfirmId(sub.id)}
                                                    disabled={retryLoading === sub.id}
                                                    className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded hover:bg-zinc-800 disabled:opacity-50"
                                                >
                                                    {retryLoading === sub.id ? 'Retrying...' : 'Retry Payment'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : (
                !tenant.stripeAccountId ? (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-lg shadow-sm text-center">
                        <div className="mb-4 text-4xl">💳</div>
                        <h2 className="text-xl font-bold mb-2">Setup Payouts</h2>
                        <p className="mb-6 max-w-md mx-auto text-zinc-500 dark:text-zinc-400">
                            Connect with Stripe to start accepting payments for class packs and memberships.
                            Funds will be deposited directly to your bank account.
                        </p>
                        <button
                            onClick={handleConnectStripe}
                            className="bg-[#635BFF] text-white px-6 py-2.5 rounded-md font-medium hover:bg-[#534be0] transition-colors inline-flex items-center gap-2"
                        >
                            <span>Connect with Stripe</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-300">
                                    ✓
                                </div>
                                <div>
                                    <h3 className="font-semibold text-green-800 dark:text-green-300">Stripe Connected</h3>
                                    <p className="text-sm text-green-600 dark:text-green-400">Your account is ready to process payments.</p>
                                </div>
                            </div>
                            <div className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
                                {tenant.stripeAccountId}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                                <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Total Revenue</div>
                                {loading ? (
                                    <Skeleton className="h-8 w-24" />
                                ) : (
                                    <div className="text-3xl font-bold">${stats ? stats.totalRevenue.toFixed(2) : '0.00'}</div>
                                )}
                            </div>
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                                <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Monthly Recurring</div>
                                {loading ? (
                                    <Skeleton className="h-8 w-24" />
                                ) : (
                                    <div className="text-3xl font-bold">${stats ? stats.mrr.toFixed(2) : '0.00'}</div>
                                )}
                            </div>
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                                <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Stripe Balance</div>
                                {loading ? (
                                    <Skeleton className="h-8 w-24" />
                                ) : (
                                    <div className="text-3xl font-bold">
                                        ${balance?.available?.[0] ? (balance.available[0].amount / 100).toFixed(2) : '0.00'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Transaction History</h3>
                            {loading && transactions.length === 0 ? (
                                <div className="space-y-4">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-zinc-800">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                    ))}
                                </div>
                            ) : transactions.length === 0 ? (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent transactions.</p>
                            ) : (
                                <div className="space-y-4">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                                <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">Date</th>
                                                <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">Description</th>
                                                <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">Customer</th>
                                                <th className="text-right py-2 font-medium text-zinc-700 dark:text-zinc-300">Amount</th>
                                                <th className="text-right py-2 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((t: any) => (
                                                <tr key={t.id} className="border-b last:border-0 border-zinc-200 dark:border-zinc-700">
                                                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{new Date(t.date).toLocaleDateString()}</td>
                                                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{t.description}</td>
                                                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{t.customerName}</td>
                                                    <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">${(t.amount / 100).toFixed(2)}</td>
                                                    <td className="py-2 text-right">
                                                        <button
                                                            onClick={() => handleOpenRefund(t)}
                                                            className="text-xs text-red-600 hover:text-red-700 hover:underline"
                                                        >
                                                            Refund
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {hasMore && (
                                        <div className="flex justify-center pt-4">
                                            <button
                                                onClick={loadMore}
                                                disabled={loadingMore}
                                                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
                                            >
                                                {loadingMore ? 'Loading...' : 'Load More Transactions'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            )}
        </div>
    );
}

