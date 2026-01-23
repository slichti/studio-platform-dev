// @ts-ignore
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Activity, Download, Shield } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const logs = await apiRequest("/admin/logs", token);
        return { logs, error: null };
    } catch (e: any) {
        return { logs: [], error: e.message };
    }
};

export default function AdminLogs() {
    const { logs } = useLoaderData<any>();
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    const handleExport = () => {
        const headers = ['Timestamp', 'Action', 'Actor Email', 'Actor Name', 'Target ID', 'Details'];
        const rows = (logs || []).map((log: any) => [
            new Date(log.createdAt).toISOString(),
            log.action,
            log.actorEmail || '',
            `${(log.actorProfile as any)?.firstName || ''} ${(log.actorProfile as any)?.lastName || ''}`.trim() || 'System',
            log.targetId || '',
            JSON.stringify(log.details || {}).replace(/,/g, ';') // Escape commas
        ]);
        const csv = [headers, ...rows].map((r: string[]) => r.map((c: string) => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getActionBadge = (action: string) => {
        if (action === 'tenant.created') return <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-2 py-0.5 rounded text-xs font-bold uppercase">New Studio</span>;
        if (action.includes('admin')) return <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-bold uppercase">Admin</span>;
        if (action === 'USER_LOGIN') return <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold uppercase">Login</span>;
        if (action === 'USER_LOGOUT') return <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-bold uppercase">Logout</span>;
        if (action.includes('IMPERSONATION')) return <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-xs font-bold uppercase">Impersonation</span>;
        return <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-bold uppercase">{action.replace(/_/g, ' ')}</span>;
    };

    const getDetailsSummary = (log: any) => {
        if (log.action === 'tenant.created' && log.details) {
            return (
                <span className="text-zinc-600 dark:text-zinc-300">
                    Created <strong>{log.details.name}</strong> ({log.details.slug})
                    <span className="mx-1 text-zinc-400">•</span>
                    Tier: {log.details.tier}
                </span>
            );
        }
        if (log.details?.message) {
            return <span className="text-zinc-600 dark:text-zinc-300">{log.details.message}</span>;
        }
        return <span className="text-zinc-400 italic">View details...</span>;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Activity Logs
                    </h2>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs font-medium flex items-center gap-1">
                        <Shield size={12} />
                        SOC 2 Compliant
                    </span>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    <Download size={16} />
                    Export CSV
                </button>
            </div>



            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="w-8"></th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Time</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actor</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Summary</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {logs.map((log: any) => (
                            <>
                                <tr
                                    key={log.id}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                >
                                    <td className="pl-4">
                                        {expandedLog === log.id ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                                        {format(new Date(log.createdAt), "MMM d, h:mm a")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getActionBadge(log.action)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                {(log.actorProfile as any)?.firstName} {(log.actorProfile as any)?.lastName || 'System'}
                                            </span>
                                            <span className="text-xs text-zinc-400">{log.actorEmail}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {getDetailsSummary(log)}
                                    </td>
                                </tr>
                                {expandedLog === log.id && (
                                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                                        <td colSpan={5} className="px-6 pb-6 pt-2">
                                            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-4 text-xs font-mono overflow-auto max-h-64 dark:text-zinc-300">
                                                <div className="mb-2 text-zinc-500 dark:text-zinc-400 font-sans font-bold uppercase tracking-wider">Raw Details</div>
                                                <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-4 text-zinc-400">
                                                    <span>Target ID: {log.targetId || 'N/A'}</span>
                                                    <span>Actor ID: {log.actorId}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && (
                    <div className="p-8 text-center text-zinc-500">No activity logs found.</div>
                )}
            </div>
        </div >
    );
}
