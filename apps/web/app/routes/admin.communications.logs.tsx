
import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { RefreshCw, Search, Send, CheckCircle, XCircle, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const loader = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    if (!userId) return { logs: [], pagination: {}, error: "Unauthorized" };

    const token = await getToken();
    const url = new URL(args.request.url);

    const params = new URLSearchParams(url.search);
    if (!params.get('page')) params.set('page', '1');
    if (!params.get('limit')) params.set('limit', '50');

    try {
        const data: any = await apiRequest(`/admin/communications/logs?${params.toString()}`, token);
        return {
            logs: data.logs || [],
            pagination: data.pagination || { page: 1, pages: 1 },
            params: Object.fromEntries(params),
            error: null
        };
    } catch (e: any) {
        return { logs: [], pagination: { page: 1, pages: 1 }, params: {}, error: e.message };
    }
};

export default function EmailLogs() {
    const { logs, pagination, params, error } = useLoaderData<any>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [resendingId, setResendingId] = useState<string | null>(null);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const search = formData.get('search') as string;
        setSearchParams(prev => {
            prev.set('search', search);
            prev.set('page', '1');
            return prev;
        });
    };

    const handleFilterChange = (key: string, value: string) => {
        setSearchParams(prev => {
            if (value === 'all') prev.delete(key);
            else prev.set(key, value);
            prev.set('page', '1');
            return prev;
        });
    };

    const handleResend = async (id: string) => {
        setResendingId(id);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/admin/communications/resend/${id}`, token, { method: 'POST' });
            toast.success("Email resent successfully");
        } catch (e: any) {
            toast.error("Failed to resend: " + e.message);
        } finally {
            setResendingId(null);
        }
    };

    const StatusBadge = ({ status, errorMsg }: { status: string, errorMsg?: string }) => {
        if (status === 'sent') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    <CheckCircle className="w-3 h-3" /> Sent
                </span>
            );
        }
        if (status === 'failed') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" title={errorMsg}>
                    <XCircle className="w-3 h-3" /> Failed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Mail className="text-blue-600" />
                        Email Logs
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Monitor and manage platform communication logs.</p>
                </div>
                <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-medium transition"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                {/* Filters */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 justify-between">
                    <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                        <input
                            name="search"
                            placeholder="Search subject or recipient..."
                            defaultValue={params.search}
                            className="flex-1 sm:w-[300px] px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                        <button type="submit" className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition">
                            <Search className="w-4 h-4" />
                        </button>
                    </form>
                    <div className="flex gap-2">
                        <select
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            defaultValue={params.status || 'all'}
                            className="h-9 px-3 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="sent">Sent</option>
                            <option value="failed">Failed</option>
                        </select>
                        <select
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            defaultValue={params.type || 'all'}
                            className="h-9 px-3 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="transactional">Transactional</option>
                            <option value="campaign">Marketing</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400">Sent At</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400">Recipient</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400">Subject</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400">Type</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400">Tenant</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400">Status</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                                        No logs found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                        <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                            {format(new Date(log.sentAt), "MMM d, HH:mm:ss")}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{log.recipient}</td>
                                        <td className="px-4 py-3 max-w-[300px] truncate text-zinc-700 dark:text-zinc-300" title={log.subject}>
                                            {log.subject}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono">
                                                {log.templateId || (log.campaignId ? 'Campaign' : 'Generic')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{log.tenantName || '-'}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={log.status} errorMsg={log.error} />
                                            {log.error && <div className="text-xs text-red-500 mt-1 truncate max-w-[200px]" title={log.error}>{log.error}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition"
                                                onClick={() => handleResend(log.id)}
                                                disabled={resendingId === log.id}
                                                title="Resend Email"
                                            >
                                                <Send className={`w-4 h-4 ${resendingId === log.id ? 'animate-pulse' : ''}`} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-4">
                    <button
                        className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
                        onClick={() => setSearchParams(prev => { prev.set('page', (pagination.page - 1).toString()); return prev; })}
                        disabled={pagination.page <= 1}
                    >
                        Previous
                    </button>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Page {pagination.page} of {pagination.pages || 1}
                    </span>
                    <button
                        className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
                        onClick={() => setSearchParams(prev => { prev.set('page', (pagination.page + 1).toString()); return prev; })}
                        disabled={pagination.page >= pagination.pages}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
