// @ts-ignore
import { useLoaderData, useOutletContext, Link } from "react-router"; // @ts-ignore
import type { LoaderFunctionArgs } from "react-router"; // @ts-ignore
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Award, Target, Flame, Activity } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const [myProgress] = await Promise.all([
            apiRequest(`/challenges/my-progress`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => [])
        ]);
        return { myProgress };
    } catch (e) {
        console.error("Portal Dashboard loader failed:", e);
        return { myProgress: [] };
    }
}

export default function StudentPortalIndex() {
    const { tenant, me } = useOutletContext<any>();
    const { myProgress } = useLoaderData<typeof loader>();

    const displayName = me?.firstName || 'Student';

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Welcome back, {displayName}!</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Ready for your next session?</p>
            </div>

            {/* Achievements Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Award className="text-yellow-500" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Your Achievements</h2>
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

            {/* Quick Actions / Announcements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-100 mb-4 flex items-center gap-2">
                        <Activity size={20} className="text-indigo-500" />
                        Announcement
                    </h3>
                    <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
                        Summer schedule is live! Check out our new morning flow classes starting next week.
                    </p>
                </section>

                <section className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                    <h3 className="font-bold text-orange-900 dark:text-orange-100 mb-4 flex items-center gap-2">
                        <Flame size={20} className="text-orange-500" />
                        Current Promotion
                    </h3>
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-orange-700 dark:text-orange-300">Power Yoga @ 6:00 PM</span>
                        <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded font-bold">20% OFF</span>
                    </div>
                    <Link to="classes" className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline">Book Now &rarr;</Link>
                </section>
            </div>
        </div>
    );
}
