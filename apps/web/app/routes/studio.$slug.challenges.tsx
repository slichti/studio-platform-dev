// @ts-ignore
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useSubmit, Form, redirect, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Trophy, Target, Users, Calendar, ChevronRight, Plus, Star, Medal, Flame, TrendingUp, Check, Clock } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const [challengesData, myProgressData, leaderboardData] = await Promise.all([
            apiRequest('/challenges', token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/challenges/my-progress', token, { headers: { 'X-Tenant-Slug': slug } }).catch(() => []),
            apiRequest('/challenges/leaderboard', token, { headers: { 'X-Tenant-Slug': slug } }).catch(() => [])
        ]) as any[];

        return {
            challenges: challengesData || [],
            myProgress: myProgressData || [],
            leaderboard: leaderboardData || []
        };
    } catch (e) {
        console.error("Challenges Loader Error", e);
        return { challenges: [], myProgress: [], leaderboard: [] };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'join') {
        await apiRequest(`/challenges/${formData.get("challengeId")}/join`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug }
        });
    }

    if (intent === 'create') {
        await apiRequest('/challenges', token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({
                title: formData.get("title"),
                description: formData.get("description"),
                type: formData.get("type"),
                goal: parseInt(formData.get("goal") as string || "10"),
                startDate: formData.get("startDate"),
                endDate: formData.get("endDate"),
                rewardPoints: parseInt(formData.get("rewardPoints") as string || "100")
            })
        });
    }

    return { success: true };
};

export default function ChallengesPrograms() {
    const { challenges, myProgress, leaderboard } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const [isCreating, setIsCreating] = useState(false);
    const [tab, setTab] = useState<'active' | 'leaderboard' | 'past'>('active');

    const activeChallenges = challenges.filter((c: any) => c.status === 'active');
    const pastChallenges = challenges.filter((c: any) => c.status !== 'active');

    const getProgress = (challengeId: string) => {
        return myProgress.find((p: any) => p.challengeId === challengeId);
    };

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-6 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg"><Trophy size={24} /></div>
                        <div>
                            <h1 className="text-2xl font-bold">Challenges</h1>
                            <p className="text-white/80">Complete challenges and earn rewards</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50 flex items-center gap-2"
                    >
                        <Plus size={16} /> Create Challenge
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mt-6">
                    {(['active', 'leaderboard', 'past'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${tab === t ? 'bg-white text-amber-600' : 'bg-white/20 text-white hover:bg-white/30'}`}
                        >
                            {t === 'active' && <><Flame size={16} className="inline mr-1" /> Active</>}
                            {t === 'leaderboard' && <><Medal size={16} className="inline mr-1" /> Leaderboard</>}
                            {t === 'past' && <><Clock size={16} className="inline mr-1" /> Past</>}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {/* Active Challenges */}
                {tab === 'active' && (
                    <div className="space-y-4">
                        {activeChallenges.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500">
                                <Target size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No active challenges</p>
                            </div>
                        ) : (
                            activeChallenges.map((challenge: any) => {
                                const progress = getProgress(challenge.id);
                                const progressPercent = progress ? Math.min(100, (progress.currentValue / challenge.goal) * 100) : 0;

                                return (
                                    <div key={challenge.id} className="bg-white rounded-xl border border-zinc-200 p-5 hover:shadow-md transition">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-amber-100 rounded-xl">
                                                <Trophy size={24} className="text-amber-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-zinc-900">{challenge.title}</h3>
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                                                        <Star size={12} /> {challenge.rewardPoints} pts
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-500 mt-1">{challenge.description}</p>

                                                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                                                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}</span>
                                                    <span className="flex items-center gap-1"><Target size={12} /> Goal: {challenge.goal}</span>
                                                </div>

                                                {/* Progress Bar */}
                                                {progress ? (
                                                    <div className="mt-4">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="font-medium text-zinc-700">{progress.currentValue} / {challenge.goal}</span>
                                                            <span className="text-amber-600">{Math.round(progressPercent)}%</span>
                                                        </div>
                                                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all ${progress.completed ? 'bg-green-500' : 'bg-amber-500'}`}
                                                                style={{ width: `${progressPercent}%` }}
                                                            />
                                                        </div>
                                                        {progress.completed && (
                                                            <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><Check size={12} /> Completed!</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Form method="post" className="mt-4">
                                                        <input type="hidden" name="intent" value="join" />
                                                        <input type="hidden" name="challengeId" value={challenge.id} />
                                                        <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                                                            Join Challenge
                                                        </button>
                                                    </Form>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Leaderboard */}
                {tab === 'leaderboard' && (
                    <div className="bg-white rounded-xl border border-zinc-200">
                        <div className="p-4 border-b border-zinc-100">
                            <h2 className="font-bold text-zinc-900 flex items-center gap-2"><Medal size={18} /> Top Challengers</h2>
                        </div>
                        <div className="divide-y divide-zinc-100">
                            {leaderboard.length === 0 ? (
                                <p className="p-8 text-center text-zinc-500">No leaderboard data</p>
                            ) : (
                                leaderboard.slice(0, 10).map((entry: any, i: number) => (
                                    <div key={i} className="p-4 flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-zinc-300 text-zinc-700' : i === 2 ? 'bg-amber-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-zinc-900">{entry.user?.profile?.firstName || entry.user?.email}</div>
                                            <div className="text-xs text-zinc-500">{entry.completedCount} challenges completed</div>
                                        </div>
                                        <div className="text-lg font-bold text-amber-600">{entry.totalPoints} pts</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Past Challenges */}
                {tab === 'past' && (
                    <div className="space-y-4">
                        {pastChallenges.length === 0 ? (
                            <p className="text-center py-12 text-zinc-500">No past challenges</p>
                        ) : (
                            pastChallenges.map((challenge: any) => (
                                <div key={challenge.id} className="bg-white rounded-xl border border-zinc-200 p-4 opacity-75">
                                    <div className="flex items-center gap-3">
                                        <Trophy size={20} className="text-zinc-400" />
                                        <div>
                                            <h3 className="font-medium text-zinc-700">{challenge.title}</h3>
                                            <p className="text-xs text-zinc-500">{formatDate(challenge.endDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
