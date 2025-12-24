// @ts-ignore
import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
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
        throw new Response(`Auth System Error: ${authErr.message}`, { status: 500 });
    }

    try {
        const apiUrl = (args.context.env as any).VITE_API_URL;
        if (!apiUrl) throw new Error("VITE_API_URL is undefined in context");

        const logs = await apiRequest("/admin/logs", token, {}, apiUrl);
        return { logs };
    } catch (e: any) {
        const apiUrl = (args.context.env as any)?.VITE_API_URL || "UNKNOWN";
        throw new Response(`API Fetch Failed. Target: ${apiUrl}/admin/logs. Error: ${e.message}`, { status: 500 });
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

export default function AdminIndex() {
    const { logs } = useLoaderData<any>();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard Overview</h2>
                <p className="text-zinc-500">System performance and activity monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="System Health"
                    value="Operational"
                    status="success"
                />
                <StatCard
                    title="Total Tenants"
                    value="--"
                    trend="+0% this month"
                />
                <StatCard
                    title="Active Users"
                    value="--"
                    trend="+0% this week"
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
                                    <TableCell className="max-w-md truncate text-zinc-500 text-xs">
                                        {JSON.stringify(log.details)}
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
