
import { useLoaderData, Link } from "react-router";

import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Mail, BarChart2 } from "lucide-react";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    let stats = { totalSent: 0, byTenant: [], recentLogs: [] };

    try {
        const res = await apiRequest("/admin-api/stats/email", token); // Call the new admin-api
        if (!res.error) stats = res;
    } catch (e) {
        console.error("Failed to load email stats", e);
    }

    return { stats };
};

export default function AdminEmailsPage() {
    const { stats } = useLoaderData<any>();

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">Global Email Analytics</h1>
            <p className="text-zinc-500 mb-8">System-wide email volume and usage tracking.</p>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                        <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">Total Emails Sent</p>
                        <p className="text-3xl font-bold text-zinc-900">{stats.totalSent}</p>
                    </div>
                </div>
                {/* Placeholder for future stats like error rate */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sent by Tenant */}
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                    <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 border-zinc-200">
                        <h3 className="font-semibold text-zinc-800">Volume by Tenant</h3>
                    </div>
                    <table className="min-w-full divide-y divide-zinc-200">
                        <thead>
                            <tr className="bg-zinc-50">
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Emails Sent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {stats.byTenant.map((t: any, i: number) => (
                                <tr key={i}>
                                    <td className="px-6 py-3 text-sm font-medium text-zinc-900">
                                        <Link to={`/admin/tenants`} className="hover:underline">{t.tenantName}</Link>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-right text-zinc-600 font-mono">
                                        {t.count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Recent Logs (Global) */}
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                    <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200">
                        <h3 className="font-semibold text-zinc-800">Recent Logs</h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-zinc-200">
                            <thead>
                                <tr className="bg-zinc-50">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Sent At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Subject</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                                {stats.recentLogs.map((log: any) => (
                                    <tr key={log.id}>
                                        <td className="px-4 py-2 text-xs text-zinc-500">
                                            {new Date(log.sentAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-xs font-medium text-zinc-900">
                                            {log.tenantName}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-zinc-600 truncate max-w-[200px]">
                                            {log.subject}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
