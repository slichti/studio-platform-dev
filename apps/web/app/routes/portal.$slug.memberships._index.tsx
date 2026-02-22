import { useLoaderData, useOutletContext, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { Check, CreditCard, Zap, Clock, Shield } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    const [plans, myActive] = await Promise.all([
        apiRequest(`/memberships/plans`, token, { headers: { "X-Tenant-Slug": slug! } }).catch(() => []),
        apiRequest(`/memberships/my-active`, token, { headers: { "X-Tenant-Slug": slug! } }).catch(() => []),
    ]);

    return { plans: plans || [], myActive: myActive || [] };
};

const INTERVAL_LABEL: Record<string, string> = {
    month: "/ month",
    year: "/ year",
    week: "/ week",
    one_time: "one time",
};

function intervalLabel(interval: string) {
    return INTERVAL_LABEL[interval] ?? `/ ${interval}`;
}

export default function PortalMembershipsPage() {
    const { tenant } = useOutletContext<any>();
    const { plans, myActive } = useLoaderData<typeof loader>();

    const activeIds = new Set((myActive as any[]).map((s: any) => s.plan?.id));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Memberships</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                    Choose a plan that works for your practice.
                </p>
            </div>

            {/* Active memberships banner */}
            {(myActive as any[]).length > 0 && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5">
                    <h2 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                        <Check size={16} className="text-emerald-600" /> Your Active Plans
                    </h2>
                    <div className="space-y-2">
                        {(myActive as any[]).map((sub: any) => (
                            <div key={sub.id} className="flex justify-between items-center text-sm">
                                <span className="font-medium text-emerald-900 dark:text-emerald-100">{sub.plan?.name}</span>
                                <span className="text-emerald-700 dark:text-emerald-300">
                                    {sub.nextBillingDate
                                        ? `Renews ${new Date(sub.nextBillingDate * 1000).toLocaleDateString()}`
                                        : sub.status}
                                </span>
                            </div>
                        ))}
                    </div>
                    <Link
                        to="../profile"
                        className="mt-3 inline-block text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
                    >
                        Manage in My Profile →
                    </Link>
                </div>
            )}

            {/* Plans grid */}
            {plans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-500">
                    No membership plans available yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(plans as any[]).map((plan: any) => {
                        const alreadyOwned = activeIds.has(plan.id);
                        const isFree = plan.price === 0;

                        return (
                            <div
                                key={plan.id}
                                className="relative flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Plan image */}
                                {plan.imageUrl ? (
                                    <div className="relative aspect-[16/9] overflow-hidden">
                                        <img
                                            src={plan.imageUrl}
                                            alt={plan.name}
                                            className="w-full h-full object-cover"
                                        />
                                        {(plan.overlayTitle || plan.overlaySubtitle) && (
                                            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center p-4">
                                                <div className="bg-white/90 dark:bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg text-center">
                                                    {plan.overlayTitle && (
                                                        <p className="font-serif text-lg text-zinc-900 dark:text-white leading-tight">
                                                            {plan.overlayTitle}
                                                        </p>
                                                    )}
                                                    {plan.overlaySubtitle && (
                                                        <p className="text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-300 mt-0.5">
                                                            {plan.overlaySubtitle}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="aspect-[16/9] bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                                        <CreditCard size={40} className="text-indigo-400 dark:text-indigo-500" />
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex flex-col flex-1 p-5 gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-snug">
                                            {plan.name}
                                        </h3>
                                        {plan.description && (
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                                {plan.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Perks */}
                                    <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                            Unlimited class bookings
                                        </li>
                                        {plan.vodEnabled && (
                                            <li className="flex items-center gap-2">
                                                <Zap size={14} className="text-amber-500 shrink-0" />
                                                On-Demand video library
                                            </li>
                                        )}
                                        {plan.trialDays > 0 && (
                                            <li className="flex items-center gap-2">
                                                <Clock size={14} className="text-blue-500 shrink-0" />
                                                {plan.trialDays}-day free trial
                                            </li>
                                        )}
                                        <li className="flex items-center gap-2">
                                            <Shield size={14} className="text-zinc-400 shrink-0" />
                                            Cancel anytime
                                        </li>
                                    </ul>

                                    {/* Pricing + CTA */}
                                    <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                                        <div>
                                            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                                {isFree ? "Free" : `$${(plan.price / 100).toFixed(plan.price % 100 === 0 ? 0 : 2)}`}
                                            </span>
                                            {!isFree && (
                                                <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">
                                                    {intervalLabel(plan.interval)}
                                                </span>
                                            )}
                                        </div>

                                        {alreadyOwned ? (
                                            <span className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                                                Current Plan
                                            </span>
                                        ) : (
                                            <Link
                                                to={`/studio/${tenant?.slug}/checkout?planId=${plan.id}`}
                                                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                                            >
                                                {plan.trialDays > 0 ? "Start Free Trial" : isFree ? "Join Free" : "Join Now"}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
