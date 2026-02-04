

import { useLoaderData, useActionData, Form, useNavigation, useSubmit, redirect, useOutletContext } from "react-router";

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { apiRequest } from "~/utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Award, Plus, Trash2, Calendar, Target, Gift } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const challenges = await apiRequest('/challenges/my-progress', token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return {
            challenges: Array.isArray(challenges) ? challenges : [],
            isOwnerOrAdmin: false, // Default, will override in component via Context or check Me here
            error: null
        };
    } catch (e) {
        return { challenges: [], isOwnerOrAdmin: false, error: "Failed to load challenges" };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = params;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "join") {
        const challengeId = formData.get("challengeId");
        try {
            await apiRequest(`/challenges/${challengeId}/join`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message || "Failed to join challenge" };
        }
    }

    if (intent === "create") {
        const rewardType = formData.get("rewardType");
        let rewardValue = {};

        if (rewardType === 'retail_credit') {
            rewardValue = { creditAmount: formData.get("creditAmount") };
        } else if (formData.get("rewardValue")) {
            try {
                rewardValue = JSON.parse(formData.get("rewardValue") as string);
            } catch (e) { }
        }

        const data = {
            title: formData.get("title"),
            description: formData.get("description"),
            type: formData.get("type"),
            targetValue: parseInt(formData.get("targetValue") as string || "0"),
            frequency: parseInt(formData.get("frequency") as string || "1"),
            period: formData.get("period"),
            rewardType,
            rewardValue,
            startDate: formData.get("startDate"),
            endDate: formData.get("endDate")
        };

        try {
            await apiRequest('/challenges', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message || "Failed to create" };
        }
    }

    return null;
};

