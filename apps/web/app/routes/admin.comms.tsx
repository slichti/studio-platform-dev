
import { useLoaderData, Link, useSearchParams, isRouteErrorResponse, useRouteError } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Mail, MessageSquare, AlertTriangle } from "lucide-react";

interface LogEntry {
    id: string;
    sentAt: string; // ISO string
    tenantName?: string;
    // Email specific
    subject?: string;
    recipientEmail?: string;
    // SMS specific
    body?: string;
    recipientPhone?: string;
    status?: string;
}

interface TenantVolume {
    tenantName: string;
    slug: string;
    count: number;
}

interface CommsStats {
    totalSent: number;
    byTenant: TenantVolume[];
    recentLogs: LogEntry[];
}

interface LoaderData {
    emailStats: CommsStats;
    smsStats: CommsStats;
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    let emailStats: CommsStats = { totalSent: 0, byTenant: [], recentLogs: [] };
    let smsStats: CommsStats = { totalSent: 0, byTenant: [], recentLogs: [] };

    try {
        const [emailRes, smsRes] = await Promise.all([
            apiRequest<CommsStats>("/admin-api/stats/email", token),
            apiRequest<CommsStats>("/admin-api/stats/sms", token)
        ]);

        if (emailRes && !(emailRes as any).error) emailStats = emailRes;
        if (smsRes && !(smsRes as any).error) smsStats = smsRes;
    } catch (e) {
        console.error("Failed to load comms stats", e);
    }

    return { emailStats, smsStats };
};

export default function AdminCommsPage() {
    const { emailStats, smsStats } = useLoaderData<LoaderData>();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "email";

    const setTab = (tab: string) => {
        setSearchParams({ tab });
    };

    const stats = activeTab === 'email' ? emailStats : smsStats;
    const isEmail = activeTab === 'email';

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 mb-2">Communications</h1>
                    <p className="text-zinc-500">Track system-wide Email and SMS volume.</p>
                </div>
                <div className="flex gap-2 bg-zinc-100 p-1 rounded-lg">
                    <button
                        onClick={() => setTab("email")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all",
                            isEmail ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                        </div>
                    </button>
                    <button
                        onClick={() => setTab("sms")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all",
                            !isEmail ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            SMS
                        </div>
                    </button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm flex items-center gap-4">
                    <div className={cn("p-3 rounded-full", isEmail ? "bg-blue-100" : "bg-green-100")}>
                        {isEmail ? <Mail className="h-6 w-6 text-blue-600" /> : <MessageSquare className="h-6 w-6 text-green-600" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">Total {isEmail ? "Emails" : "SMS"} Sent</p>
                        <p className="text-3xl font-bold text-zinc-900">{stats.totalSent.toLocaleString()}</p>
                    </div>
                </div>
                {/* Additional KPI cards could go here */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Volume by Tenant */}
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                    <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200">
                        <h3 className="font-semibold text-zinc-800">Volume by Tenant</h3>
                    </div>
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead>
                            <tr className="bg-zinc-50">
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Count</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {stats.byTenant.map((t, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-3 text-sm font-medium text-zinc-900">
                                        <Link to={`/admin/tenants`} className="hover:underline">{t.tenantName}</Link>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-right text-zinc-600 font-mono">
                                        {t.count.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {stats.byTenant.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-6 py-8 text-center text-zinc-500">No data available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Recent Logs */}
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden h-fit">
                    <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200">
                        <h3 className="font-semibold text-zinc-800">Recent Logs</h3>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-zinc-200">
                            <thead>
                                <tr className="bg-zinc-50">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Sent At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">{isEmail ? "Subject" : "Body"}</th>
                                    {!isEmail && <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                                {stats.recentLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">
                                            {new Date(log.sentAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-medium text-zinc-900">
                                            {log.tenantName || 'Unknown'}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-zinc-600 truncate max-w-[200px]" title={isEmail ? log.subject : log.body}>
                                            {isEmail ? log.subject : log.body}
                                        </td>
                                        {!isEmail && (
                                            <td className="px-4 py-2 text-xs">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full capitalize",
                                                    log.status === 'sent' ? "bg-green-100 text-green-700" :
                                                        log.status === 'failed' ? "bg-red-100 text-red-700" :
                                                            "bg-gray-100 text-gray-700"
                                                )}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {stats.recentLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={isEmail ? 3 : 4} className="px-6 py-8 text-center text-zinc-500">No recent logs</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-600 p-4">
            <AlertTriangle size={48} className="mb-4" />
            <h1 className="text-xl font-bold mb-2">Failed to load Communications Dashboard</h1>
            <p className="text-sm text-zinc-600 mb-4">
                {isRouteErrorResponse(error)
                    ? `${error.status} ${error.statusText}`
                    : error instanceof Error
                        ? error.message
                        : "Unknown Error"}
            </p>
            <Link to="/admin" className="text-blue-600 hover:underline">Return to Admin Dashboard</Link>
        </div>
    );
}
