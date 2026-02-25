import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, Form, redirect, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Gift, Copy, Share2, Users, Check, DollarSign, Award, Clock, ChevronRight, Sparkles } from "lucide-react";
import type { Referral, ReferralStat } from "api/src/types";

interface LoaderData {
    myCode: string;
    referrals: Referral[];
    stats: ReferralStat | null;
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
            apiRequest<ReferralStat>('/referrals/stats', token, { headers: { 'X-Tenant-Slug': slug as string } }).catch(() => null)
        ]);

        return { myCode: myCode?.code || '', referrals: referralsData || [], stats: statsData, slug };
    } catch (e) {
        console.error("Referrals Loader Error", e);
        return { myCode: '', referrals: [], stats: null, slug };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'reward') {
        const id = formData.get("id");
        await apiRequest(`/referrals/${id}/reward`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({
                rewardType: formData.get("rewardType"),
                rewardValue: parseInt(formData.get("rewardValue") as string || "0")
            })
        });
    }

    return { success: true };
};

export default function ReferralProgram() {
    const { myCode, referrals, stats, slug } = useLoaderData<LoaderData>();
    const submit = useSubmit();
    const [copied, setCopied] = useState(false);

    // Public referral link should point at the studio's public marketing site,
    // not a non-existent /studio/:slug/join route.
    const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/site/${slug}?ref=${myCode}`;

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareLink = async () => {
        if (navigator.share) {
            await navigator.share({
                title: 'Join me at the studio!',
                text: 'Use my referral code to get started',
                url: referralLink
            });
        } else {
            copyToClipboard();
        }
    };

    const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700',
        completed: 'bg-blue-100 text-blue-700',
        rewarded: 'bg-green-100 text-green-700',
        expired: 'bg-zinc-100 text-zinc-500'
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg text-white"><Gift size={20} /></div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Referral Program</h1>
                        <p className="text-sm text-zinc-500">Invite friends and earn rewards</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* My Referral Card */}
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={20} />
                        <span className="font-medium">Your Referral Code</span>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between mb-4">
                        <span className="text-2xl font-mono font-bold tracking-wider">{myCode}</span>
                        <button
                            onClick={copyToClipboard}
                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={copyToClipboard}
                            className="flex-1 py-2.5 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 flex items-center justify-center gap-2"
                        >
                            <Copy size={16} /> Copy Link
                        </button>
                        <button
                            onClick={shareLink}
                            className="flex-1 py-2.5 bg-white/20 rounded-lg font-medium hover:bg-white/30 flex items-center justify-center gap-2"
                        >
                            <Share2 size={16} /> Share
                        </button>
                    </div>
                </div>

                {/* Stats (Owner Only) */}
                {stats && (
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-zinc-200">
                            <div className="text-2xl font-bold text-zinc-900">{stats.total}</div>
                            <div className="text-xs text-zinc-500">Total Referrals</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-zinc-200">
                            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                            <div className="text-xs text-zinc-500">Pending</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-zinc-200">
                            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
                            <div className="text-xs text-zinc-500">Completed</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-zinc-200">
                            <div className="text-2xl font-bold text-green-600">{stats.rewarded}</div>
                            <div className="text-xs text-zinc-500">Rewarded</div>
                        </div>
                    </div>
                )}

                {/* Referrals List */}
                <div className="bg-white rounded-xl border border-zinc-200">
                    <div className="p-4 border-b border-zinc-100">
                        <h2 className="font-bold text-zinc-900 flex items-center gap-2"><Users size={18} /> Your Referrals</h2>
                    </div>

                    {referrals.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            <Gift size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No referrals yet. Share your code to get started!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {referrals.map((ref) => (
                                <div key={ref.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                                            <Users size={18} className="text-zinc-500" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-zinc-900">
                                                {ref.referrer?.user?.profile?.firstName || ref.referrer?.user?.email || 'Member'}
                                            </div>
                                            <div className="text-xs text-zinc-500 flex items-center gap-2">
                                                <Clock size={12} /> {formatDate(ref.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[ref.status]}`}>
                                            {ref.status}
                                        </span>
                                        {ref.status === 'completed' && stats && (
                                            <Form method="post" className="flex items-center gap-2">
                                                <input type="hidden" name="intent" value="reward" />
                                                <input type="hidden" name="id" value={ref.id} />
                                                <select name="rewardType" className="text-xs border rounded px-2 py-1">
                                                    <option value="credit">Credit</option>
                                                    <option value="discount">Discount</option>
                                                    <option value="free_class">Free Class</option>
                                                </select>
                                                <input type="number" name="rewardValue" defaultValue="500" className="w-16 text-xs border rounded px-2 py-1" />
                                                <button type="submit" className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                                                    <Award size={14} />
                                                </button>
                                            </Form>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* How It Works */}
                <div className="bg-white rounded-xl border border-zinc-200 p-6">
                    <h2 className="font-bold text-zinc-900 mb-4">How It Works</h2>
                    <div className="space-y-4">
                        {[
                            { icon: Share2, title: 'Share Your Code', desc: 'Send your unique referral code to friends' },
                            { icon: Users, title: 'Friend Signs Up', desc: 'They join using your referral link' },
                            { icon: Award, title: 'Both Get Rewarded', desc: 'You and your friend receive special perks' }
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                    <step.icon size={18} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium text-zinc-900">{step.title}</div>
                                    <div className="text-sm text-zinc-500">{step.desc}</div>
                                </div>
                                {i < 2 && <ChevronRight size={16} className="text-zinc-300" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