export default function LoyaltyPage() {

    const { challenges, error } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        if (actionData && (actionData as any).success) {
            setIsCreateModalOpen(false);

            if (typeof toast !== 'undefined') toast.success("Success!");
        }
    }, [actionData]);


    const { me } = useOutletContext<{ me: any, tenant: any }>();
    const isManager = me?.roles?.includes('owner') || me?.roles?.includes('admin') || me?.roles?.includes('instructor');

    return (
        <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Award className="text-yellow-500" />
                        Loyalty Challenges
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Gamify attendance with challenges and rewards.
                    </p>
                </div>
                {isManager && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm"
                    >
                        <Plus size={16} />
                        Create Challenge
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
                    {error}
                </div>
            )}

            {actionData && (actionData as any).error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
                    {(actionData as any).error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {challenges.map((challenge: any) => {
                    // userProgress logic
                    const progress = challenge.userProgress || {};
                    const isJoined = !!progress.id;
                    const isCompleted = progress.status === 'completed' || (progress.progress >= challenge.targetValue);
                    const percentage = Math.min(100, Math.round((progress.progress / challenge.targetValue) * 100));

                    return (
                        <div key={challenge.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg text-yellow-600 dark:text-yellow-400">
                                    <Target size={24} />
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${challenge.active ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-zinc-100 text-zinc-500'}`}>
                                    {challenge.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{challenge.title}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2 min-h-[40px] flex-1">{challenge.description}</p>

                            {!isJoined && challenge.active && (
                                <Form method="post" className="mb-4">
                                    <input type="hidden" name="intent" value="join" />
                                    <input type="hidden" name="challengeId" value={challenge.id} />
                                    <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm">
                                        Join Challenge
                                    </button>
                                </Form>
                            )}

                            {isJoined && (
                                <div className="mb-4 space-y-2">
                                    <div className="flex justify-between text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                                        <span>Progress</span>
                                        <span>{progress.progress} / {challenge.targetValue}</span>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }} />
                                    </div>
                                    {isCompleted && (
                                        <div className="text-center mt-2">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">
                                                <Award size={12} />
                                                Challenge Completed!
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 mt-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Target size={14} className="text-zinc-400" />
                                        <span>Goal</span>
                                    </div>
                                    <span className="font-medium">{challenge.targetValue} {challenge.type === 'count' ? 'Classes' : challenge.type === 'minutes' ? 'Min' : 'Days'}</span>
                                </div>

                                {challenge.endDate && (
                                    <div className="flex items-center justify-between text-xs text-zinc-500">
                                        <span>Ends</span>
                                        <span>{new Date(challenge.endDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}

                {challenges.length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                            <Award size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No active challenges</h3>
                        <p className="text-zinc-500 max-w-sm mx-auto mt-2 text-sm">Check back later for new challenges!</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">New Challenge</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                                <Trash2 size={20} className="rotate-45" />
                            </button>
                        </div>
                        <Form method="post" className="p-6 space-y-4">
                            <input type="hidden" name="intent" value="create" />

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Title</label>
                                <input name="title" required className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="e.g. Summer Warrior" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Description</label>
                                <textarea name="description" rows={3} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none" placeholder="Attend 10 classes in June..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Goal Type</label>
                                    <div className="relative">
                                        <select
                                            name="type"
                                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const targetInput = document.getElementById('targetValue-group');
                                                const streakInput = document.getElementById('streak-group');
                                                if (val === 'streak') {
                                                    if (targetInput) targetInput.style.display = 'none';
                                                    if (streakInput) streakInput.style.display = 'grid';
                                                } else {
                                                    if (targetInput) targetInput.style.display = 'block';
                                                    if (streakInput) streakInput.style.display = 'none';
                                                }
                                            }}
                                        >
                                            <option value="count">Total Classes</option>
                                            <option value="minutes">Total Minutes</option>
                                            <option value="streak">Streak</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                            <Target size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div id="targetValue-group">
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Target Value</label>
                                    <input name="targetValue" type="number" defaultValue="10" min="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                                </div>
                            </div>

                            {/* Streak Options (Hidden by default unless Streak selected - simpler to just show all for now or use React state but I am editing static TSX mostly. Actually, I can use a simple script or just assume React re-renders if I converted to controlled. Since I am replacing the block, I'll use controlled state for Type if possible, but I don't want to rewrite the whole component state. I'll rely on server handling or just show them all.) 
                            Let's use a cleaner approach: plain fields, but clearer labels. */}

                            <div id="streak-group" className="hidden grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <div className="col-span-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Streak Settings</div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Frequency</label>
                                    <input name="frequency" type="number" defaultValue="3" min="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" />
                                    <p className="text-xs text-zinc-500 mt-1">Times per period</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Period</label>
                                    <select name="period" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
                                        <option value="week">Weekly</option>
                                        <option value="month">Monthly</option>
                                    </select>
                                </div>
                            </div>

                            {/* JS to toggle visibility - simple hack since I can't easily add state without replacing the whole file function body */}
                            <script dangerouslySetInnerHTML={{
                                __html: `
                                document.querySelector('select[name="type"]').addEventListener('change', function(e) {
                                    const val = e.target.value;
                                    const streakGroup = document.getElementById('streak-group');
                                    const targetGroup = document.getElementById('targetValue-group');
                                    if(val === 'streak') {
                                        streakGroup.classList.remove('hidden');
                                        streakGroup.classList.add('grid');
                                        targetGroup.classList.add('hidden');
                                    } else {
                                        streakGroup.classList.add('hidden');
                                        streakGroup.classList.remove('grid');
                                        targetGroup.classList.remove('hidden');
                                    }
                                });
                             `}} />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Reward Type</label>
                                    <div className="relative">
                                        <select
                                            name="rewardType"
                                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const creditInput = document.getElementById('credit-input');
                                                if (val === 'retail_credit' && creditInput) creditInput.classList.remove('hidden');
                                                else if (creditInput) creditInput.classList.add('hidden');
                                            }}
                                        >
                                            <option value="badge">Digital Badge</option>
                                            <option value="coupon">Discount Coupon</option>
                                            <option value="retail_credit">Retail Credit</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                            <Gift size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">End Date</label>
                                    <input name="endDate" type="date" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                                </div>
                            </div>

                            <div id="credit-input" className="hidden">
                                <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Credit Amount ($)</label>
                                <input name="creditAmount" type="number" min="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" placeholder="e.g. 50" />
                            </div>

                            <div className="pt-6 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 mt-2">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium text-sm">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm shadow-blue-200 dark:shadow-none">Create Challenge</button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}
        </div>
    );
}
