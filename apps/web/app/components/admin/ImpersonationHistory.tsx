import { useState, useEffect } from "react";
import { Users, History, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "../../utils/api";

interface ImpersonationEvent {
    id: string;
    action: 'impersonate_user' | 'impersonate_tenant';
    actorId: string;
    targetId: string;
    details: {
        targetEmail?: string;
        tenantName?: string;
        ownerEmail?: string;
        ownerId?: string;
    };
    createdAt: string;
    actorEmail: string;
}

export function ImpersonationHistory({ token }: { token: string }) {
    const [history, setHistory] = useState<ImpersonationEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await apiRequest<ImpersonationEvent[]>("/admin/impersonation/history", token);
            setHistory(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [token]);

    const handleQuickImpersonate = async (event: ImpersonationEvent) => {
        try {
            let res;
            if (event.action === 'impersonate_user') {
                res = await apiRequest("/admin/impersonate", token, {
                    method: "POST",
                    body: JSON.stringify({ targetUserId: event.targetId })
                });
            } else {
                res = await apiRequest(`/admin/tenants/${event.targetId}/impersonate`, token, {
                    method: "POST"
                });
            }

            if (res.token) {
                localStorage.setItem("impersonation_token", res.token);
                document.cookie = `__impersonate_token=${res.token}; path=/; SameSite=Lax`;
                window.location.href = "/dashboard";
            }
        } catch (err: any) {
            alert("Failed to impersonate: " + err.message);
        }
    };

    if (loading && history.length === 0) return <div className="p-4 flex justify-center"><RefreshCw className="animate-spin text-zinc-400" /></div>;
    if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 font-medium">
                    <History size={18} className="text-zinc-500" />
                    <span>Recent Impersonations</span>
                </div>
                <button onClick={fetchHistory} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {history.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                    No recent impersonation activity.
                </div>
            ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                    {history.map((event) => (
                        <div key={event.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-full ${event.action === 'impersonate_user' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'} dark:bg-zinc-700`}>
                                        <Users size={14} />
                                    </div>
                                    <span className="text-sm font-medium">
                                        {event.action === 'impersonate_user' ? 'User:' : 'Tenant:'} {event.details.targetEmail || event.details.tenantName || 'Unknown'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                                </span>
                            </div>

                            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-1 font-mono">
                                <span>{event.actorEmail}</span>
                                <ArrowRight size={10} />
                                <span>{event.details.targetEmail || event.details.ownerEmail || 'Context'}</span>
                            </div>

                            <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleQuickImpersonate(event)}
                                    className="text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    <span>Repeat</span>
                                </button>
                                {event.details.ownerId && (
                                    <Link
                                        to={`/admin/users/${event.details.ownerId}`}
                                        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-1 flex items-center gap-1"
                                    >
                                        <ExternalLink size={12} />
                                        <span>View Details</span>
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
