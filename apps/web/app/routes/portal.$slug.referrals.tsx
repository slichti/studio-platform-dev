import { type LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Gift, Copy, Share2, Users, Check, Award, Clock, ChevronRight, Sparkles, DollarSign } from "lucide-react";

interface Referral {
    id: string;
    status: 'pending' | 'completed' | 'rewarded' | 'expired';
    createdAt: number;
    referredUser?: {
        profile?: {
            firstName?: string;
        };
        email?: string;
    };
}

interface ReferralStats {
    total: number;
    pending: number;
    completed: number;
    rewarded: number;
    earnings: number;
}

interface LoaderData {
    myCode: string;
    referrals: Referral[];
    stats: ReferralStats | null;
    slug: string;
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const [myCode, referralsData, statsData] = await Promise.all([
            apiRequest<{ code: string }>('/referrals/my-code', token, { headers: { 'X-Tenant-Slug': slug as string } }),
            apiRequest<Referral[]>('/referrals', token, { headers: { 'X-Tenant-Slug': slug as string } }),
            apiRequest<ReferralStats>('/referrals/stats', token, { headers: { 'X-Tenant-Slug': slug as string } }).catch(() => null)
        ]);

        return {
            myCode: myCode?.code || '',
            referrals: referralsData || [],
            stats: statsData,
            slug
        };
    } catch (e) {
        console.error("Referrals Loader Error", e);
        return { myCode: '', referrals: [], stats: null, slug };
    }
};

export default function PortalReferrals() {
    const { myCode, referrals, stats, slug } = useLoaderData<LoaderData>();
    const [copied, setCopied] = useState(false);

    const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/studio/${slug}/join?ref=${myCode}`;

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (ts: number | string) => {
        const date = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
        return date.toLocaleDateString();
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        rewarded: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        expired: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Refer & Earn</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Invite friends and earn rewards for every successful signup.</p>
            </header>

            {/* My Referral Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-white/20 rounded-lg"><Sparkles size={20} /></div>
                            <span className="font-semibold text-lg">Give $20, Get $20</span>
                        </div>
                        <p className="text-indigo-100 max-w-md">
                            Your friends get $20 off their first pack, and you'll receive a $20 credit when they make their first purchase.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Your Unique Link</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="bg-white/10 px-3 py-1.5 rounded-lg text-sm font-mono border border-white/20">
                                        {myCode}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[200px]">
                        <button
                            onClick={copyToClipboard}
                            className="w-full bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                            {copied ? 'Copied Link!' : 'Copy Invite Link'}
                        </button>
                        <button
                            className="w-full bg-white/10 text-white border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <Share2 size={20} />
                            Share Link
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Referrals', value: stats.total, icon: Users, color: 'text-zinc-900' },
                        { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600' },
                        { label: 'Successful', value: stats.completed, icon: Check, color: 'text-blue-600' },
                        { label: 'Credits Earned', value: `$${(stats.earnings / 100).toFixed(0)}`, icon: DollarSign, color: 'text-green-600' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                    <stat.icon size={18} className="text-zinc-500" />
                                </div>
                            </div>
                            <div className={`text-2xl font-bold ${stat.color} dark:text-zinc-100`}>{stat.value}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 uppercase tracking-wider font-medium">{stat.label}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Referrals List */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Your History</h2>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{referrals.length} Total</span>
                    </div>

                    {referrals.length === 0 ? (
                        <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
                            <Gift size={40} className="mx-auto mb-4 opacity-20" />
                            <p className="font-medium">No referrals yet.</p>
                            <p className="text-sm">When friends join using your link, they'll show up here!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {referrals.map((ref) => (
                                <div key={ref.id} className="p-6 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                            {(ref.referredUser?.profile?.firstName || ref.referredUser?.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]">
                                                {ref.referredUser?.profile?.firstName || ref.referredUser?.email?.split('@')[0] || 'Friend'}
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                                <Clock size={12} /> {formatDate(ref.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[ref.status] || statusColors.pending}`}>
                                            {ref.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* How it works */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6 font-display">How It Works</h3>
                        <div className="space-y-8 relative">
                            {[
                                { icon: Share2, title: 'Send Invite', desc: 'Share your link with friends' },
                                { icon: Users, title: 'Friend Joins', desc: 'They sign up using your link' },
                                { icon: Award, title: 'Unlock Reward', desc: 'You both get credited automatically' },
                            ].map((step, i) => (
                                <div key={i} className="flex gap-4 relative">
                                    {i < 2 && <div className="absolute left-5 top-10 w-0.5 h-6 bg-zinc-100 dark:bg-zinc-800" />}
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex-shrink-0 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <step.icon size={18} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{step.title}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{step.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
