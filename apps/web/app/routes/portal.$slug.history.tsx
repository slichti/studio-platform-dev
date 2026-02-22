import { useLoaderData, useOutletContext, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "~/utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { History, CheckCircle2, XCircle, Clock, ChevronDown, CalendarX, Star, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "~/utils/cn";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";

const LIMIT = 20;

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const url = new URL(args.request.url);
    const offset = Number(url.searchParams.get("offset") || 0);

    const history = await apiRequest(`/bookings/history?limit=${LIMIT}&offset=${offset}`, token, {
        headers: { "X-Tenant-Slug": slug! },
    }).catch(() => []);

    return { history: history || [], offset, slug };
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    confirmed: <CheckCircle2 size={16} className="text-emerald-500" />,
    cancelled: <XCircle size={16} className="text-red-400" />,
    waitlisted: <Clock size={16} className="text-amber-500" />,
};

const STATUS_LABEL: Record<string, string> = {
    confirmed: "Attended",
    cancelled: "Cancelled",
    waitlisted: "Waitlisted",
};

const STATUS_COLOR: Record<string, string> = {
    confirmed: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
    cancelled: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    waitlisted: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
};

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
    const [hovered, setHovered] = useState(0);
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    className={cn("p-0.5 transition-transform", !readonly && "hover:scale-110 cursor-pointer")}
                    onClick={() => !readonly && onChange?.(star)}
                    onMouseEnter={() => !readonly && setHovered(star)}
                    onMouseLeave={() => !readonly && setHovered(0)}
                >
                    <Star
                        size={20}
                        className={cn(
                            "transition-colors",
                            star <= (hovered || value)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"
                        )}
                    />
                </button>
            ))}
        </div>
    );
}

