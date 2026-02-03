import { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useParams } from "react-router";
import { useState } from "react";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Copy, Users, DollarSign, MousePointer2, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const stats = await apiRequest('/referrals/stats', token, {
        headers: { 'X-Tenant-Slug': params.slug || '' }
    });

    if (stats.error) {
        throw new Response(stats.error, { status: 500 });
    }

    return { stats };
};

export default function ReferralDashboard() {
    const { stats } = useLoaderData<typeof loader>();
    const { slug } = useParams();
    const [copied, setCopied] = useState(false);

    const referralLink = typeof window !== 'undefined'
        ? `${window.location.origin}/studio/${slug}/join?ref=${stats.code}`
        : `https://studio.com/${slug}/join?ref=${stats.code}`; // Fallback

    const copyToClipboard = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        toast.success("Referral link copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Refer & Earn</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    Invite friends to join {slug} and earn rewards for every successful signup.
                </p>
            </header>

            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-4 max-w-lg">
                    <h2 className="text-3xl font-bold">Give $20, Get $20</h2>
                    <p className="text-blue-100 text-lg">
                        Your friends get $20 off their first pack, and you get $20 in credit when they make a purchase.
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20 min-w-[300px] space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-blue-100">Your Unique Link</label>
                    <div className="flex items-center gap-2 bg-white/20 p-1 rounded-lg">
                        <code className="flex-1 px-3 font-mono text-sm truncate">{referralLink}</code>
                        <button
                            onClick={copyToClipboard}
                            className="bg-white text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors"
                        >
                            {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Friends Referred"
                    value={stats.stats.signups}
                    icon={<Users className="text-blue-500" />}
                />
                <StatCard
                    label="Total Earned"
                    value={(stats.stats.earnings / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    icon={<DollarSign className="text-green-500" />}
                />
                <StatCard
                    label="Link Clicks"
                    value={stats.stats.clicks}
                    icon={<MousePointer2 className="text-purple-500" />}
                />
            </div>

            {/* History Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Referral History</h3>
                </div>

                {stats.history.length === 0 ? (
                    <div className="p-12 text-center text-zinc-500">
                        <Users size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No referrals yet. Share your link to get started!</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Friend</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Reward</th>
                                <th className="px-6 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {stats.history.map((item: any) => (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                        {item.referredUser?.firstName || 'Unknown User'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="px-6 py-4 font-mono">
                                        {(item.amount / 100).toLocaleString('en-US', { style: 'currency', currency: item.currency || 'USD' })}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {new Date(item.createdAt).toLocaleDateString()}
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

function StatCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
        paid: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
        voided: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || "bg-zinc-100 text-zinc-600"}`}>
            {status}
        </span>
    );
}
