import { useLoaderData, useOutletContext, Link, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { Check, CreditCard, Zap, Clock, Shield, Receipt, Download, PauseCircle, PlayCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const headers = { "X-Tenant-Slug": slug! };

    const [plans, myActive, invoicesData] = await Promise.all([
        apiRequest(`/memberships/plans`, token, { headers }).catch(() => []),
        apiRequest(`/memberships/my-active`, token, { headers }).catch(() => []),
        apiRequest(`/commerce/invoices`, token, { headers }).catch(() => ({ invoices: [] })),
    ]);

    return {
        plans: plans || [],
        myActive: myActive || [],
        invoices: (invoicesData as any)?.invoices || [],
    };
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const form = await args.request.formData();
    const intent = form.get("intent") as string;
    const subscriptionId = form.get("subscriptionId") as string;
    const headers = { "X-Tenant-Slug": slug!, "Content-Type": "application/json" };

    try {
        if (intent === "pause") {
            const months = Number(form.get("months") || 1);
            await apiRequest(`/memberships/subscriptions/${subscriptionId}/pause`, token, {
                method: "POST",
                body: JSON.stringify({ months }),
                headers,
            });
            return { success: true, intent: "pause" };
        }
        if (intent === "resume") {
            await apiRequest(`/memberships/subscriptions/${subscriptionId}/resume`, token, {
                method: "POST",
                body: JSON.stringify({}),
                headers,
            });
            return { success: true, intent: "resume" };
        }
        if (intent === "cancel") {
            await apiRequest(`/memberships/subscriptions/${subscriptionId}/cancel`, token, {
                method: "POST",
                body: JSON.stringify({}),
                headers,
            });
            return { success: true, intent: "cancel" };
        }
    } catch (e: any) {
        return { error: e.message || "Action failed", intent };
    }
    return null;
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

const STATUS_COLOR: Record<string, string> = {
    paid: "text-emerald-600",
    open: "text-amber-600",
    uncollectible: "text-red-500",
    void: "text-zinc-400",
};

function ActiveSubscriptionCard({ sub }: { sub: any }) {
    const fetcher = useFetcher<typeof action>();
    const [showPause, setShowPause] = useState(false);
    const [pauseMonths, setPauseMonths] = useState(1);
    const isPaused = sub.isPaused;
    const isSubmitting = fetcher.state !== "idle";

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{sub.plan?.name}</p>
                    {isPaused ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                            <PauseCircle size={12} />
                            Paused — resumes {format(new Date(sub.pausedUntil * 1000), "MMM d, yyyy")}
                        </p>
                    ) : (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {sub.nextBillingDate
                                ? `Renews ${format(new Date(sub.nextBillingDate * 1000), "MMM d, yyyy")}`
                                : sub.status}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {isPaused ? (
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="resume" />
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <PlayCircle size={13} /> Resume
                            </button>
                        </fetcher.Form>
                    ) : (
                        <button
                            onClick={() => setShowPause(p => !p)}
                            className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <PauseCircle size={13} /> Pause
                        </button>
                    )}
                </div>
            </div>

            {/* Pause duration picker */}
            {showPause && !isPaused && (
                <fetcher.Form method="post" className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3 flex-wrap">
                    <input type="hidden" name="intent" value="pause" />
                    <input type="hidden" name="subscriptionId" value={sub.id} />
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Pause for:</p>
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 6].map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setPauseMonths(m)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${pauseMonths === m ? "bg-indigo-600 text-white border-indigo-600" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-indigo-400"}`}
                            >
                                {m}mo
                            </button>
                        ))}
                    </div>
                    <input type="hidden" name="months" value={pauseMonths} />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="ml-auto text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? "Pausing…" : `Pause ${pauseMonths} month${pauseMonths > 1 ? "s" : ""}`}
                    </button>
                    <button type="button" onClick={() => setShowPause(false)} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
                </fetcher.Form>
            )}
            {(fetcher.data as any)?.error && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{(fetcher.data as any).error}</p>
            )}
        </div>
    );
}

export default function PortalMembershipsPage() {
    const { tenant } = useOutletContext<any>();
    const { plans, myActive, invoices } = useLoaderData<typeof loader>();

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

            {/* Active memberships */}
            {(myActive as any[]).length > 0 && (
                <section>
                    <h2 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <Check size={14} className="text-emerald-600" /> Your Active Plans
                    </h2>
                    <div className="space-y-3">
                        {(myActive as any[]).map((sub: any) => (
                            <ActiveSubscriptionCard key={sub.id} sub={sub} />
                        ))}
                    </div>
                </section>
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

            {/* Billing History */}
            <section className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                    <Receipt size={20} />
                    Billing History
                </h2>

                {(invoices as any[]).length === 0 ? (
                    <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <Receipt className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">No billing history yet.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {(invoices as any[]).map((inv: any) => (
                            <div
                                key={inv.id}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{inv.description}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {format(new Date(inv.date), "MMM d, yyyy")}
                                        {inv.number ? ` · #${inv.number}` : ""}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-sm font-bold ${STATUS_COLOR[inv.status] || "text-zinc-600 dark:text-zinc-400"}`}>
                                        {(inv.amount / 100).toLocaleString("en-US", { style: "currency", currency: inv.currency?.toUpperCase() || "USD" })}
                                    </span>
                                    {inv.pdfUrl && (
                                        <a
                                            href={inv.pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-zinc-400 hover:text-indigo-600 transition-colors"
                                            title="Download PDF"
                                        >
                                            <Download size={15} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
