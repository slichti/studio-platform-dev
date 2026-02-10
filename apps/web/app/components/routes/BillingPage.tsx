
import { useLoaderData, Link } from "react-router";
import { CreditCard, Check, BarChart } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "~/utils/api";

export default function BillingPage() {
    const { tenant, usage, plans, slug, token } = useLoaderData<any>();

    const TIERS: Record<string, any> = {};
    (plans || []).forEach((p: any) => {
        const monthlyPrice = p.prices?.monthly ?? 0;
        TIERS[p.slug] = {
            name: p.name,
            price: monthlyPrice === 0 ? 'Free' : `$${monthlyPrice / 100}/mo`,
            students: 'Unlimited',
            storage: 'Included',
            ...p
        };
    });

    const tier = (TIERS as any)[tenant.features?.includes('white_label') ? 'scale' : (tenant.tier || 'launch')] || TIERS.launch || { name: 'Unknown', price: 'N/A' };

    const handleManageSubscription = async () => {
        try {
            const res = await apiRequest('/tenant/portal', token, {
                method: 'POST',
                body: JSON.stringify({ returnUrl: window.location.href }),
                headers: { 'X-Tenant-Slug': slug }
            }) as { url?: string };
            if (res.url) {
                window.location.href = res.url;
            } else {
                toast.error("Could not load billing portal. Please contact support.");
            }
        } catch (e) {
            toast.error("Failed to redirect to billing portal.");
        }
    };

    const limitPercentage = (current: number, max: number | string) => {
        if (max === 'Unlimited') return 0;
        return Math.min(100, (current / (max as number)) * 100);
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">Billing & Subscription</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-sm text-zinc-500 uppercase font-semibold tracking-wide">Current Plan</div>
                            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{tier.name}</h2>
                            <p className="text-zinc-500">{tier.price}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${tenant.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {tenant.subscriptionStatus || 'Active'}
                        </span>
                    </div>

                    <div className="space-y-4 mt-6">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">Students</span>
                                <span className="text-zinc-500">{usage.students} / {tier.students}</span>
                            </div>
                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${limitPercentage(usage.students, tier.students)}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">Storage (GB)</span>
                                <span className="text-zinc-500">{usage.storageGB.toFixed(1)} / {tier.storage} GB</span>
                            </div>
                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-600 rounded-full" style={{ width: `${limitPercentage(usage.storageGB, tier.storage)}%` }} />
                            </div>
                        </div>
                        {(usage.streamingLimit === -1 || usage.streamingLimit > 0) && (
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-zinc-700 dark:text-zinc-300">VOD Minutes (Stored)</span>
                                    <span className="text-zinc-500">{usage.streamingUsage || 0} / {usage.streamingLimit === -1 ? 'Unlimited' : usage.streamingLimit}</span>
                                </div>
                                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${usage.streamingLimit !== -1 && usage.streamingUsage > usage.streamingLimit ? 'bg-red-500' : 'bg-pink-500'}`} style={{ width: `${limitPercentage(usage.streamingUsage, usage.streamingLimit)}%` }} />
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">Emails Sent (Monthly)</span>
                                <span className="text-zinc-500">{usage.emailUsage || 0} / {usage.emailLimit === -1 ? 'Unlimited' : usage.emailLimit}</span>
                            </div>
                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${usage.emailLimit !== -1 && usage.emailUsage > usage.emailLimit ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${limitPercentage(usage.emailUsage, usage.emailLimit)}%` }} />
                            </div>
                        </div>
                        {(usage.smsLimit === -1 || usage.smsLimit > 0) && (
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-zinc-700 dark:text-zinc-300">SMS Sent (Monthly)</span>
                                    <span className="text-zinc-500">{usage.smsUsage || 0} / {usage.smsLimit === -1 ? 'Unlimited' : usage.smsLimit}</span>
                                </div>
                                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${usage.smsLimit !== -1 && usage.smsUsage > usage.smsLimit ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${limitPercentage(usage.smsUsage, usage.smsLimit)}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Manage Subscription</h3>
                    <div className="space-y-3">
                        <button onClick={handleManageSubscription} className="w-full py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 font-medium text-sm transition-colors cursor-pointer">
                            Update Payment Method
                        </button>
                        <button onClick={handleManageSubscription} className="w-full py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 font-medium text-sm transition-colors cursor-pointer">
                            View Invoices
                        </button>
                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <button onClick={handleManageSubscription} className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:opacity-90 font-medium text-sm transition-colors cursor-pointer">
                                Upgrade Plan
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Plan Features</h3>
                </div>
                <div className="p-6 grid gap-4">
                    <div className="flex items-center gap-3">
                        <Check className="text-green-600" size={18} />
                        <span className="text-zinc-700 dark:text-zinc-300">Zoom Integration: <span className="font-medium">{tier.name === 'Basic' ? 'Not Included' : 'Included'}</span></span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Check className="text-green-600" size={18} />
                        <span className="text-zinc-700 dark:text-zinc-300">Locations: <span className="font-medium">{tier.name === 'Basic' ? '1' : tier.name === 'Growth' ? '3' : 'Unlimited'}</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
