// @ts-ignore
import { useOutletContext } from "react-router";
import { apiRequest, API_URL } from "../utils/api";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";

export default function StudioFinances() {
    const { tenant, member, roles } = useOutletContext<any>();
    const apiUrl = (useOutletContext() as any).env?.VITE_API_URL || "http://localhost:8787"; // Fallback or use env from loader if available
    // Actually, finances.tsx is a route, it doesn't receive env via props directly unless passed.
    // The previous code used imported API_URL.
    // I should re-add import { API_URL } from "../utils/api"; and check why it failed.
    // "Module '../utils/api' has no exported member 'API_URL'".
    // Let's import apiRequest and use hardcoded string or fix api.ts export.
    const isOwner = roles.includes('owner');

    if (!isOwner) {
        return (
            <div className="p-8 text-center text-zinc-500">
                You do not have permission to view this page.
            </div>
        )
    }

    const handleConnectStripe = () => {
        // Redirect to API endpoint that handles Stripe OAuth
        window.location.href = `${API_URL}/studios/stripe/connect?tenantId=${tenant.id}`;
    };

    const { getToken } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);

    useEffect(() => {
        if (!tenant.stripeAccountId || !isOwner) return;

        const fetchData = async () => {
            const token = await getToken();

            // Fetch Stats
            (apiRequest(`${API_URL}/commerce/stats`, token) as Promise<any>).then(res => {
                if (res) setStats(res);
            });

            // Fetch Transactions
            (apiRequest(`${API_URL}/commerce/transactions`, token) as Promise<any>).then(res => {
                if (res && res.transactions) setTransactions(res.transactions);
            });
        };
        fetchData();
    }, [tenant.id, isOwner, getToken]);

    return (
        <div className="max-w-4xl" style={{ color: 'var(--text)' }}>
            <h1 className="text-2xl font-bold mb-6">Finances</h1>

            {!tenant.stripeAccountId ? (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-8 rounded-lg shadow-sm text-center">
                    <div className="mb-4 text-4xl">💳</div>
                    <h2 className="text-xl font-bold mb-2">Setup Payouts</h2>
                    <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
                        Connect with Stripe to start accepting payments for classes and memberships.
                        Funds will be deposited directly to your bank account.
                    </p>
                    <button
                        onClick={handleConnectStripe}
                        className="bg-[#635BFF] text-white px-6 py-2.5 rounded-md font-medium hover:bg-[#534be0] transition-colors inline-flex items-center gap-2"
                    >
                        <span>Connect with Stripe</span>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6v-2h14v16h-14v-2h-2v4h18v-20h-18v4h2zm-8 4h10v-3l6 5-6 5v-3h-10v-4z" /></svg>
                    </button>
                    <p className="mt-4 text-xs text-zinc-400">
                        You will be redirected to Stripe to verify your business information.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                ✓
                            </div>
                            <div>
                                <h3 className="font-semibold text-green-800">Stripe Connected</h3>
                                <p className="text-sm text-green-600">Your account is ready to process payments.</p>
                            </div>
                        </div>
                        <div className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                            {tenant.stripeAccountId}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-6 rounded-lg shadow-sm">
                            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Total Revenue</div>
                            <div className="text-3xl font-bold">${stats ? (stats.totalRevenue / 100).toFixed(2) : '0.00'}</div>
                            <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Est. All Time</div>
                        </div>
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-6 rounded-lg shadow-sm">
                            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Monthly Recurring</div>
                            <div className="text-3xl font-bold">${stats ? (stats.mrr / 100).toFixed(2) : '0.00'}</div>
                            <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Active Subs: {stats?.activeSubscriptions || 0}</div>
                        </div>
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-6 rounded-lg shadow-sm">
                            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Upcoming Payout</div>
                            <div className="text-3xl font-bold">$0.00</div>
                            {/* Needs Stripe Balance Integration */}
                        </div>
                    </div>

                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                        <h3 className="font-semibold mb-4">Transaction History</h3>
                        {transactions.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent transactions.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                                        <th className="text-left py-2 font-medium">Date</th>
                                        <th className="text-left py-2 font-medium">Description</th>
                                        <th className="text-left py-2 font-medium">Customer</th>
                                        <th className="text-right py-2 font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((t: any) => (
                                        <tr key={t.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                                            <td className="py-2">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="py-2">{t.description}</td>
                                            <td className="py-2">{t.customer}</td>
                                            <td className="py-2 text-right">${(t.amount / 100).toFixed(2)}</td>
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
