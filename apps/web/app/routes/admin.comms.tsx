import { useLoaderData, Link, isRouteErrorResponse, useRouteError } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Mail, MessageSquare, Zap, AlertTriangle } from "lucide-react";

interface Automation {
    type: string;
    active: boolean;
}

interface TenantStats {
    id: string;
    name: string;
    slug: string;
    emailCount: number;
    smsCount: number;
    automations: Automation[];
}

interface CommsData {
    totals: { email: number; sms: number };
    tenants: TenantStats[];
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    let data: CommsData = { totals: { email: 0, sms: 0 }, tenants: [] };

    try {
        const res = await apiRequest<CommsData>("/admin-api/stats/communications", token);
        if (res && !(res as any).error) data = res;
    } catch (e) {
        console.error("Failed to load comms stats", e);
    }
    return { data };
};

export default function AdminCommsPage() {
    const { data } = useLoaderData<typeof loader>();
    const { totals, tenants } = data;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 mb-2">Communications</h1>
                <p className="text-zinc-500">System-wide Email & SMS usage and automation tracking.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><Mail size={24} /></div>
                    <div>
                        <div className="text-sm font-medium text-zinc-500">Total Emails</div>
                        <div className="text-3xl font-bold text-zinc-900">{totals.email.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-green-50 text-green-600 rounded-full"><MessageSquare size={24} /></div>
                    <div>
                        <div className="text-sm font-medium text-zinc-500">Total SMS</div>
                        <div className="text-3xl font-bold text-zinc-900">{totals.sms.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-900">Tenant Usage & Automations</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Tenant</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">Emails</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">SMS</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Active Automations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {tenants.map((t) => (
                            <tr key={t.id} className="hover:bg-zinc-50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-zinc-900">{t.name}</div>
                                    <div className="text-xs text-zinc-500 font-mono">{t.slug}</div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-zinc-700">
                                    {t.emailCount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-zinc-700">
                                    {t.smsCount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    {t.automations.length === 0 ? (
                                        <span className="text-xs text-zinc-400 italic">None active</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {t.automations.map((a, i) => (
                                                <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs border border-zinc-200">
                                                    <Zap size={10} className="mr-1 text-amber-500" />
                                                    {formatAutomationType(a.type)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">No data available</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function formatAutomationType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
