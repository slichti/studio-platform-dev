import { useState, useEffect } from 'react';

import { useFetcher } from 'react-router';
import { apiRequest } from '~/utils/api';
import { User, Calendar, Baby } from 'lucide-react';

type FamilyMember = {
    userId: string;
    memberId: string | null;
    firstName: string;
    lastName: string;
    dob: string | null;
};

export function FamilyManager({ token }: { token: string | null }) {
    const fetcher = useFetcher();
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        if (!token) return;
        apiRequest('/users/me/family', token)
            .then(data => {
                if (data.family) setFamily(data.family);
            })
            .catch(err => {
                console.error("Failed to load family", err);
                setError("Failed to load family members");
            });
    }, [token]);

    // Handle Add Response
    useEffect(() => {
        if (fetcher.data?.success && fetcher.data?.child) {
            setFamily(prev => [...prev, fetcher.data.child]);
            setIsAdding(false);
        }
    }, [fetcher.data]);


    // Session State
    const [session, setSession] = useState<{ isImpersonating: boolean, impersonatorId?: string } | null>(null);

    useEffect(() => {
        if (!token) return;
        apiRequest('/users/session-info', token).then(setSession).catch(console.error);
    }, [token]);

    // Switch Profile Logic
    const switchProfile = async (targetUserId: string) => {
        try {
            const res = await apiRequest('/users/me/switch-profile', token, {
                method: 'POST',
                body: JSON.stringify({ targetUserId })
            });

            if (res.token) {
                // Set Impersonation Cookie & Storage
                document.cookie = `__impersonate_token=${res.token}; path=/; SameSite=Lax`;
                localStorage.setItem("impersonation_token", res.token);
                window.location.reload();
            } else if (res.isSelf) {
                // Clear Impersonation
                document.cookie = `__impersonate_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                localStorage.removeItem("impersonation_token");
                window.location.reload();
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to switch profile");
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Family Members</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage household accounts and dependents.</p>
                </div>
                <div className="flex gap-2">
                    {session?.isImpersonating && session.impersonatorId && (
                        <button
                            onClick={() => switchProfile(session.impersonatorId!)}
                            className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-800"
                        >
                            Back to Parent
                        </button>
                    )}
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                        {isAdding ? 'Cancel' : '+ Add Child'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            {isAdding && (
                <fetcher.Form method="post" className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2">
                    <input type="hidden" name="intent" value="add_child" />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">First Name</label>
                            <input
                                name="firstName"
                                required
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. Leo"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Last Name</label>
                            <input
                                name="lastName"
                                required
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. Smith"
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Date of Birth</label>
                        <input
                            name="dob"
                            type="date"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={fetcher.state === 'submitting'}
                            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {fetcher.state === 'submitting' ? 'Adding Profile...' : 'Create Child Profile'}
                        </button>
                    </div>
                </fetcher.Form>
            )}

            <div className="space-y-3">
                {family.length === 0 && !isAdding && (
                    <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                        <UsersIcon className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">No family members linked yet.</p>
                    </div>
                )}
                {family.map(member => (
                    <div key={member.userId} className="flex items-center justify-between p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shadow-sm ring-1 ring-white dark:ring-zinc-800">
                                {member.firstName[0]}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{member.firstName} {member.lastName}</p>
                                    {member.memberId && (
                                        <span className="text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                                            Member
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                    {member.dob && (
                                        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            <Baby size={12} />
                                            <span>{new Date(member.dob).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => switchProfile(member.userId)}
                            className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 text-xs font-medium rounded-md hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                        >
                            Switch Profile
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
