import { LoaderFunction } from "react-router";
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

export const loader: LoaderFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const logs = await apiRequest("/admin/logs", token);
        // We could fetch stats here too
        return { logs };
    } catch (e: any) {
        console.error("Admin dashboard loader error:", e);
        // Throw the actual error so ErrorBoundary shows it
        throw new Response(e.message || "Failed to load dashboard", { status: 500 });
    }
};

export default function AdminIndex() {
    const { logs } = useLoaderData<any>();

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                    <div className="text-zinc-500 text-sm font-medium">System Health</div>
                    <div className="text-2xl font-bold text-green-600 mt-2">Operational</div>
                </div>
                {/* Placeholders for real stats */}
                <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                    <div className="text-zinc-500 text-sm font-medium">Total Tenants</div>
                    <div className="text-2xl font-bold text-zinc-900 mt-2">--</div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                    <div className="text-zinc-500 text-sm font-medium">Active Users</div>
                    <div className="text-2xl font-bold text-zinc-900 mt-2">--</div>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-900">Recent Audit Logs</h3>
                </div>
                <div className="bg-zinc-950 text-green-400 p-4 h-[400px] overflow-y-auto font-mono text-xs">
                    {logs.map((log: any) => (
                        <div key={log.id} className="mb-2 border-l-2 border-zinc-800 pl-2">
                            <div className="flex gap-2 text-zinc-500">
                                <span>{new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}</span>
                                <span>{log.ipAddress}</span>
                            </div>
                            <div>
                                <span className="text-yellow-400 font-bold">[{log.action}]</span>{' '}
                                <span className="text-zinc-300">Target: {log.targetId}</span>
                            </div>
                            <div className="text-zinc-500 break-all">
                                {JSON.stringify(log.details)}
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-zinc-600 italic">No logs found.</div>}
                </div>
            </div>
        </div>
    );
}
