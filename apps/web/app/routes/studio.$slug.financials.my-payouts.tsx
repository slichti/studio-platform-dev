import { useOutletContext } from "react-router";
import { useState, useEffect } from "react";
import { apiRequest } from "../utils/api";
import { Loader2, DollarSign, Calendar } from "lucide-react";

export default function MyPayouts() {
    const { me } = useOutletContext<any>() as any;
    // @ts-ignore
    const [token, setToken] = useState<string | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // @ts-ignore
        window.Clerk?.session?.getToken().then(t => {
            setToken(t);
        });
    }, []);

    useEffect(() => {
        if (!token) return;
        const fetchHistory = async () => {
            try {
                const res = await apiRequest('/payroll/history?mine=true', token) as any;
                setHistory(res.history);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [token]);

    if (!token || loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    const totalPaid = history.filter(h => h.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const pending = history.filter(h => h.status === 'processing').reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Payouts</h1>
                <p className="text-zinc-500 text-sm">Track your earnings and payout status.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-zinc-500">Total Paid (YTD)</div>
                        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">${(totalPaid / 100).toFixed(2)}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-lg">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-zinc-500">Pending Processing</div>
                        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">${(pending / 100).toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4">Period</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Date Paid</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {history.map(row => (
                            <tr key={row.id}>
                                <td className="p-4">
                                    {new Date(row.periodStart).toLocaleDateString()} - {new Date(row.periodEnd).toLocaleDateString()}
                                </td>
                                <td className="p-4 font-mono font-medium">
                                    ${(row.amount / 100).toFixed(2)}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                        {row.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-zinc-500">
                                    {row.status === 'paid' && row.paidAt ? new Date(row.paidAt).toLocaleDateString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No payouts found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
