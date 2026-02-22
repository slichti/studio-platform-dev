import { useLoaderData, useOutletContext, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "~/utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { Package, ShoppingCart, Clock, CheckCircle2, AlertTriangle, Tag, X, CheckCircle } from "lucide-react";
import { format, isPast } from "date-fns";
import { cn } from "~/utils/cn";
import { useState, useRef } from "react";
import { useAuth } from "@clerk/react-router";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const headers = { "X-Tenant-Slug": slug! };

    const [myPacks, availablePacks] = await Promise.all([
        apiRequest(`/members/me/packs`, token, { headers }).catch(() => []),
        apiRequest(`/commerce/packs`, token, { headers }).catch(() => []),
    ]);

    return {
        myPacks: myPacks || [],
        availablePacks: availablePacks || [],
        slug,
    };
};

function formatCents(cents: number) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function BuyPackButton({ pack, slug }: { pack: any; slug: string }) {
    const { getToken } = useAuth();
    const [showCoupon, setShowCoupon] = useState(false);
    const [couponCode, setCouponCode] = useState("");
    const [couponState, setCouponState] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
    const [couponDiscount, setCouponDiscount] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const validateCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponState("checking");
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/coupons/${couponCode.trim().toUpperCase()}/validate`, token, {
                headers: { "X-Tenant-Slug": slug }
            });
            if (res?.valid) {
                setCouponState("valid");
                const discountText = res.type === "percentage"
                    ? `${res.value}% off`
                    : `$${(res.value / 100).toFixed(2)} off`;
                setCouponDiscount(discountText);
            } else {
                setCouponState("invalid");
                setCouponDiscount(null);
            }
        } catch {
            setCouponState("invalid");
            setCouponDiscount(null);
        }
    };

    const handleBuy = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/commerce/checkout/session`, token, {
                method: "POST",
                body: JSON.stringify({ packId: pack.id, couponCode: couponState === "valid" ? couponCode.trim().toUpperCase() : undefined }),
                headers: { "X-Tenant-Slug": slug, "Content-Type": "application/json" }
            });
            if (res?.url) window.location.href = res.url;
        } catch {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            {showCoupon ? (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="COUPON CODE"
                            value={couponCode}
                            onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponState("idle"); setCouponDiscount(null); }}
                            className="flex-1 text-xs uppercase border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            onClick={validateCoupon}
                            disabled={couponState === "checking" || !couponCode.trim()}
                            className="text-xs px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                            {couponState === "checking" ? "…" : "Apply"}
                        </button>
                        <button onClick={() => { setShowCoupon(false); setCouponCode(""); setCouponState("idle"); setCouponDiscount(null); }} className="text-zinc-400 hover:text-zinc-600">
                            <X size={15} />
                        </button>
                    </div>
                    {couponState === "valid" && couponDiscount && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> {couponDiscount} applied!</p>
                    )}
                    {couponState === "invalid" && (
                        <p className="text-xs text-red-500">Invalid or expired coupon.</p>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => setShowCoupon(true)}
                    className="text-xs text-indigo-500 hover:underline flex items-center gap-1"
                >
                    <Tag size={11} /> Have a coupon code?
                </button>
            )}
            <button
                onClick={handleBuy}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shadow-sm shadow-indigo-200 dark:shadow-none disabled:opacity-60"
            >
                <ShoppingCart size={15} />
                {loading ? "Redirecting…" : couponState === "valid" ? `Buy Pack (${couponDiscount})` : "Buy Pack"}
            </button>
        </div>
    );
}

