import { useParams, useOutletContext, useSearchParams } from "react-router";
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Clock, ChevronRight, Users, MapPin, Video, List as ListIcon } from "lucide-react";
import { useInfiniteClasses } from "~/hooks/useClasses";
import { Button } from "~/components/ui/button";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { ClassDetailModal } from "~/components/ClassDetailModal";
import { cn } from "~/lib/utils";

export default function ScheduleListView() {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
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

    const sections = useMemo(() => {
        const byDate: Record<string, { date: Date; items: any[] }> = {};
        for (const cls of classes) {
            const d = new Date(cls.startTime);
            const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
            if (!byDate[key]) byDate[key] = { date: d, items: [] };
            byDate[key].items.push(cls);
        }
        const keys = Object.keys(byDate).sort();

        const isSameDay = (a: Date, b: Date) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();

        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        return keys.map((key) => {
            const d = byDate[key].date;

            const formattedDate = d.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
            });

            let label: string;
            if (isSameDay(d, today)) label = `Today • ${formattedDate}`;
            else if (isSameDay(d, tomorrow)) label = `Tomorrow • ${formattedDate}`;
            else label = formattedDate;

            return { key, label, items: byDate[key].items };
        });
    }, [classes, today]);

    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const handleSetView = (view: "calendar" | "tile" | "listview") => {
        const p = new URLSearchParams(searchParams);
        p.set("view", view);
        setSearchParams(p);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Class Schedule</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">List view by day.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 mr-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs text-zinc-500 hover:text-zinc-900"
                            onClick={() => handleSetView("calendar")}
                        >
                            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Calendar
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs text-zinc-500 hover:text-zinc-900"
                            onClick={() => handleSetView("tile")}
                        >
                            <ListIcon className="h-3.5 w-3.5 mr-1.5" /> Tile
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                        >
                            <ListIcon className="h-3.5 w-3.5 mr-1.5" /> List
                        </Button>
                    </div>

                    <label className="flex items-center gap-1.5 text-sm cursor-pointer mr-2 select-none">
                        <input
                            type="checkbox"
                            className="rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800"
                            checked={showPrevious}
                            onChange={(e) => {
                                const p = new URLSearchParams(searchParams);
                                if (e.target.checked) p.set("showPrevious", "true");
                                else p.delete("showPrevious");
                                setSearchParams(p);
                            }}
                        />
                        <span className="text-zinc-600 dark:text-zinc-400">Show previous</span>
                    </label>
                </div>
            </div>

            <ComponentErrorBoundary>
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 space-y-6">
                    {isLoadingClasses ? (
                        <SkeletonLoader type="card" count={5} />
                    ) : sections.length === 0 ? (
                        <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                            No classes in this range.
                        </div>
                    ) : (
                        <>
                            {sections.map(({ key, label, items }) => (
                                <div key={key} className="space-y-1">
                                    <div className="sticky top-0 bg-white/95 dark:bg-zinc-950/95 py-2 z-10 backdrop-blur border-b border-zinc-100 dark:border-zinc-900">
                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                            <CalendarIcon className="h-5 w-5 text-zinc-400" />
                                            {label}
                                        </h3>
                                    </div>
                                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {items.map((cls: any) => {
                                            const isPast = new Date(cls.startTime) <= new Date();
                                            const instructors = cls.instructors && cls.instructors.length > 0
                                                ? cls.instructors
                                                : cls.instructor
                                                    ? [cls.instructor]
                                                    : [];
                                            const firstInst = instructors[0];
                                            const typeLabel = cls.isCourse ? "Course" : (cls.type ? (cls.type.charAt(0).toUpperCase() + cls.type.slice(1)) : "Class");
                                            const locationName = cls.location?.name || (cls.zoomEnabled ? "Online" : "");
                                            let modality = "";
                                            if (cls.zoomEnabled && cls.location) modality = "In person + virtual";
                                            else if (cls.zoomEnabled && !cls.location) modality = "Virtual only";
                                            else if (!cls.zoomEnabled && cls.location) modality = "In person";

                                            return (
                                                <li key={cls.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedClass(cls);
                                                            setIsDetailOpen(true);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between gap-4 px-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                                                            isPast && "opacity-75"
                                                        )}
                                                    >
                                                        <div className="flex items-start gap-3 min-w-0">
                                                            {/* Time block */}
                                                            <div className="flex flex-col items-start text-xs text-zinc-500 dark:text-zinc-400 shrink-0 w-20">
                                                                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                                                                    {new Date(cls.startTime).toLocaleTimeString([], {
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })}
                                                                </span>
                                                                <span>{cls.durationMinutes} min</span>
                                                            </div>

                                                            {/* Main content */}
                                                            <div className="flex flex-col gap-1 min-w-0">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                                        {cls.title}
                                                                    </span>
                                                                    {cls.status === "archived" && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 uppercase">
                                                                            Archived
                                                                        </span>
                                                                    )}
                                                                    {cls.isCourse && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                                                                            Course
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                                    {/* Instructors */}
                                                                    {instructors.length > 0 && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="flex -space-x-1.5">
                                                                                {instructors.slice(0, 3).map((inst: any, i: number) => {
                                                                                    const profile = inst.user?.profile;
                                                                                    const photoUrl = profile?.portraitUrl || profile?.avatarUrl;
                                                                                    const name = profile?.firstName || "Instructor";
                                                                                    return photoUrl ? (
                                                                                        <img
                                                                                            key={i}
                                                                                            src={photoUrl}
                                                                                            alt={name}
                                                                                            className="w-4 h-4 rounded-full border border-white dark:border-zinc-950 object-cover"
                                                                                        />
                                                                                    ) : (
                                                                                        <div
                                                                                            key={i}
                                                                                            className="w-4 h-4 rounded-full border border-white dark:border-zinc-950 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500"
                                                                                        >
                                                                                            {name.charAt(0)}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            <span className="truncate">
                                                                                w/ {instructors.map((i: any) => i.user?.profile?.firstName).join(", ")}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* Type */}
                                                                    <span className="flex items-center gap-1">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                                                        {typeLabel}
                                                                    </span>

                                                                    {/* Location */}
                                                                    {locationName && (
                                                                        <span className="flex items-center gap-1">
                                                                            <MapPin className="h-3 w-3" />
                                                                            {locationName}
                                                                        </span>
                                                                    )}

                                                                    {/* Modality */}
                                                                    {modality && (
                                                                        <span className="flex items-center gap-1">
                                                                            {cls.zoomEnabled && <Video className="h-3 w-3" />}
                                                                            {modality}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
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
                        </>
                    )}
                </div>
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
