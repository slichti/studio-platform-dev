// @ts-ignore
import { type LoaderFunctionArgs, useLoaderData, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Table, TableHeader, TableHead, TableRow, TableCell } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";

export const loader = async (args: LoaderFunctionArgs) => {
    let token;
    try {
        const { getToken } = await getAuth(args);
        token = await getToken();
    } catch (authErr: any) {
        // If auth system fails entirely, maybe redirect or log
        console.error("Auth System Error", JSON.stringify(authErr, Object.getOwnPropertyNames(authErr)));
        return redirect('/sign-in');
    }

    if (!token) {
        return redirect('/sign-in?redirect_url=/admin');
    }

    try {
        const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
        const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

        const [logs, health] = await Promise.all([
            apiRequest("/admin/logs", token, {}, apiUrl),
            apiRequest("/admin/stats/health", token, {}, apiUrl).catch((e) => {
                console.error("Health Check Failed:", e);
                return { status: 'error', error: e.message || "Fetch Failed" };
            })
        ]);
        return { logs, health };
    } catch (e: any) {
        const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
        const apiUrl = env.VITE_API_URL || "UNKNOWN";
        const message = e.message || "Unknown Error";

        // Handle 403 Forbidden specifically (Not an Admin)
        if (e.status === 403 || message.includes("Forbidden")) {
            throw new Response("Access Denied: You do not have permission to view the Admin Dashboard.", { status: 403 });
        }

        // Handle 401 Unauthorized (Token expired/invalid during fetch)
        if (e.status === 401 || message.includes("Unauthorized")) {
            return redirect('/sign-in?redirect_url=/admin');
        }

        console.error("Admin Dashboard Loader Error:", e);
        // Return empty state or rethrow for custom error boundary?
        // Throwing 500 is fine if it's a real system error, but let's be descriptive.
        throw new Response(`Admin Dashboard Error: ${message}`, { status: 500 });
    }
};

function StatCard({ title, value, status, trend }: { title: string, value: string, status?: "success" | "warning" | "error" | "neutral", trend?: string }) {
    const statusColors = {
        success: "text-emerald-600",
        warning: "text-amber-600",
        error: "text-red-600",
        neutral: "text-zinc-900"
    };

    return (
        <Card>
            <CardContent>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-zinc-500">{title}</p>
                        <h4 className={`text-2xl font-bold mt-2 ${statusColors[status || "neutral"]}`}>{value}</h4>
                    </div>
                    {trend && (
                        <span className="text-xs font-medium px-2 py-1 bg-zinc-100 rounded-full text-zinc-600">
                            {trend}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function AuditDetails({ details }: { details: any }) {
    if (!details) return <span className="text-zinc-400">-</span>;

    try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        const keys = Object.keys(parsed);

        if (keys.length === 0) return <span className="text-zinc-400">-</span>;

        return (
            <div className="flex flex-wrap gap-1">
                {keys.map((key) => (
                    <div key={key} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200">
                        <span className="font-medium mr-1">{key}:</span>
                        <span className="text-zinc-500 truncate max-w-[100px]" title={String(parsed[key])}>
                            {String(parsed[key])}
                        </span>
                    </div>
                ))}
            </div>
        );
    } catch (e) {
        return <span className="text-zinc-500 truncate">{String(details)}</span>;
    }
}

export default function AdminIndex() {
    const { logs, health } = useLoaderData<any>();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard Overview</h2>
                <p className="text-zinc-500">System performance and activity monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    title="System Status"
                    value={health?.status === 'error' ? 'Error' : (health?.status === 'healthy' ? 'Operational' : 'Degraded')}
                    status={health?.status === 'error' ? "error" : (health?.status === 'healthy' ? 'success' : 'warning')}
                    trend={health?.status === 'error' ? (health?.error || "Unknown Error") : `Latency: ${health?.dbLatencyMs || 0}ms`}
                />
                <StatCard
                    title="Active Tenants"
                    value={String(health?.activeTenants || 0)}
                    status="neutral"
                />
                <StatCard
                    title="Total Users"
                    value={String(health?.totalUsers || 0)}
                    status="neutral"
                />
                <StatCard
                    title="Recent Errors"
                    value={String(health?.recentErrors || 0)}
                    status={health?.recentErrors > 0 ? "error" : "success"}
                    trend="Last 24h"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Audit Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>IP Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <tbody>
                            {logs.map((log: any) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs text-zinc-500">
                                        {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 16)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{log.action}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {log.targetId || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-md text-xs">
                                        <AuditDetails details={log.details} />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-zinc-400">
                                        {log.ipAddress}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell className="text-center text-zinc-500 py-8" colSpan={5}>
                                        No recent activity found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </tbody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
