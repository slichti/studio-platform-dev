// @ts-ignore
import { useLoaderData, useOutletContext } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken, userId } = await getAuth(args);
    if (!userId) return { substitutions: [], error: "Unauthorized" };

    const token = await getToken();

    try {
        const res: any = await apiRequest("/substitutions", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { substitutions: res.substitutions || [], error: null };
    } catch (e) {
        return { substitutions: [], error: "Failed to load substitutions" };
    }
};

export default function SubstitutionsPage() {
    const { substitutions: initialSubs, error } = useLoaderData<any>();
    const { tenant, me } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const [subs, setSubs] = useState(initialSubs);
    const [loading, setLoading] = useState(false);

    const isOwner = me?.roles?.includes('owner');

    const handleAction = async (id: string, action: string) => {
        if (loading) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/substitutions/${id}/${action}`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            if (res.error) throw new Error(res.error);

            // Refresh
            const refreshed: any = await apiRequest("/substitutions", token, {
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            setSubs(refreshed.substitutions || []);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                        <RefreshCw className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Substitutions</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Manage shift coverage and instructor changes.</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                {/* Pending Requests */}
                <Section title="Needs Coverage" icon={<AlertCircle className="text-amber-500" size={18} />}>
                    <SubList
                        items={subs.filter((s: any) => s.status === 'pending')}
                        onAction={handleAction}
                        canClaim={true}
                        currentMemberId={me?.member?.id}
                        loading={loading}
                    />
                </Section>

                {/* Claimed - Awaiting Approval */}
                <Section title="Awaiting Approval" icon={<Clock className="text-blue-500" size={18} />}>
                    <SubList
                        items={subs.filter((s: any) => s.status === 'claimed')}
                        onAction={handleAction}
                        canApprove={isOwner}
                        loading={loading}
                    />
                </Section>

                {/* Recently Approved */}
                <Section title="Approved Changes" icon={<CheckCircle className="text-green-500" size={18} />}>
                    <SubList
                        items={subs.filter((s: any) => s.status === 'approved')}
                        onAction={handleAction}
                        readOnly={true}
                        loading={loading}
                    />
                </Section>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {icon}
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200">{title}</h3>
                </div>
                <span className="bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                    {Array.isArray(children.props.items) ? children.props.items.length : 0}
                </span>
            </div>
            <div>
                {children}
            </div>
        </div>
    );
}

function SubList({ items, onAction, canClaim, canApprove, readOnly, currentMemberId, loading }: any) {
    if (items.length === 0) {
        return (
            <div className="p-12 text-center">
                <div className="text-zinc-300 dark:text-zinc-700 mb-2 flex justify-center">
                    <Clock size={32} />
                </div>
                <p className="text-zinc-400 text-sm italic">No requests in this category.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((sub: any) => (
                <div key={sub.id} className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{sub.class?.title}</div>
                            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-mono">
                                {sub.class?.id.substring(0, 8)}
                            </span>
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(sub.class?.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
                            <div className="flex flex-col">
                                <span className="text-zinc-400 mb-1">Scheduled Instructor</span>
                                <span className="text-zinc-800 dark:text-zinc-200">{sub.requestingInstructor?.user?.profile?.firstName} {sub.requestingInstructor?.user?.profile?.lastName}</span>
                            </div>
                            {sub.coveringInstructor && (
                                <div className="flex flex-col">
                                    <span className="text-blue-500 mb-1">Assigned Substitute</span>
                                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                        {sub.coveringInstructor?.user?.profile?.firstName} {sub.coveringInstructor?.user?.profile?.lastName}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            {canClaim && sub.requestingInstructorId !== currentMemberId && sub.status === 'pending' && (
                                <button
                                    onClick={() => onAction(sub.id, 'claim')}
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                                >
                                    Claim Shift
                                </button>
                            )}
                            {canApprove && sub.status === 'claimed' && (
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => onAction(sub.id, 'approve')}
                                        disabled={loading}
                                        className="flex-1 md:flex-none bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 hover:bg-green-700 disabled:opacity-50 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={18} /> Approve
                                    </button>
                                    <button
                                        onClick={() => onAction(sub.id, 'decline')}
                                        disabled={loading}
                                        className="flex-1 md:flex-none bg-white dark:bg-zinc-800 border border-red-100 dark:border-red-900/30 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={18} /> Decline
                                    </button>
                                </div>
                            )}

                            {sub.requestingInstructorId === currentMemberId && sub.status === 'pending' && (
                                <button
                                    onClick={() => onAction(sub.id, 'decline')}
                                    disabled={loading}
                                    className="text-zinc-400 hover:text-red-500 text-xs font-bold uppercase transition-colors"
                                >
                                    Cancel Request
                                </button>
                            )}
                        </div>
                    )}

                    {sub.status === 'approved' && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl border border-green-100 dark:border-green-900/30">
                            <CheckCircle size={20} />
                            <span className="text-sm font-bold">Approved</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
