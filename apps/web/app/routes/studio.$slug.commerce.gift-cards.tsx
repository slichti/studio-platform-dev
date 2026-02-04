
import { useState, useEffect } from "react";

import { useLoaderData, useParams, useOutletContext, Link, useSearchParams } from "react-router";

import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
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
    Calendar,
    CreditCard,
    Gift,
    Send,
    Link as LinkIcon,
    ChevronDown,
    ChevronUp,
    Ban,
    Mail,
    CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const giftCardsRes: any = await apiRequest("/gift-cards", token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return { giftCards: giftCardsRes.giftCards || [], token };
    } catch (e) {
        return { giftCards: [], token };
    }
}

export default function GiftCardsPage() {
    const { giftCards: initialCards, token } = useLoaderData<typeof loader>();
    const { slug } = useParams();
    const { roles } = useOutletContext<any>() || {};
    const isAdmin = roles?.includes('owner') || roles?.includes('instructor');

    const [giftCards, setGiftCards] = useState(initialCards);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'list' | 'buy'>('list');
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Action Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Issue Modal State (Admin)
    const [issueData, setIssueData] = useState({ amount: "", recipientEmail: "", notes: "" });
    const [issueSuccess, setIssueSuccess] = useState<string | null>(null);
    const [confirmResendId, setConfirmResendId] = useState<string | null>(null);

    // Link Modal State
    const [linkCode, setLinkCode] = useState("");
    const [linkSuccess, setLinkSuccess] = useState(false);

    // Buy Form State
    const [buyData, setBuyData] = useState({
        amount: "50", customAmount: "", isForSelf: true,
        recipientEmail: "", recipientName: "", senderName: "", message: ""
    });

    const refreshCards = async () => {
        const refresh: any = await apiRequest("/gift-cards", token, { headers: { 'X-Tenant-Slug': slug! } });
        setGiftCards(refresh.giftCards || []);
    };

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
            setIssueSuccess(`Card Issued: ${res.code}`);
            setIssueData({ amount: "", recipientEmail: "", notes: "" });
            await refreshCards();
        } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    };

    const handleResend = (cardId: string) => {
        setConfirmResendId(cardId);
    };

    const confirmResendAction = async () => {
        if (!confirmResendId) return;
        setLoading(true);
        try {
            const res: any = await apiRequest(`/gift-cards/${confirmResendId}/resend`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! }
            });
            if (res.error) throw new Error(res.error);
            toast.success("Email resent successfully!");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
            setConfirmResendId(null);
        }
    };

    const handleLinkCard = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res: any = await apiRequest("/gift-cards/claim", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ code: linkCode })
            });
            if (res.error) throw new Error(res.error);
            setLinkCode("");
            setLinkSuccess(true);
            await refreshCards();
            setTimeout(() => { setShowLinkModal(false); setLinkSuccess(false); }, 1500);
        } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    };

    const toggleHistory = async (cardId: string) => {
        if (expandedCardId === cardId) {
            setExpandedCardId(null);
            return;
        }
        setExpandedCardId(cardId);
        setLoadingHistory(true);
        setTransactions([]);
        try {
            const res: any = await apiRequest(`/gift-cards/${cardId}/transactions`, token, {
                headers: { 'X-Tenant-Slug': slug! }
            });
            if (res.transactions) setTransactions(res.transactions);
        } catch (e) { console.error(e); } finally { setLoadingHistory(false); }
    };

    const filteredCards = giftCards.filter((c: any) =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getCheckoutUrl = () => {
        const amount = buyData.amount === 'custom' ? buyData.customAmount : buyData.amount;
        const amountCents = parseFloat(amount) * 100;
        const params = new URLSearchParams();
        params.set('giftCardAmount', amountCents.toString());
        if (!buyData.isForSelf) {
            if (buyData.recipientEmail) params.set('recipientEmail', buyData.recipientEmail);
            if (buyData.recipientName) params.set('recipientName', buyData.recipientName);
            if (buyData.senderName) params.set('senderName', buyData.senderName);
            if (buyData.message) params.set('message', buyData.message);
        }
        return `/studio/${slug}/checkout?${params.toString()}`;
    };


    // Deep Linking: Auto-open Claim Modal
    const [searchParams, setSearchParams] = useSearchParams();
    const claimCode = searchParams.get('claimCode');

    useEffect(() => {
        if (claimCode) {
            setLinkCode(claimCode.toUpperCase());
            setShowLinkModal(true);
            setSearchParams((params: URLSearchParams) => {
                params.delete('claimCode');
                return params;
            });
        }
    }, [claimCode]);

    // Close menus on click outside
    useEffect(() => {
        const handleClick = () => setActiveMenuId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Analytics Calculation
    const totalIssued = giftCards.reduce((acc: number, c: any) => acc + c.initialValue, 0);
    const totalLiability = giftCards.reduce((acc: number, c: any) => acc + (c.status === 'active' ? c.currentBalance : 0), 0);
    const redemptionRate = totalIssued > 0 ? ((totalIssued - totalLiability) / totalIssued) * 100 : 0;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <Gift className="text-blue-600" /> Gift Cards
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        {isAdmin ? "Issue and manage gift cards. Sell them at checkout via POS." : "View your balance or purchase a gift card."}
                    </p>
                </div>

                {/* Only show tabs for non-admin users */}
                {!isAdmin && (
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('list')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'list' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}`}>My Cards</button>
                        <button onClick={() => setActiveTab('buy')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'buy' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}`}>Buy Gift Card</button>
                    </div>
                )}

                <div className="flex gap-2">
                    {activeTab === 'list' && !isAdmin && (
                        <button onClick={() => setShowLinkModal(true)} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                            <LinkIcon size={18} /> Link Card
                        </button>
                    )}
                    {isAdmin && activeTab === 'list' && (
                        <button onClick={() => setShowIssueModal(true)} className="bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:translate-y-[-2px] transition-all">
                            <Plus size={20} /> Issue New Card
                        </button>
                    )}
                </div>
            </div>

            {/* Show list view for admins always, or when list tab selected for non-admins */}
            {(isAdmin || activeTab === 'list') ? (
                <div className="space-y-8">
                    {/* Stats */}
                    {isAdmin ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Liability</p>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">${(totalLiability / 100).toLocaleString()}</h2>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Issued</p>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">${(totalIssued / 100).toLocaleString()}</h2>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Redemption Rate</p>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{redemptionRate.toFixed(1)}%</h2>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Active Cards</p>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{giftCards.filter((c: any) => c.status === 'active').length}</h2>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">My Balance</p>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">${(totalLiability / 100).toLocaleString()}</h2>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="space-y-4">
                        {isAdmin && (
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input type="text" placeholder="Find by code or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                            </div>
                        )}

                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-visible">
                            {filteredCards.length === 0 ? (
                                <div className="p-12 text-center text-zinc-500">
                                    <Ticket className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>No gift cards found.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Code</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Balance</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Issued</th>
                                            {isAdmin && <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recipient</th>}
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                        {filteredCards.map((card: any) => (
                                            <>
                                                <tr key={card.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">{card.code}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">${(card.currentBalance / 100).toFixed(2)}</span>
                                                        <span className="text-zinc-400 text-xs ml-1">/ ${(card.initialValue / 100).toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter ${card.status === 'active' ? 'bg-emerald-100 text-emerald-700' : card.status === 'exhausted' ? 'bg-zinc-200 text-zinc-600' : 'bg-red-100 text-red-700'}`}>{card.status}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-zinc-500">{new Date(card.createdAt).toLocaleDateString()}</td>
                                                    {isAdmin && <td className="px-6 py-4 text-xs text-zinc-500">{card.recipientEmail || '-'}</td>}
                                                    <td className="px-6 py-4 text-right relative">
                                                        {isAdmin ? (
                                                            <div className="relative">
                                                                <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === card.id ? null : card.id); }} className="text-zinc-400 hover:text-blue-600 transition-colors p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                                                    <MoreHorizontal size={16} />
                                                                </button>
                                                                {activeMenuId === card.id && (
                                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-800 z-50 overflow-hidden py-1">
                                                                        <button onClick={() => { setActiveMenuId(null); toggleHistory(card.id); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                                                            <History size={14} /> View History
                                                                        </button>
                                                                        <button onClick={() => { setActiveMenuId(null); handleResend(card.id); }} disabled={loading} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                                                            <Mail size={14} /> {loading ? "Sending..." : "Resend Email"}
                                                                        </button>
                                                                        <button onClick={() => { setActiveMenuId(null); /* Implement Void Logic */ toast.info("Void feature coming soon"); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 text-red-600 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800">
                                                                            <Ban size={14} /> Void Card
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => toggleHistory(card.id)} className="text-zinc-400 hover:text-blue-600 transition-colors p-2">
                                                                {expandedCardId === card.id ? <ChevronUp size={16} /> : <History size={16} />}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {expandedCardId === card.id && (
                                                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/20">
                                                        <td colSpan={isAdmin ? 6 : 5} className="px-6 py-4">
                                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 animate-in slide-in-from-top-2">
                                                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Transaction History</h4>
                                                                {loadingHistory ? (
                                                                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-zinc-300" /></div>
                                                                ) : transactions.length === 0 ? (
                                                                    <p className="text-sm text-zinc-500">No transactions found.</p>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {transactions.map((tx: any) => (
                                                                            <div key={tx.id} className="flex justify-between items-center text-sm p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                                                        {tx.amount > 0 ? <Plus size={14} /> : <div className="w-2 h-[2px] bg-current" />}
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">{tx.type}</p>
                                                                                        <p className="text-xs text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className={`font-mono font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                                                    {tx.amount > 0 ? '+' : ''}${(tx.amount / 100).toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* BUY TAB CONTENT (Only for non-admin users) */
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Purchase Gift Card</h2>
                            <p className="text-zinc-500">Give the gift of yoga and wellness. Sent instantly via email.</p>
                        </div>
                        <div className="p-8 space-y-8">
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Amount</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {['25', '50', '100', 'custom'].map(amt => (
                                        <button key={amt} onClick={() => setBuyData({ ...buyData, amount: amt })} className={`py-4 px-4 rounded-2xl font-bold border-2 transition-all ${buyData.amount === amt ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'}`}>{amt === 'custom' ? 'Custom' : `$${amt}`}</button>
                                    ))}
                                </div>
                                {buyData.amount === 'custom' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">$</span><input type="number" placeholder="Enter amount (e.g. 150)" value={buyData.customAmount} onChange={e => setBuyData({ ...buyData, customAmount: e.target.value })} className="w-full pl-8 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Who is this for?</label>
                                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
                                    <button onClick={() => setBuyData({ ...buyData, isForSelf: true })} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${buyData.isForSelf ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500'}`}>For Me</button>
                                    <button onClick={() => setBuyData({ ...buyData, isForSelf: false })} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${!buyData.isForSelf ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500'}`}>For Someone Else</button>
                                </div>
                            </div>
                            {!buyData.isForSelf && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recipient Name</label><input type="text" placeholder="Jane Doe" value={buyData.recipientName} onChange={e => setBuyData({ ...buyData, recipientName: e.target.value })} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recipient Email</label><input type="email" placeholder="jane@example.com" value={buyData.recipientEmail} onChange={e => setBuyData({ ...buyData, recipientEmail: e.target.value })} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                    </div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Your Name (From)</label><input type="text" placeholder="Your Name" value={buyData.senderName} onChange={e => setBuyData({ ...buyData, senderName: e.target.value })} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Message (Optional)</label><textarea placeholder="Enjoy!" rows={3} value={buyData.message} onChange={e => setBuyData({ ...buyData, message: e.target.value })} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
                                </div>
                            )}
                            <div className="pt-4">
                                <a href={getCheckoutUrl()} className={`block w-full py-4 rounded-2xl font-black text-center transition-all ${(!buyData.isForSelf && !buyData.recipientEmail) || (buyData.amount === 'custom' && !buyData.customAmount) ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:scale-[1.02] shadow-xl'}`}>Proceed to Checkout</a>
                                <p className="text-center text-xs text-zinc-400 mt-4 flex items-center justify-center gap-1"><CreditCard size={12} /> Secure payment via Stripe</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Link Modal */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95">
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Link Gift Card</h2>
                        <p className="text-zinc-500 mb-6">Enter the code from your gift card email to add it to your wallet.</p>

                        <form onSubmit={handleLinkCard} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Gift Card Code</label>
                                <input
                                    type="text"
                                    placeholder="GIFT-XXXX-XXXX"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                    value={linkCode}
                                    onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>

                            {linkSuccess && (
                                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-bold flex items-center gap-2">
                                    <CheckCircle size={16} /> Card Linked Successfully!
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" disabled={loading} className="flex-1 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:hover:scale-100">
                                    {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Link Card"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Issue Modal (Admin) */}
            {showIssueModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95">
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Issue Gift Card</h2>
                        <p className="text-zinc-500 mb-6">Create a new gift card manually.</p>

                        <form onSubmit={handleIssue} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Amount ($)</label>
                                <input
                                    type="number"
                                    placeholder="50.00"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    value={issueData.amount}
                                    onChange={(e) => setIssueData({ ...issueData, amount: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recipient Email</label>
                                <input
                                    type="email"
                                    placeholder="customer@example.com"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={issueData.recipientEmail}
                                    onChange={(e) => setIssueData({ ...issueData, recipientEmail: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Notes (Internal)</label>
                                <input
                                    type="text"
                                    placeholder="Reason for issuance..."
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={issueData.notes}
                                    onChange={(e) => setIssueData({ ...issueData, notes: e.target.value })}
                                />
                            </div>

                            {issueSuccess && (
                                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-bold flex items-center gap-2">
                                    <CheckCircle size={16} /> {issueSuccess}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowIssueModal(false)} className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" disabled={loading} className="flex-1 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:hover:scale-100">
                                    {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Issue Card"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={!!confirmResendId}
                onClose={() => setConfirmResendId(null)}
                onConfirm={confirmResendAction}
                title="Resend Gift Card"
                message="Are you sure you want to resend the gift card email to the recipient?"
                confirmText="Resend Email"
            />
        </div>
    );
}
