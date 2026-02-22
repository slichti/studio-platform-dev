import { useLoaderData, useOutletContext, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Award, Target, Flame, Activity, Calendar, Megaphone, CalendarX, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const headers = { 'X-Tenant-Slug': slug! };

    try {
        const [myProgress, announcements, upcomingBookings] = await Promise.all([
            apiRequest(`/challenges/my-progress`, token, { headers }).catch(() => []),
            apiRequest(`/community?type=announcement&limit=3`, token, { headers }).catch(() => []),
            apiRequest(`/bookings/my-upcoming`, token, { headers }).catch(() => []),
        ]);

        // Pick the very next upcoming class
        const sorted = (Array.isArray(upcomingBookings) ? upcomingBookings : [])
            .filter((b: any) => b.status === 'confirmed')
            .sort((a: any, b: any) => new Date(a.class?.startTime).getTime() - new Date(b.class?.startTime).getTime());
        const nextClass = sorted[0] || null;

        return { myProgress, announcements: Array.isArray(announcements) ? announcements : [], nextClass };
    } catch (e) {
        console.error("Portal Dashboard loader failed:", e);
        return { myProgress: [], announcements: [], nextClass: null };
    }
}

export default function StudentPortalIndex() {
    const { tenant, me } = useOutletContext<any>();
    const { myProgress, announcements, nextClass } = useLoaderData<typeof loader>();

    const displayName = me?.firstName || 'Student';

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Welcome back, {displayName}!</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Ready for your next session?</p>
            </div>

            {/* Next Class Widget */}
            {nextClass ? (
                <section className="bg-indigo-600 text-white rounded-2xl p-6 flex items-center gap-5 shadow-lg shadow-indigo-200 dark:shadow-none">
                    <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Calendar size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">Your Next Class</p>
                        <p className="text-xl font-bold truncate mt-0.5">{nextClass.class?.title}</p>
                        <p className="text-indigo-200 text-sm mt-0.5">
                            {format(new Date(nextClass.class?.startTime), "EEEE, MMM d 'at' h:mm a")}
                            {nextClass.class?.instructor ? ` · ${nextClass.class.instructor}` : ""}
                        </p>
                    </div>
                    <Link
                        to="classes"
                        className="flex items-center gap-1 text-sm font-semibold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-colors shrink-0"
                    >
                        Schedule <ChevronRight size={16} />
                    </Link>
                </section>
            ) : (
                <section className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 flex items-center gap-4">
                    <CalendarX size={28} className="text-zinc-400 shrink-0" />
                    <div className="flex-1">
                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">No upcoming classes booked</p>
                        <p className="text-zinc-500 text-sm">Browse the schedule and book your next session.</p>
                    </div>
                    <Link
                        to="classes"
                        className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                    >
                        Book now →
                    </Link>
                </section>
            )}

            {/* Studio Announcements */}
            {(announcements as any[]).length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Megaphone size={20} className="text-indigo-500" />
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">From {tenant?.name || "the Studio"}</h2>
                    </div>
                    <div className="space-y-3">
                        {(announcements as any[]).map((post: any) => (
                            <div
                                key={post.id}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4"
                            >
                                {post.isPinned && (
                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full uppercase tracking-wider mr-2">Pinned</span>
                                )}
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mt-1">{post.content}</p>
                                <p className="text-xs text-zinc-400 mt-2">
                                    {format(new Date(post.createdAt * 1000), "MMM d, yyyy")}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Achievements / Challenges */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Award className="text-yellow-500" size={20} />
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Your Achievements</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(myProgress || []).map((challenge: any) => (
                        <div key={challenge.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 shrink-0">
                                {challenge.userProgress.status === 'completed' ? <Award size={24} /> : <Target size={24} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{challenge.title}</h4>
                                    {challenge.userProgress.status === 'completed' && (
                                        <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">EARNED</span>
                                    )}
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 mb-1">
                                    <div
                                        className="bg-yellow-500 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (challenge.userProgress.progress / challenge.targetValue) * 100)}%` }}
                                    />
                                </div>
                                <div className="text-xs text-zinc-500 flex justify-between">
                                    {challenge.type === 'streak' ? (
                                        <span className="flex items-center gap-1 font-medium text-amber-600">
                                            <Flame size={12} className={challenge.userProgress.status === 'completed' ? "" : "animate-pulse"} />
                                            {challenge.userProgress.progress} / {challenge.targetValue} {challenge.period || 'streak'}s
                                        </span>
                                    ) : (
                                        <span>{challenge.userProgress.progress} / {challenge.targetValue} {challenge.type === 'minutes' ? 'mins' : 'classes'}</span>
                                    )}
                                    <span>{Math.round((challenge.userProgress.progress / challenge.targetValue) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(myProgress || []).length === 0 && (
                        <div className="col-span-2 text-center py-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                            <p className="text-zinc-500 dark:text-zinc-400">Join active challenges to earn rewards!</p>
                            <Link to="challenges" className="text-indigo-600 dark:text-indigo-400 font-medium text-sm mt-2 inline-block hover:underline">View All Challenges</Link>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
