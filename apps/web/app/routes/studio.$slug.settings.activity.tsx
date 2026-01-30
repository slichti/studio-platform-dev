import { useState } from "react";
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { History, User } from "lucide-react";
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    // Initial fetch, default limit 50
    const logs = await apiRequest<any[]>("/audit-logs?limit=50", token).catch(() => []);

    return { logs, token };
};

export default function ActivityLog() {
    const { logs: initialLogs } = useLoaderData<typeof loader>();
    const [logs] = useState(initialLogs || []);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <History className="text-blue-600" />
                    Activity Log
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400">Track important changes and actions within your studio.</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Action</th>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">User</th>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Details</th>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                    No activity recorded yet.
                                </td>
                            </tr>
                        )}
                        {logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-200">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                                    <User size={14} />
                                    {log.actorId || "System"}
                                </td>
                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                                    <div className="max-w-xs truncate" title={JSON.stringify(log.details)}>
                                        {log.details ? JSON.stringify(log.details) : "-"}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                    {format(new Date(log.createdAt), "MMM d, h:mm a")}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