function RateClassDialog({ booking, slug, onClose }: { booking: any; slug: string; onClose: () => void }) {
    const { getToken } = useAuth();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (rating === 0) { toast.error("Please select a rating"); return; }
        setSubmitting(true);
        try {
            const token = await getToken();
            await apiRequest("/reviews", token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug, "Content-Type": "application/json" },
                body: JSON.stringify({ rating, content: comment.trim() || undefined, targetType: "class", targetId: booking.classId }),
            });
            toast.success("Thanks for your feedback!");
            onClose();
        } catch {
            toast.error("Failed to submit rating. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div>
                    <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Rate this class</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{booking.classTitle}</p>
                </div>

                <div className="flex justify-center py-2">
                    <StarRating value={rating} onChange={setRating} />
                </div>

                <textarea
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Share your thoughts (optional)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting || rating === 0}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {submitting ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function StudentPortalHistory() {
    const initialData = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>();
    const { getToken } = useAuth();
    const fetcher = useFetcher<typeof loader>();

    const [history, setHistory] = useState<any[]>(initialData.history);
    const [currentOffset, setCurrentOffset] = useState(initialData.history.length);
    const [hasMore, setHasMore] = useState(initialData.history.length === LIMIT);
    const [ratingBooking, setRatingBooking] = useState<any | null>(null);
    const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
    const [exportingCsv, setExportingCsv] = useState(false);

    useEffect(() => {
        if (fetcher.data?.history) {
            const newItems = fetcher.data.history;
            setHistory(prev => [...prev, ...newItems]);
            setCurrentOffset((o: number) => o + newItems.length);
            setHasMore(newItems.length === LIMIT);
        }
    }, [fetcher.data]);

    const loadMore = () => {
        if (fetcher.state !== "idle") return;
        fetcher.load(`?offset=${currentOffset}`);
    };

    const handleRateClose = (submitted?: boolean) => {
        if (submitted && ratingBooking) {
            setRatedIds(prev => new Set([...prev, ratingBooking.id]));
        }
        setRatingBooking(null);
    };

    const exportCsv = async () => {
        setExportingCsv(true);
        try {
            const token = await getToken();
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/bookings/history/export`,
                { headers: { Authorization: `Bearer ${token}`, "X-Tenant-Slug": initialData.slug! } }
            );
            if (!response.ok) throw new Error("Export failed");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `class-history-${initialData.slug}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Export failed. Please try again.");
        } finally {
            setExportingCsv(false);
        }
    };

    // Group by year-month
    const grouped = history.reduce((acc: Record<string, any[]>, b: any) => {
        const key = format(new Date(b.classStartTime * 1000), "MMMM yyyy");
        if (!acc[key]) acc[key] = [];
        acc[key].push(b);
        return acc;
    }, {});

    const now = Date.now();

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <History size={24} />
                        Class History
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                        A record of all classes you've attended.
                    </p>
                </div>
                {history.length > 0 && (
                    <button
                        onClick={exportCsv}
                        disabled={exportingCsv}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <Download size={15} />
                        {exportingCsv ? "Exporting…" : "Export CSV"}
                    </button>
                )}
            </div>

            {history.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                    <CalendarX className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No class history yet</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        Classes you attend will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(grouped).map(([month, items]) => (
                        <div key={month} className="space-y-3">
                            <div className="sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur py-2 border-b border-zinc-100 dark:border-zinc-900">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{month}</h2>
                            </div>
                            <div className="space-y-3">
                                {(items as any[]).map((b: any) => {
                                    const start = new Date(b.classStartTime * 1000);
                                    const checkedIn = b.checkedInAt ? new Date(b.checkedInAt * 1000) : null;
                                    const isPast = start.getTime() < now;
                                    const canRate = isPast && b.status === "confirmed" && !ratedIds.has(b.id);

                                    return (
                                        <div
                                            key={b.id}
                                            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4 flex items-center gap-4"
                                        >
                                            {/* Date block */}
                                            <div className="flex flex-col items-center justify-center min-w-[3.5rem] text-center">
                                                <span className="text-xs font-semibold text-zinc-400 uppercase">{format(start, "MMM")}</span>
                                                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{format(start, "d")}</span>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px h-10 bg-zinc-100 dark:bg-zinc-800 shrink-0" />

                                            {/* Class info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{b.classTitle}</p>
                                                <p className="text-xs text-zinc-500 mt-0.5">
                                                    {format(start, "h:mm a")}
                                                    {b.classDurationMinutes ? ` · ${b.classDurationMinutes} min` : ""}
                                                    {checkedIn ? ` · Checked in ${format(checkedIn, "h:mm a")}` : ""}
                                                </p>
                                            </div>

                                            {/* Rate button for attended past classes */}
                                            {canRate && (
                                                <button
                                                    onClick={() => setRatingBooking(b)}
                                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                                >
                                                    <Star size={12} className="fill-amber-500 text-amber-500" />
                                                    Rate
                                                </button>
                                            )}

                                            {/* Status badge */}
                                            <div className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
                                                STATUS_COLOR[b.status] || "bg-zinc-100 text-zinc-600"
                                            )}>
                                                {STATUS_ICON[b.status]}
                                                {STATUS_LABEL[b.status] || b.status}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Load more */}
                    <div className="flex flex-col items-center gap-3 pt-2">
                        {hasMore ? (
                            <button
                                onClick={loadMore}
                                disabled={fetcher.state !== "idle"}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:border-indigo-300 transition-all disabled:opacity-50"
                            >
                                <ChevronDown size={16} />
                                {fetcher.state !== "idle" ? "Loading…" : "Load More"}
                            </button>
                        ) : (
                            <p className="text-xs text-zinc-400 py-2">You've reached the beginning of your history.</p>
                        )}
                    </div>
                </div>
            )}

            {ratingBooking && (
                <RateClassDialog
                    booking={ratingBooking}
                    slug={initialData.slug!}
                    onClose={() => handleRateClose()}
                />
            )}
        </div>
    );
}
