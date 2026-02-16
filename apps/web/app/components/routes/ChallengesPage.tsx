
import { useLoaderData, useSubmit, Form, useActionData, useOutletContext } from "react-router";
import { useState, useEffect } from "react";
import { Trophy, Target, Calendar, Plus, Star, Medal, Flame, Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { type loader, type action } from "../../routes/studio.$slug.challenges";

export default function ChallengesPage() {
    const { challenges, myProgress, leaderboard } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const submit = useSubmit();
    const [isCreating, setIsCreating] = useState(false);
    const [tab, setTab] = useState<'active' | 'leaderboard' | 'past'>('active');
    const [challengeType, setChallengeType] = useState('count');
    const [rewardType, setRewardType] = useState('badge');

    const { me, isStudentView } = useOutletContext<{ me: any; tenant: any; isStudentView: boolean }>() || {};
    const isManager = (me?.roles?.includes('owner') || me?.roles?.includes('admin') || me?.roles?.includes('instructor')) && !isStudentView;

    const activeChallenges = challenges.filter((c: any) => c.status === 'active');
    const pastChallenges = challenges.filter((c: any) => c.status !== 'active');

    const getProgress = (challengeId: string) => {
        return myProgress.find((p: any) => p.challengeId === challengeId);
    };

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    useEffect(() => {
        if (actionData && (actionData as any).created) {
            setIsCreating(false);
            toast.success("Challenge created!");
        }
        if (actionData && (actionData as any).error) {
            toast.error((actionData as any).error);
        }
    }, [actionData]);

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
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

                    {isManager && (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                        >
                            <Plus size={18} />
                            Create Challenge
                        </button>
                    )}
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
                            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                                <Target size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No active challenges</p>
                                {isManager && (
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
                                    >
                                        Create one now
                                    </button>
                                )}
                            </div>
                        ) : (
                            activeChallenges.map((challenge: any) => {
                                const progress = getProgress(challenge.id);
                                const progressPercent = progress ? Math.min(100, (progress.currentValue / challenge.goal) * 100) : 0;

                                return (
                                    <div key={challenge.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:shadow-md transition">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                                                <Trophy size={24} className="text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{challenge.title}</h3>
                                                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium flex items-center gap-1">
                                                        <Star size={12} /> {challenge.rewardType === 'badge' ? 'Badge' : challenge.rewardType === 'coupon' ? 'Coupon' : 'Credit'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{challenge.description}</p>

                                                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                                                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}</span>
                                                    <span className="flex items-center gap-1"><Target size={12} /> Goal: {challenge.goal}</span>
                                                </div>

                                                {/* Progress Bar */}
                                                {progress ? (
                                                    <div className="mt-4">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{progress.currentValue} / {challenge.goal}</span>
                                                            <span className="text-amber-600">{Math.round(progressPercent)}%</span>
                                                        </div>
                                                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
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
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                            <h2 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Medal size={18} /> Top Challengers</h2>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {leaderboard.length === 0 ? (
                                <p className="p-8 text-center text-zinc-500 dark:text-zinc-400">No leaderboard data</p>
                            ) : (
                                leaderboard.slice(0, 10).map((entry: any, i: number) => (
                                    <div key={i} className="p-4 flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-zinc-300 text-zinc-700' : i === 2 ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{entry.user?.profile?.firstName || entry.user?.email}</div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{entry.completedCount} challenges completed</div>
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
                            <p className="text-center py-12 text-zinc-500 dark:text-zinc-400">No past challenges</p>
                        ) : (
                            pastChallenges.map((challenge: any) => (
                                <div key={challenge.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 opacity-75">
                                    <div className="flex items-center gap-3">
                                        <Trophy size={20} className="text-zinc-400" />
                                        <div>
                                            <h3 className="font-medium text-zinc-700 dark:text-zinc-300">{challenge.title}</h3>
                                            <p className="text-xs text-zinc-500">{formatDate(challenge.endDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Create Challenge Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-900">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Create Challenge</h2>
                            <button onClick={() => setIsCreating(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <X size={24} />
                            </button>
                        </div>

                        <Form method="post" className="p-6 space-y-5">
                            <input type="hidden" name="intent" value="create" />

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Challenge Title</label>
                                <input
                                    name="title"
                                    required
                                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="e.g. Summer Fitness Challenge"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Description</label>
                                <textarea
                                    name="description"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                                    placeholder="Describe what members need to do..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Goal Type</label>
                                    <select
                                        name="type"
                                        value={challengeType}
                                        onChange={(e) => setChallengeType(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                                    >
                                        <option value="count">Total Classes</option>
                                        <option value="minutes">Total Minutes</option>
                                        <option value="streak">Attendance Streak</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
                                        {challengeType === 'streak' ? 'Streak Days' : 'Target Value'}
                                    </label>
                                    <input
                                        name="targetValue"
                                        type="number"
                                        defaultValue="10"
                                        min="1"
                                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                                    />
                                </div>
                            </div>

                            {challengeType === 'streak' && (
                                <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Classes per</label>
                                        <input name="frequency" type="number" defaultValue="3" min="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Period</label>
                                        <select name="period" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
                                            <option value="week">Week</option>
                                            <option value="month">Month</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Reward Type</label>
                                    <select
                                        name="rewardType"
                                        value={rewardType}
                                        onChange={(e) => setRewardType(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                                    >
                                        <option value="badge">Digital Badge</option>
                                        <option value="coupon">Discount Coupon</option>
                                        <option value="retail_credit">Retail Credit</option>
                                    </select>
                                </div>
                            </div>

                            {rewardType === 'retail_credit' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Credit Amount ($)</label>
                                    <input name="creditAmount" type="number" min="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" placeholder="e.g. 25" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Start Date</label>
                                    <input name="startDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">End Date</label>
                                    <input name="endDate" type="date" required className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg font-medium">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium flex items-center gap-2">
                                    <Plus size={16} />
                                    Create Challenge
                                </button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}
        </div>
    );
}
