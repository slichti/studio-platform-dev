// @ts-ignore
import { useState } from "react";
// @ts-ignore
import { useLoaderData, useParams } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import {
    Ticket,
    Plus,
    Search,
    History,
    Filter,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownLeft,
    Loader2,
    Calendar
} from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const giftCardsRes: any = await apiRequest("/gift-cards", token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return { giftCards: giftCardsRes || [], token };
    } catch (e) {
        return { giftCards: [], token };
    }
}

export default function GiftCardsPage() {
    const { giftCards: initialCards, token } = useLoaderData<typeof loader>();
    const { slug } = useParams();

    const [giftCards, setGiftCards] = useState(initialCards);
    const [searchQuery, setSearchQuery] = useState("");
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Issue Modal State
    const [issueData, setIssueData] = useState({
        amount: "",
        recipientEmail: "",
        notes: ""
    });

    const handleIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res: any = await apiRequest("/gift-cards/issue", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    amount: parseFloat(issueData.amount) * 100,
                    recipientEmail: issueData.recipientEmail,
                    notes: issueData.notes
                })
            });
            if (res.error) throw new Error(res.error);

            setShowIssueModal(false);
            setIssueData({ amount: "", recipientEmail: "", notes: "" });
            // Refresh list
            const refresh: any = await apiRequest("/gift-cards", token, {
                headers: { 'X-Tenant-Slug': slug! }
            });
            setGiftCards(refresh || []);
            alert(`Gift Card issued: ${res.code}`);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredCards = giftCards.filter((c: any) =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <Ticket className="text-blue-600" /> Gift Cards & Credits
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage store credit, issue gift cards, and track redemptions.</p>
                </div>
                <button
                    onClick={() => setShowIssueModal(true)}
                    className="bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:translate-y-[-2px] transition-all"
                >
                    <Plus size={20} /> Issue New Card
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Stats Cards */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Active Balance</p>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                            ${(giftCards.reduce((acc: number, c: any) => acc + (c.status === 'active' ? c.currentBalance : 0), 0) / 100).toLocaleString()}
                        </h2>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Issued</p>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                            ${(giftCards.reduce((acc: number, c: any) => acc + c.initialValue, 0) / 100).toLocaleString()}
                        </h2>
                    </div>
                </div>

                {/* Main Table */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Find by code or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Gift Card</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Balance</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Issued</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                {filteredCards.map((card: any) => (
                                    <tr key={card.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{card.code}</span>
                                                <span className="text-xs text-zinc-500">{card.recipientEmail || 'No recipient'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">${(card.currentBalance / 100).toFixed(2)}</span>
                                                <span className="text-[10px] text-zinc-400 uppercase font-bold">of ${(card.initialValue / 100).toFixed(2)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter ${card.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                                card.status === 'exhausted' ? 'bg-zinc-200 text-zinc-600' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {card.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-zinc-500">
                                            {new Date(card.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Issue Modal */}
            {showIssueModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800">
                            <h2 className="text-2xl font-black">Issue Gift Card</h2>
                            <p className="text-sm text-zinc-500">This will generate a unique code for store credit.</p>
                        </div>
                        <form onSubmit={handleIssue} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Amount ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="50.00"
                                    required
                                    value={issueData.amount}
                                    onChange={e => setIssueData({ ...issueData, amount: e.target.value })}
                                    className="w-full px-4 py-4 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl text-lg font-bold outline-none ring-2 ring-transparent focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Recipient Email (Optional)</label>
                                <input
                                    type="email"
                                    placeholder="friend@example.com"
                                    value={issueData.recipientEmail}
                                    onChange={e => setIssueData({ ...issueData, recipientEmail: e.target.value })}
                                    className="w-full px-4 py-4 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl text-sm outline-none ring-2 ring-transparent focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowIssueModal(false)}
                                    className="py-4 font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="py-4 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 hover:translate-y-[-2px] active:translate-y-0 transition-all"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Issue Credit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
