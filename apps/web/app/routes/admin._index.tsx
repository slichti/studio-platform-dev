// @ts-ignore
import { type LoaderFunctionArgs, useLoaderData, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useState } from "react";
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

function formatLogDetails(log: any) {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
    const target = log.targetId ? <span className="font-mono text-xs bg-zinc-100 px-1 rounded">{log.targetId.substring(0, 8)}...</span> : null;

    switch (log.action) {
        case 'create_user_manual':
            return <span>Created user <span className="font-medium">{details.email}</span></span>;
        case 'delete_user_admin':
            return <span>Deleted user account {target}</span>;
        case 'bulk_delete_users':
            return <span>Bulk deleted <span className="font-medium">{details.count}</span> users</span>;
        case 'promote_to_admin':
            return <span>Promoted <span className="font-medium">{details.count}</span> users to System Admin</span>;
        case 'demote_from_admin':
            return <span>Revoked System Admin from <span className="font-medium">{details.count}</span> users</span>;
        case 'update_tenant_tier':
            return <span>Changed tenant tier to <Badge variant="outline" className="text-xs uppercase">{details.tier}</Badge></span>;
        case 'impersonate_user':
            return <span>Impersonated <span className="font-medium">{details.targetEmail}</span></span>;
        case 'update_zoom_credentials':
            return <span>Updated Zoom credentials for tenant {target}</span>;
        case 'grant_studio_access':
            return <span>Granted <span className="font-medium">{details.role}</span> access to studio</span>;
        case 'revoke_studio_access':
            return <span>Revoked access from studio</span>;
        case 'scan_file':
            return <span>Virus scan result: <span className={details.infected ? "text-red-600 font-bold" : "text-green-600"}>{details.infected ? "INFECTED" : "Clean"}</span></span>;
        case 'USER_LOGIN':
            return <span>User logged in</span>;
        default:
            const keys = Object.keys(details).filter(k => !['userAgent', 'ip'].includes(k));
            if (keys.length > 0) {
                return <span className="text-zinc-500">{keys.map(k => `${k}: ${details[k]}`).join(', ')}</span>;
            }
            return <span className="text-zinc-400 italic">No additional details</span>;
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
                                <TableHead className="w-[180px]">Time</TableHead>
                                <TableHead className="w-[150px]">Action</TableHead>
                                <TableHead>Summary</TableHead>
                                <TableHead>Actor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <tbody>
                            {logs.map((log: any) => (
                                <TableRow key={log.id} className="hover:bg-zinc-50">
                                    <TableCell className="font-mono text-xs text-zinc-500 whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                            {log.action.replace(/_/g, ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {formatLogDetails(log)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-zinc-900">{log.actorProfile?.firstName} {log.actorProfile?.lastName}</span>
                                            <span className="text-xs text-zinc-500">{log.actorEmail}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell className="text-center text-zinc-500 py-8" colSpan={4}>
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


