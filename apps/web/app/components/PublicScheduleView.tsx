import { Link } from "react-router";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Video, LogIn } from "lucide-react";

interface PublicScheduleViewProps {
    tenant: { name: string; id: string; currency?: string };
    classes: any[];
    tenantSlug: string;
}

export function PublicScheduleView({ tenant, classes: rawClasses, tenantSlug }: PublicScheduleViewProps) {
    const classes = (rawClasses || []).filter(
        (c: any) => c.status !== "cancelled" && c.status !== "archived"
    );

    const grouped = classes.reduce<Record<string, any[]>>((acc, cls) => {
        const date = new Date(cls.startTime);
        const key = format(date, "EEEE, MMMM d");
        if (!acc[key]) acc[key] = [];
        acc[key].push(cls);
        return acc;
    }, {});

    const sortedDates = Object.keys(grouped).sort((a, b) => {
        const firstA = grouped[a][0]?.startTime;
        const firstB = grouped[b][0]?.startTime;
        if (!firstA || !firstB) return 0;
        return new Date(firstA).getTime() - new Date(firstB).getTime();
    });

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
            <div className="max-w-2xl mx-auto px-4 py-8">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Class schedule</p>
                    <Link
                        to={`/sign-in?redirect_url=${encodeURIComponent(`/studio/${tenantSlug}/classes`)}`}
                        className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <LogIn className="h-4 w-4" />
                        Sign in to book
                    </Link>
                </header>

                {sortedDates.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500 dark:text-zinc-400">
                        <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No upcoming classes</p>
                        <p className="text-sm mt-1">Check back later or sign in to see more.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedDates.map((dateKey) => (
                            <section key={dateKey} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                                <h2 className="flex items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800/50 font-semibold text-zinc-900 dark:text-zinc-100">
                                    <CalendarIcon className="h-4 w-4 text-zinc-500" />
                                    {dateKey}
                                </h2>
                                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {grouped[dateKey].map((cls: any) => (
                                        <li
                                            key={cls.id}
                                            className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                        {cls.title}
                                                    </span>
                                                    {cls.zoomEnabled && (
                                                        <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                    {format(new Date(cls.startTime), "h:mm a")}
                                                    {" · "}
                                                    {cls.durationMinutes} min
                                                    {cls.instructor?.user?.profile?.firstName &&
                                                        ` · ${cls.instructor.user.profile.firstName}`}
                                                </p>
                                            </div>
                                            <Link
                                                to={`/sign-in?redirect_url=${encodeURIComponent(`/studio/${tenantSlug}/classes`)}`}
                                                className="shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                            >
                                                Book →
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}

                <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    <Link
                        to={`/sign-in?redirect_url=${encodeURIComponent(`/studio/${tenantSlug}/classes`)}`}
                        className="underline hover:no-underline"
                    >
                        Sign in
                    </Link>
                    {" to book classes and manage your schedule."}
                </p>
            </div>
        </div>
    );
}
