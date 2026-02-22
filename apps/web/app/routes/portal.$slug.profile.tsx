
import { useLoaderData, useOutletContext, Form, useFetcher, Link } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "~/utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { User, Mail, Calendar, LogOut, Shield, TrendingUp, Award, CreditCard, AlertCircle, Edit2, Phone, Save, X } from "lucide-react";
import { ProgressRing } from "~/components/ui/ProgressRing";
import { StreakBadge, MilestoneBadge } from "~/components/ui/StreakBadge";
import { useState } from "react";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    const headers = { "X-Tenant-Slug": slug! };

    const [memberships, upcomingBookings, progressStats, packs] = await Promise.all([
        apiRequest(`/memberships/my-active`, token, { headers }).catch(() => []),
        apiRequest(`/bookings/my-upcoming?limit=100`, token, { headers }).catch(() => []),
        apiRequest(`/progress/my-stats`, token, { headers }).catch(() => null),
        apiRequest(`/commerce/packs`, token, { headers }).catch(() => []),
    ]);

    // Compute attendance-this-month from upcoming bookings + any cached stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const classesThisMonth = Array.isArray(upcomingBookings)
        ? upcomingBookings.filter((b: any) => new Date(b.startTime || b.class?.startTime) >= startOfMonth).length
        : 0;

    // Pack credits: sum remaining across all purchased packs
    const packCredits = Array.isArray(packs)
        ? packs.reduce((sum: number, p: any) => sum + (p.remainingCredits ?? 0), 0)
        : 0;
    const packTotal = Array.isArray(packs)
        ? packs.reduce((sum: number, p: any) => sum + (p.initialCredits ?? 0), 0)
        : 0;

    // Streak from progress stats (days active in last 7 days)
    const streak = (progressStats as any)?.currentStreak ?? 0;
    const totalClasses = (progressStats as any)?.totalBookings ?? classesThisMonth;
    const milestones = [10, 25, 50, 100];

    return {
        memberships: memberships || [],
        streak,
        classesThisMonth,
        totalClasses,
        packCredits,
        packTotal: packTotal || packCredits,
        milestones,
    };
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args as any);
    const token = await getToken();
    const { slug } = args.params;
    const form = await args.request.formData();
    const intent = form.get("intent");

    if (intent === "update-profile") {
        try {
            await apiRequest(`/users/me`, token, {
                method: "PATCH",
                body: JSON.stringify({
                    firstName: form.get("firstName"),
                    lastName: form.get("lastName"),
                    phone: form.get("phone"),
                }),
                headers: { "X-Tenant-Slug": slug!, "Content-Type": "application/json" },
            });
            return { success: true, intent: "update-profile" };
        } catch (e: any) {
            return { error: e.message || "Failed to update profile", intent: "update-profile" };
        }
    }

    const subscriptionId = form.get("subscriptionId") as string;
    if (intent === "cancel-subscription" && subscriptionId) {
        try {
            await apiRequest(`/memberships/subscriptions/${subscriptionId}/cancel`, token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug! },
            });
            return { success: true, intent: "cancel-subscription" };
        } catch (e: any) {
            return { error: e.message || "Failed to cancel subscription", intent: "cancel-subscription" };
        }
    }

    return { error: "Unknown action" };
};

function CancelButton({ subscriptionId }: { subscriptionId: string }) {
    const fetcher = useFetcher();
    const [confirming, setConfirming] = useState(false);
    const isLoading = fetcher.state !== "idle";

    if (fetcher.data && (fetcher.data as any).success) {
        return (
            <span className="text-xs text-zinc-500">Canceled at period end</span>
        );
    }

    if (!confirming) {
        return (
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
                Cancel plan
            </button>
        );
    }

    return (
        <fetcher.Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="intent" value="cancel-subscription" />
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Sure?</span>
            <button
                type="submit"
                disabled={isLoading}
                className={cn(
                    "text-xs font-medium px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors",
                    isLoading && "opacity-50 cursor-wait"
                )}
            >
                {isLoading ? "Canceling…" : "Yes, cancel"}
            </button>
            <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-zinc-500 hover:text-zinc-700"
            >
                Keep
            </button>
        </fetcher.Form>
    );
}

const STATUS_COLORS: Record<string, string> = {
    active: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    trialing: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    past_due: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
};

