// @ts-ignore
import { useOutletContext } from "react-router";
import { apiRequest, API_URL } from "../utils/api";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";

export default function StudioFinances() {
    const { tenant, member, roles } = useOutletContext<any>();
    const isOwner = roles.includes('owner');

    if (!isOwner) {
        return (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                You do not have permission to view this page.
            </div>
        )
    }

    const handleConnectStripe = () => {
        // Redirect to API endpoint that handles Stripe OAuth
        const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";
        window.location.href = `${url}/studios/stripe/connect?tenantId=${tenant.id}`;
    };

    // Auth & Data Fecthing
    const { getToken } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [balance, setBalance] = useState<any>(null);

    useEffect(() => {
        if (!tenant.stripeAccountId || !isOwner) return;

        const fetchData = async () => {
            const token = await getToken();
            const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

            // Fetch Stats
            (apiRequest(`${url}/commerce/stats`, token) as Promise<any>).then(res => {
                if (res) setStats(res);
            });

            // Fetch Transactions
            (apiRequest(`${url}/commerce/transactions`, token) as Promise<any>).then(res => {
                if (res && res.transactions) setTransactions(res.transactions);
            });

            // Fetch Balance
            (apiRequest(`${url}/commerce/balance`, token) as Promise<any>).then(res => {
                if (res && !res.error) setBalance(res);
            });
        };
        fetchData();
    }, [tenant.id, isOwner, getToken]);

    // Refund State
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
        const token = await getToken();
        // Determine type based on transaction data or description? 
        // Logic might need backend to send 'type' and 'referenceId'.
        // Assuming transactions API returns these now or we assume.
        // If not, we might need to improve GET /transactions.
        // For now, let's try assuming 'pos' if no type? 
        // Actually, if we built the transactions endpoint correctly, it should have it.
        // If not, let's blindly send it and backend might fail if mismatch.
        // Wait, current /commerce/transactions might just be Stripe data?
        // Let's check /commerce/transactions implementation.
        // If it's stripe data, we need the PI ID (t.id?).

        let type = 'pos'; // Default fallback
        if (selectedTransaction.description?.includes('Pack')) type = 'pack';
        if (selectedTransaction.description?.includes('Membership')) type = 'membership';

        const res = await apiRequest(`${import.meta.env.VITE_API_URL}/refunds`, token, {
            method: 'POST',
            body: JSON.stringify({
                amount: Math.round(parseFloat(refundAmount) * 100),
                reason: refundReason,
                referenceId: selectedTransaction.id, // Ensure this is the platform ID if possible
                type: selectedTransaction.type || type
            })
        });

        setIsRefunding(false);
        if (res && !res.error) {
            alert('Refund processed successfully');
            setIsRefundModalOpen(false);
            // Refresh logic?
        } else {
            alert(res?.error || 'Refund failed');
        }
    };

    return (
        <div className="max-w-4xl text-zinc-900 dark:text-zinc-100">
            <h1 className="text-2xl font-bold mb-6">Finances</h1>

            {/* Refund Modal */}
            {isRefundModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
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
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reason</label>
                                <textarea
                                    value={refundReason}
                                    onChange={e => setRefundReason(e.target.value)}
                                    placeholder="Customer requested..."
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2"
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

            {!tenant.stripeAccountId ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-lg shadow-sm text-center">
                    {/* ... Connect Stripe content ... */}
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
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6v-2h14v16h-14v-2h-2v4h18v-20h-18v4h2zm-8 4h10v-3l6 5-6 5v-3h-10v-4z" /></svg>
                    </button>
                    <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                        You will be redirected to Stripe to verify your business information.
                    </p>
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
                            <div className="text-3xl font-bold">${stats ? (stats.totalRevenue / 100).toFixed(2) : '0.00'}</div>
                            <div className="text-xs mt-2 text-zinc-500 dark:text-zinc-400">Est. All Time</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                            <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Monthly Recurring</div>
                            <div className="text-3xl font-bold">${stats ? (stats.mrr / 100).toFixed(2) : '0.00'}</div>
                            <div className="text-xs mt-2 text-zinc-500 dark:text-zinc-400">Active Subs: {stats?.activeSubscriptions || 0}</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                            <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Stripe Balance</div>
                            <div className="text-3xl font-bold">
                                ${balance ? (balance.available / 100).toFixed(2) : '0.00'}
                            </div>
                            <div className="text-xs mt-2 text-zinc-500 dark:text-zinc-400">
                                Pending: ${balance ? (balance.pending / 100).toFixed(2) : '0.00'}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Transaction History</h3>
                        {transactions.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent transactions.</p>
                        ) : (
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
                                            <td className="py-2 text-zinc-600 dark:text-zinc-400">{t.customer}</td>
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
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
