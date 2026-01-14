// @ts-ignore
import { useLoaderData } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        const stats = await apiRequest("/stats/health", token, {}, apiUrl);
        return { stats, error: null };
    } catch (e: any) {
        return { stats: null, error: e.message || "Failed to load status" };
    }
};

export default function AdminStatus() {
    const { stats } = useLoaderData<any>();
    const services = stats?.services || {};

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">System Status</h2>

            <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="font-semibold text-lg mb-4 text-zinc-900 dark:text-zinc-200">Core Services</h3>
                    <div className="space-y-4">
                        <StatusItem name="Database (D1)" status={services.database ? 'operational' : 'degraded'} />
                        <StatusItem name="Authentication (Clerk)" status="operational" />
                        <StatusItem name="Storage (R2)" status="operational" />
                        <StatusItem name="CDN (Cloudflare)" status="operational" />
                        <StatusItem
                            name="Emails (Resend)"
                            status={services.resend ? 'operational' : 'pending_config'}
                            label={services.resend ? 'Operational' : 'Missing API Key'}
                        />
                        <StatusItem
                            name="SMS (Twilio)"
                            status={services.twilio ? 'operational' : 'pending_config'}
                            label={services.twilio ? 'Operational' : 'Missing Credentials'}
                        />
                        <StatusItem name="Payments (Stripe)" status="pending_config" label="Not Configured" />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="font-semibold text-lg mb-4 text-zinc-900 dark:text-zinc-200">Environment</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-100 dark:border-zinc-800">
                            <span className="text-zinc-500 dark:text-zinc-400 block text-xs uppercase tracking-wide">Environment</span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-200">
                                {typeof window !== 'undefined' && (window.location.hostname.includes('dev') || window.location.hostname.includes('localhost'))
                                    ? "Development"
                                    : "Production"}
                            </span>
                        </div>
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-100 dark:border-zinc-800">
                            <span className="text-zinc-500 dark:text-zinc-400 block text-xs uppercase tracking-wide">Region</span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-200">Auto (Cloudflare)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusItem({ name, status, label }: { name: string, status: 'operational' | 'degraded' | 'down' | 'pending_config', label?: string }) {
    const colors = {
        operational: 'bg-green-500',
        degraded: 'bg-yellow-500',
        down: 'bg-red-500',
        pending_config: 'bg-zinc-300 dark:bg-zinc-700'
    };

    const labels: any = {
        operational: 'Operational',
        degraded: 'Degraded',
        down: 'Down',
        pending_config: 'Pending Config'
    };

    return (
        <div className="flex items-center justify-between">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{name}</div>
            <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${colors[status]}`}></div>
                <span className={`text-sm ${status === 'operational' ? 'text-green-700 dark:text-green-400' : 'text-zinc-500 dark:text-zinc-500'}`}>
                    {label || labels[status]}
                </span>
            </div>
        </div>
    );
}
