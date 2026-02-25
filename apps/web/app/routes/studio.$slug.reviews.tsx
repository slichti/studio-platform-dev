import { useLoaderData, useOutletContext, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Star, CheckCircle2, Trash2, BadgeCheck, MessageSquare, Sparkles, Copy, Pencil, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "~/utils/cn";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const reviews = await apiRequest("/reviews?all=true", token, {
            headers: { "X-Tenant-Slug": slug! },
        }) as any[];
        const stats = await apiRequest("/reviews/stats", token, {
            headers: { "X-Tenant-Slug": slug! },
        }) as any;
        return { reviews: reviews || [], stats, slug };
    } catch {
        return { reviews: [], stats: null, slug };
    }
};

function StarDisplay({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={14}
                    className={cn(
                        s <= rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"
                    )}
                />
            ))}
        </div>
    );
}

export default function StudioReviews() {
    const { reviews: initialReviews, stats, slug } = useLoaderData<typeof loader>();
    const { roles } = useOutletContext<any>();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();

    const [reviews, setReviews] = useState<any[]>(initialReviews);
    const [filter, setFilter] = useState<"all" | "pending" | "approved" | "testimonial">("all");
    const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null);
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
    const [editingDraftText, setEditingDraftText] = useState("");

    const canManage = roles?.includes("owner") || roles?.includes("admin");

    const approve = async (id: string, isTestimonial?: boolean) => {
        try {
            const token = await getToken();
            await apiRequest(`/reviews/${id}/approve`, token, {
                method: "PATCH",
                headers: { "X-Tenant-Slug": slug!, "Content-Type": "application/json" },
                body: JSON.stringify({ isApproved: true, isTestimonial: !!isTestimonial }),
            });
            setReviews(prev => prev.map(r => r.id === id ? { ...r, isApproved: true, isTestimonial: !!isTestimonial } : r));
            toast.success(isTestimonial ? "Marked as testimonial" : "Review approved");
        } catch {
            toast.error("Failed to update review");
        }
    };

    const remove = async (id: string) => {
        if (!confirm("Delete this review?")) return;
        try {
            const token = await getToken();
            await apiRequest(`/reviews/${id}`, token, {
                method: "DELETE",
                headers: { "X-Tenant-Slug": slug! },
            });
            setReviews(prev => prev.filter(r => r.id !== id));
            toast.success("Review deleted");
        } catch {
            toast.error("Failed to delete review");
        }
    };

    const generateDraftReply = async (id: string) => {
        setDraftLoadingId(id);
        try {
            const token = await getToken();
            const res = await apiRequest<{ replyDraft: string }>(`/reviews/${id}/draft-reply`, token, {
                method: "POST",
                headers: { "X-Tenant-Slug": slug! },
            });
            setReviews(prev => prev.map(r => r.id === id ? { ...r, replyDraft: res.replyDraft, replyDraftGeneratedAt: new Date().toISOString() } : r));
            toast.success("Reply draft generated");
            revalidator.revalidate();
        } catch (e: any) {
            toast.error(e?.message || "Failed to generate draft");
        } finally {
            setDraftLoadingId(null);
        }
    };

    const saveReplyDraft = async (id: string, text: string) => {
        try {
            const token = await getToken();
            await apiRequest(`/reviews/${id}/reply-draft`, token, {
                method: "PATCH",
                headers: { "X-Tenant-Slug": slug!, "Content-Type": "application/json" },
                body: JSON.stringify({ replyDraft: text || null }),
            });
            setReviews(prev => prev.map(r => r.id === id ? { ...r, replyDraft: text || null } : r));
            setEditingDraftId(null);
            setEditingDraftText("");
            toast.success("Draft saved");
        } catch {
            toast.error("Failed to save draft");
        }
    };

    const clearReplyDraft = async (id: string) => {
        try {
            const token = await getToken();
            await apiRequest(`/reviews/${id}/reply-draft`, token, {
                method: "PATCH",
                headers: { "X-Tenant-Slug": slug!, "Content-Type": "application/json" },
                body: JSON.stringify({ replyDraft: null }),
            });
            setReviews(prev => prev.map(r => r.id === id ? { ...r, replyDraft: null, replyDraftGeneratedAt: null } : r));
            setEditingDraftId(null);
            toast.success("Draft cleared");
        } catch {
            toast.error("Failed to clear draft");
        }
    };

    const copyDraftToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard — paste into Google or your review response");
    };

    const filtered = reviews.filter(r => {
        if (filter === "pending") return !r.isApproved;
        if (filter === "approved") return r.isApproved && !r.isTestimonial;
        if (filter === "testimonial") return r.isTestimonial;
        return true;
    });

    const pendingCount = reviews.filter(r => !r.isApproved).length;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Star size={24} className="fill-amber-400 text-amber-400" />
                    Reviews
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                    Manage student reviews and highlight testimonials on your public page.
                </p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Avg Rating</p>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{stats.avgRating}</p>
                        <StarDisplay rating={Math.round(parseFloat(stats.avgRating))} />
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Reviews</p>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{stats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Pending Approval</p>
                        <p className={cn("text-3xl font-bold mt-1", pendingCount > 0 ? "text-amber-500" : "text-zinc-900 dark:text-zinc-100")}>{pendingCount}</p>
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-0">
                {(["all", "pending", "approved", "testimonial"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors",
                            filter === tab
                                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        {tab}
                        {tab === "pending" && pendingCount > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs rounded-full">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Review list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                    <MessageSquare className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <p className="text-zinc-500 text-sm">No reviews in this category yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((review) => {
                        const name = review.memberProfile
                            ? `${(review.memberProfile as any)?.firstName ?? ""} ${(review.memberProfile as any)?.lastName ?? ""}`.trim() || "Student"
                            : "Student";
                        return (
                            <div
                                key={review.id}
                                className={cn(
                                    "bg-white dark:bg-zinc-900 rounded-xl border px-5 py-4",
                                    review.isTestimonial
                                        ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10"
                                        : review.isApproved
                                            ? "border-emerald-200 dark:border-emerald-800"
                                            : "border-zinc-200 dark:border-zinc-800"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{name}</span>
                                            <StarDisplay rating={review.rating} />
                                            {review.isTestimonial && (
                                                <span className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                                                    <BadgeCheck size={11} />
                                                    Testimonial
                                                </span>
                                            )}
                                            {review.isApproved && !review.isTestimonial && (
                                                <span className="flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                                                    <CheckCircle2 size={11} />
                                                    Approved
                                                </span>
                                            )}
                                            {!review.isApproved && (
                                                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Pending</span>
                                            )}
                                            <span className="text-xs text-zinc-400 ml-auto">
                                                {format(new Date(review.createdAt), "MMM d, yyyy")}
                                            </span>
                                        </div>
                                        {review.content && (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">"{review.content}"</p>
                                        )}
                                        {review.targetType === "class" && review.targetId && (
                                            <p className="text-xs text-zinc-400 mt-1">Class review</p>
                                        )}
                                        {/* Review AI: reply draft */}
                                        {canManage && (
                                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Reply draft (for Google / review sites)</p>
                                                {editingDraftId === review.id ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={editingDraftText}
                                                            onChange={(e) => setEditingDraftText(e.target.value)}
                                                            rows={3}
                                                            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-950 resize-none"
                                                            placeholder="Write or paste your reply…"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => saveReplyDraft(review.id, editingDraftText)}
                                                                className="px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingDraftId(null); setEditingDraftText(""); }}
                                                                className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : review.replyDraft ? (
                                                    <div className="flex items-start gap-2">
                                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-700">
                                                            {review.replyDraft}
                                                        </p>
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => copyDraftToClipboard(review.replyDraft)}
                                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                                title="Copy"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingDraftId(review.id); setEditingDraftText(review.replyDraft || ""); }}
                                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                                title="Edit"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => clearReplyDraft(review.id)}
                                                                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                title="Clear draft"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => generateDraftReply(review.id)}
                                                        disabled={draftLoadingId === review.id}
                                                        className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-60"
                                                    >
                                                        <Sparkles size={12} />
                                                        {draftLoadingId === review.id ? "Generating…" : "Generate reply draft"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {canManage && (
                                        <div className="flex gap-2 shrink-0">
                                            {!review.isApproved && (
                                                <button
                                                    onClick={() => approve(review.id)}
                                                    className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                                    title="Approve"
                                                >
                                                    <CheckCircle2 size={15} />
                                                </button>
                                            )}
                                            {review.isApproved && !review.isTestimonial && (
                                                <button
                                                    onClick={() => approve(review.id, true)}
                                                    className="p-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                                    title="Mark as testimonial"
                                                >
                                                    <BadgeCheck size={15} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => remove(review.id)}
                                                className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
