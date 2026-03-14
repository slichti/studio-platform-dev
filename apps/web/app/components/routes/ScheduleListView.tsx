import { useParams, useOutletContext, useSearchParams } from "react-router";
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Clock, ChevronRight } from "lucide-react";
import { useInfiniteClasses } from "~/hooks/useClasses";
import { Button } from "~/components/ui/button";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { ClassDetailModal } from "~/components/ClassDetailModal";
import { cn } from "~/lib/utils";

export default function ScheduleListView() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const showPrevious = searchParams.get("showPrevious") === "true" || searchParams.get("includeArchived") === "true";
    const { roles, tenant, me, token: contextToken } = useOutletContext<any>() || {};

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    const rangeStart = useMemo(
        () => (showPrevious ? new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000) : today),
        [showPrevious, today]
    );

    const {
        data: infiniteData,
        isLoading: isLoadingClasses,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useInfiniteClasses(
        slug!,
        {
            status: showPrevious ? "all" : "active",
            limit: 50,
            dateRange: { start: rangeStart, end: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000) },
        },
        contextToken
    );

    let classes = infiniteData?.pages.flat() || [];
    if (!showPrevious) {
        classes = classes.filter((c: any) => c.status !== "cancelled" && c.status !== "archived");
    }

    const grouped = useMemo(() => {
        const acc: Record<string, any[]> = {};
        for (const cls of classes) {
            const date = new Date(cls.startTime).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
            });
            if (!acc[date]) acc[date] = [];
            acc[date].push(cls);
        }
        return acc;
    }, [classes]);

    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Class Schedule</h1>
                <p className="text-zinc-500 dark:text-zinc-400">List view by day.</p>
            </div>

            <ComponentErrorBoundary>
                {isLoadingClasses ? (
                    <SkeletonLoader type="card" count={5} />
                ) : Object.keys(grouped).length === 0 ? (
                    <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                        No classes in this range.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {(Object.entries(grouped) as [string, any[]][]).map(([date, events]) => (
                            <div key={date} className="space-y-1">
                                <div className="sticky top-0 bg-white/95 dark:bg-zinc-950/95 py-2 z-10 backdrop-blur border-b border-zinc-100 dark:border-zinc-900">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <CalendarIcon className="h-5 w-5 text-zinc-400" />
                                        {date}
                                    </h3>
                                </div>
                                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                    {events.map((cls) => {
                                        const isPast = new Date(cls.startTime) <= new Date();
                                        return (
                                            <li key={cls.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClass(cls);
                                                        setIsDetailOpen(true);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                                                        isPast && "opacity-75"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                            {cls.title}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(cls.startTime).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                            <span className="text-zinc-300 dark:text-zinc-600 mx-1">·</span>
                                                            {cls.durationMinutes} min
                                                        </span>
                                                        {cls.status === "archived" && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 uppercase">
                                                                Archived
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                        {hasNextPage && (
                            <div className="flex justify-center pt-4">
                                <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                                    {isFetchingNextPage ? "Loading more…" : "Load more"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </ComponentErrorBoundary>

            <ClassDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                classEvent={selectedClass}
                onRecordingAdded={() => {}}
                onRecordingDeleted={() => {}}
                canAttachRecording={false}
                currentUserMemberId={me?.member?.id}
                userRoles={me?.roles}
                tenantSlug={tenant?.slug}
                onSubRequested={() => {}}
                onBookRequested={() => {}}
                onEditRequested={() => {}}
                onClassUpdated={() => {}}
            />
        </div>
    );
}
