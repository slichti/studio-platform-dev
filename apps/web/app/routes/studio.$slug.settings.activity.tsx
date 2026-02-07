import { useState, useEffect } from "react";
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Form, useSubmit, useNavigation, useSearchParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { History, User, Filter, X, Search, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "~/components/ui/Badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const searchParams = url.searchParams;

    // Build query string
    const query = new URLSearchParams();
    query.set('limit', '50'); // Default limit
    if (searchParams.get('startDate')) query.set('startDate', searchParams.get('startDate')!);
    if (searchParams.get('endDate')) query.set('endDate', searchParams.get('endDate')!);
    if (searchParams.get('action')) query.set('action', searchParams.get('action')!);
    if (searchParams.get('actorId')) query.set('actorId', searchParams.get('actorId')!);

    const logs = await apiRequest<any[]>(`/tenant/audit-logs?${query.toString()}`, token).catch(() => []);

    return { logs, token };
};

export default function ActivityLog() {
    const { logs } = useLoaderData<typeof loader>();
    const [searchParams] = useSearchParams();
    const submit = useSubmit();
    const navigation = useNavigation();
    const isLoading = navigation.state === "loading";

    // Filter State
    const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
    const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
    const [action, setAction] = useState(searchParams.get("action") || "");
    const [actorId, setActorId] = useState(searchParams.get("actorId") || "");

    // Details View State
    const [selectedLog, setSelectedLog] = useState<any>(null);

    // Debounce submit for text inputs
    useEffect(() => {
        const timer = setTimeout(() => {
            if (actorId !== (searchParams.get("actorId") || "")) {
                handleFilterChange();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [actorId]);

    const handleFilterChange = () => {
        const formData = new FormData();
        if (startDate) formData.set("startDate", startDate);
        if (endDate) formData.set("endDate", endDate);
        if (action) formData.set("action", action);
        if (actorId) formData.set("actorId", actorId);
        submit(formData, { method: "get" });
    };

    const clearFilters = () => {
        setStartDate("");
        setEndDate("");
        setAction("");
        setActorId("");
        submit({}, { method: "get" });
    };

    const getActionColor = (action: string) => {
        if (action.includes("delete") || action.includes("remove")) return "destructive";
        if (action.includes("create") || action.includes("add")) return "success";
        if (action.includes("update") || action.includes("edit")) return "warning";
        return "secondary"; // default/info
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <History className="text-blue-600" />
                    Activity Log
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400">Track important changes and actions within your studio.</p>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:w-auto">
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Date Range</label>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                                <input
                                    type="date"
                                    className="pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        // Specific trigger for date change as standard effect might miss it or feel laggy
                                        const formData = new FormData();
                                        formData.set("startDate", e.target.value);
                                        if (endDate) formData.set("endDate", endDate);
                                        if (action) formData.set("action", action);
                                        if (actorId) formData.set("actorId", actorId);
                                        submit(formData, { method: "get" });
                                    }}
                                />
                            </div>
                            <span className="text-zinc-400">-</span>
                            <div className="relative">
                                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                                <input
                                    type="date"
                                    className="pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        const formData = new FormData();
                                        if (startDate) formData.set("startDate", startDate);
                                        formData.set("endDate", e.target.value);
                                        if (action) formData.set("action", action);
                                        if (actorId) formData.set("actorId", actorId);
                                        submit(formData, { method: "get" });
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-48">
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Action</label>
                        <select
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={action}
                            onChange={(e) => {
                                setAction(e.target.value);
                                const formData = new FormData();
                                if (startDate) formData.set("startDate", startDate);
                                if (endDate) formData.set("endDate", endDate);
                                formData.set("action", e.target.value);
                                if (actorId) formData.set("actorId", actorId);
                                submit(formData, { method: "get" });
                            }}
                        >
                            <option value="">All Actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="login">Login</option>
                            <option value="settings_update">Settings Update</option>
                        </select>
                    </div>

                    <div className="w-full md:w-48">
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">User ID</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search User ID..."
                                className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={actorId}
                                onChange={(e) => setActorId(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={clearFilters}
                        disabled={!startDate && !endDate && !action && !actorId}
                        className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md disabled:opacity-50 transition-colors"
                    >
                        Clear
                    </button>
                    {isLoading && <span className="text-xs text-zinc-400 animate-pulse ml-auto">Loading...</span>}
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Action</th>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Target</th>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">User</th>
                            <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                    No activity recorded matching your filters.
                                </td>
                            </tr>
                        )}
                        {logs.map((log: any) => (
                            <tr
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer group"
                            >
                                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-200">
                                    <Badge variant={getActionColor(log.action)}>
                                        {log.action}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-zinc-900 dark:text-zinc-300 capitalize">{log.targetType || 'System'}</span>
                                        <span className="text-xs font-mono text-zinc-400 truncate max-w-[150px]">{log.targetId}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <User size={12} />
                                        </div>
                                        <span className="font-mono text-xs">{log.actorId ? log.actorId.substring(0, 15) + '...' : "System"}</span>
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

            {/* Details Sheet */}
            <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)} side="right">
                <SheetContent className="w-full sm:max-w-xl">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Activity Details</SheetTitle>
                    </SheetHeader>

                    {selectedLog && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Action</div>
                                    <div className="font-semibold text-lg">{selectedLog.action}</div>
                                </div>
                                <Badge variant={getActionColor(selectedLog.action)} className="text-sm px-3 py-1">
                                    {selectedLog.action}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                    <div className="text-xs font-medium text-zinc-500 uppercase mb-1">Actor</div>
                                    <div className="font-mono text-sm break-all">{selectedLog.actorId || "System"}</div>
                                </div>
                                <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                    <div className="text-xs font-medium text-zinc-500 uppercase mb-1">Date</div>
                                    <div className="text-sm">{format(new Date(selectedLog.createdAt), "PPpp")}</div>
                                </div>
                                <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                    <div className="text-xs font-medium text-zinc-500 uppercase mb-1">Target Type</div>
                                    <div className="text-sm capitalize">{selectedLog.targetType || "N/A"}</div>
                                </div>
                                <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                    <div className="text-xs font-medium text-zinc-500 uppercase mb-1">Target ID</div>
                                    <div className="font-mono text-xs break-all">{selectedLog.targetId || "N/A"}</div>
                                </div>
                            </div>

                            {selectedLog.details && (
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Payload Details</h3>
                                    <div className="bg-zinc-950 text-zinc-50 rounded-lg p-4 font-mono text-xs overflow-auto max-h-[400px] border border-zinc-800 shadow-inner">
                                        <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                                    </div>
                                </div>
                            )}

                            {selectedLog.ipAddress && (
                                <div className="text-xs text-zinc-400 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                                    <span>IP Address:</span>
                                    <span className="font-mono">{selectedLog.ipAddress}</span>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
