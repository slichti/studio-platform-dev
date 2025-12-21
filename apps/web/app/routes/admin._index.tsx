import { LoaderFunction } from "react-router";
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

// export const loader: LoaderFunction = async (args) => {
//    console.log("DEBUG: Admin Loader Stub");
//    return { logs: [] };
// };

export const loader: LoaderFunction = async (args) => {
    let token = "DUMMY_TOKEN";
    // try {
    //     const { getToken } = await getAuth(args);
    //     token = await getToken();
    // } catch (authErr: any) {
    //     console.error("DEBUG: getAuth CRASHED", authErr);
    //     throw new Response(`Auth System Error: ${authErr.message}`, { status: 500 });
    // }

    try {
        console.log("DEBUG: Calling API /admin/logs");
        // Pass runtime env API URL to ensure we hit the real backend, not localhost
        const apiUrl = (args.context.env as any).VITE_API_URL;

        // Debugging: Throw if API URL is missing so we see it
        if (!apiUrl) {
            throw new Error("VITE_API_URL is undefined in context");
        }

        const logs = await apiRequest("/admin/logs", token, {}, apiUrl);
        console.log("DEBUG: API Success");
        return { logs };
    } catch (e: any) {
        console.error("DEBUG: API Call Failed", e);
        // Provide FULL context in the error message for the user to see
        const apiUrl = (args.context.env as any)?.VITE_API_URL || "UNKNOWN";
        throw new Response(`API Fetch Failed. Target: ${apiUrl}/admin/logs. Error: ${e.message}`, { status: 500 });
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