export default function StudentPortalProfile() {
    const { me, tenant } = useOutletContext<any>();
    const { memberships, streak, classesThisMonth, totalClasses, packCredits, packTotal, milestones } = useLoaderData<typeof loader>();
    const profileFetcher = useFetcher<typeof action>();

    const [editing, setEditing] = useState(false);
    const [firstName, setFirstName] = useState(me?.firstName || "");
    const [lastName, setLastName] = useState(me?.lastName || "");
    const [phone, setPhone] = useState((me as any)?.phone || "");

    const displayFirst = me?.firstName || "Student";
    const displayLast = me?.lastName || "";
    const email = me?.email || "No email";
    const joinedAt = me?.joinedAt ? new Date(me.joinedAt).toLocaleDateString() : "Unknown";

    const isSaving = profileFetcher.state !== "idle";
    const saveSuccess = (profileFetcher.data as any)?.success && (profileFetcher.data as any)?.intent === "update-profile";

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Profile</h1>

            {/* Profile Card */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                {!editing ? (
                    /* View mode */
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold shrink-0">
                            {displayFirst[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                                    {displayFirst} {displayLast}
                                </h2>
                                {saveSuccess && (
                                    <span className="text-xs text-emerald-600 font-medium">Saved!</span>
                                )}
                            </div>
                            <div className="space-y-1 mt-2">
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <Mail size={14} />
                                    {email}
                                </div>
                                {(me as any)?.phone && (
                                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                                        <Phone size={14} />
                                        {(me as any).phone}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <Calendar size={14} />
                                    Member since {joinedAt}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    setFirstName(me?.firstName || "");
                                    setLastName(me?.lastName || "");
                                    setPhone((me as any)?.phone || "");
                                    setEditing(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <Edit2 size={13} />
                                Edit
                            </button>
                            <Form action="/sign-out" method="post">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full">
                                    <LogOut size={13} />
                                    Log Out
                                </button>
                            </Form>
                        </div>
                    </div>
                ) : (
                    /* Edit mode */
                    <profileFetcher.Form
                        method="post"
                        onSubmit={() => setEditing(false)}
                        className="space-y-4"
                    >
                        <input type="hidden" name="intent" value="update-profile" />
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold shrink-0">
                                {(firstName[0] || displayFirst[0]).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Edit Profile</p>
                                <p className="text-xs text-zinc-500">Changes apply to your display name.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">First Name</label>
                                <input
                                    name="firstName"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Last Name</label>
                                <input
                                    name="lastName"
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Phone</label>
                            <input
                                name="phone"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+1 (555) 000-0000"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Save size={14} />
                                {isSaving ? "Saving…" : "Save Changes"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditing(false)}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <X size={14} />
                                Cancel
                            </button>
                        </div>
                    </profileFetcher.Form>
                )}
            </section>

            {/* Progress Dashboard */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <TrendingUp size={20} />
                        My Progress
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Attendance Streak</span>
                            <StreakBadge streak={streak} showLabel={false} />
                        </div>
                        <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{streak} day{streak !== 1 ? "s" : ""}</div>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">{streak > 0 ? "Keep it going! 🔥" : "Start your streak today!"}</p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">This Month</span>
                                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">{classesThisMonth}</div>
                                <p className="text-xs text-zinc-500 mt-1">classes attended</p>
                            </div>
                            <ProgressRing progress={Math.min(100, Math.round((classesThisMonth / 20) * 100))} size={80} strokeWidth={6} showPercentage={false} label={`${classesThisMonth}/20`} />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Pack Credits</span>
                        <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">{packCredits}</div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            {packTotal > 0 ? `of ${packTotal} remaining` : "No active pack"}
                        </p>
                    </div>
                </div>

                {/* Milestones */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                        <Award size={16} />
                        Milestones
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(milestones as number[]).map((m) => (
                            <MilestoneBadge key={m} milestone={m} label="Classes" achieved={totalClasses >= m} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Active Memberships */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <CreditCard size={20} />
                        Active Memberships
                    </h3>
                    <Link
                        to="../memberships"
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                        Browse plans →
                    </Link>
                </div>

                {(memberships as any[]).length > 0 ? (
                    <div className="space-y-3">
                        {(memberships as any[]).map((sub: any) => (
                            <div
                                key={sub.id}
                                className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-start gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{sub.plan?.name}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">
                                        {sub.nextBillingDate
                                            ? `Renews ${new Date(sub.nextBillingDate * 1000).toLocaleDateString()}`
                                            : "—"}
                                    </div>
                                    <div className="mt-2">
                                        <CancelButton subscriptionId={sub.id} />
                                    </div>
                                </div>
                                <div className={cn("px-3 py-1 rounded-full text-xs font-bold shrink-0", STATUS_COLORS[sub.status] || "bg-zinc-100 text-zinc-600")}>
                                    {sub.status === "trialing" ? "Trial" : sub.status === "past_due" ? "Past Due" : "Active"}
                                </div>
                            </div>
                        ))}

                        {/* Past due warning */}
                        {(memberships as any[]).some((s: any) => s.status === "past_due") && (
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <span>
                                    One or more of your memberships has a failed payment. Please update your payment method to avoid losing access.
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                        <p className="text-zinc-500 dark:text-zinc-400">You don't have an active membership.</p>
                        <Link
                            to="../memberships"
                            className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                        >
                            View Membership Plans
                        </Link>
                    </div>
                )}
            </section>

            {/* Policies */}
            <section className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Shield size={16} />
                    Policies & Waivers
                </h3>
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 text-sm text-zinc-500">
                    <div className="flex justify-between items-center">
                        <span>Liability Waiver</span>
                        <span className="text-emerald-600 font-medium text-xs">Signed on {joinedAt}</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