export default function StudentPortalPacks() {
    const { myPacks, availablePacks, slug } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>();

    const activePacks = (myPacks as any[]).filter((p: any) => p.status === "active" && p.remainingCredits > 0);
    const usedOrExpiredPacks = (myPacks as any[]).filter((p: any) => p.status !== "active" || p.remainingCredits === 0);

    const totalCredits = activePacks.reduce((sum: number, p: any) => sum + (p.remainingCredits ?? 0), 0);

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Package size={24} />
                    Class Packs
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                    Manage your class credits and purchase new packs.
                </p>
            </div>

            {/* Credit summary */}
            {totalCredits > 0 && (
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
                    <p className="text-indigo-100 text-sm font-medium">Total Available Credits</p>
                    <p className="text-5xl font-black mt-1">{totalCredits}</p>
                    <p className="text-indigo-200 text-sm mt-1">across {activePacks.length} active pack{activePacks.length !== 1 ? "s" : ""}</p>
                </div>
            )}

            {/* Active packs */}
            <section>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">My Packs</h2>

                {activePacks.length === 0 && usedOrExpiredPacks.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <Package className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-2" />
                        <p className="text-zinc-500 dark:text-zinc-400">You haven't purchased any packs yet.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activePacks.map((pack: any) => {
                            const def = pack.definition;
                            const expiresAt = pack.expiresAt ? new Date(pack.expiresAt * 1000) : null;
                            const expiringSoon = expiresAt && !isPast(expiresAt) && (expiresAt.getTime() - Date.now()) < 1000 * 60 * 60 * 24 * 14;
                            const usedCredits = (pack.initialCredits ?? 0) - (pack.remainingCredits ?? 0);
                            const pct = pack.initialCredits > 0 ? Math.round((pack.remainingCredits / pack.initialCredits) * 100) : 0;

                            return (
                                <div
                                    key={pack.id}
                                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{def?.name ?? "Class Pack"}</p>
                                            {expiresAt && (
                                                <p className={cn(
                                                    "text-xs mt-0.5 flex items-center gap-1",
                                                    expiringSoon ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"
                                                )}>
                                                    {expiringSoon && <AlertTriangle size={12} />}
                                                    <Clock size={12} />
                                                    Expires {format(expiresAt, "MMM d, yyyy")}
                                                </p>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{pack.remainingCredits}</span>
                                            <span className="text-sm text-zinc-500 dark:text-zinc-400"> / {pack.initialCredits} credits</span>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                                        <div
                                            className={cn(
                                                "h-2 rounded-full transition-all",
                                                pct > 50 ? "bg-indigo-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-400">{usedCredits} used · {pack.remainingCredits} remaining</p>
                                </div>
                            );
                        })}

                        {/* Used / expired packs collapsed */}
                        {usedOrExpiredPacks.length > 0 && (
                            <details className="group">
                                <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 py-1 select-none list-none flex items-center gap-1">
                                    <span className="group-open:hidden">▶</span>
                                    <span className="hidden group-open:inline">▼</span>
                                    {usedOrExpiredPacks.length} used / expired pack{usedOrExpiredPacks.length !== 1 ? "s" : ""}
                                </summary>
                                <div className="space-y-2 mt-2">
                                    {usedOrExpiredPacks.map((pack: any) => (
                                        <div
                                            key={pack.id}
                                            className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between opacity-60"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{pack.definition?.name ?? "Class Pack"}</p>
                                                <p className="text-xs text-zinc-400">{pack.status === "expired" ? "Expired" : "Used up"}</p>
                                            </div>
                                            <CheckCircle2 size={16} className="text-zinc-300" />
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}
            </section>

            {/* Available packs to purchase */}
            {(availablePacks as any[]).length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Available Packs</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(availablePacks as any[]).map((pack: any) => (
                            <div
                                key={pack.id}
                                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4"
                            >
                                <div className="flex-1">
                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{pack.name}</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                        {pack.credits} class credit{pack.credits !== 1 ? "s" : ""}
                                        {pack.expirationDays ? ` · Valid ${pack.expirationDays} days` : ""}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 block mb-3">
                                        {formatCents(pack.price)}
                                    </span>
                                    <BuyPackButton pack={pack} slug={slug!} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
