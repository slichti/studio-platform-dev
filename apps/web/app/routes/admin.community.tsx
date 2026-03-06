import { useState, useEffect } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import {
    MessagesSquare,
    Settings,
    Users,
    ShieldCheck,
    Search,
    ChevronRight,
    Building2,
    ToggleLeft,
    ToggleRight
} from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const data = await apiRequest<any>("/admin/community", token);
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e.message };
    }
};

export default function AdminCommunityDashboard() {
    const { data, error } = useLoaderData<any>();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState<string | null>(null);

    if (error) return <div className="p-8 text-red-600">Error loading dashboard: {error}</div>;
    if (!data) return <div className="p-8">Loading...</div>;

    const filteredTenants = data.tenants.filter((t: any) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

    const toggleGlobal = async () => {
        setUpdating("global");
        try {
            const token = await getToken();
            await apiRequest("/admin/community/global", token, {
                method: "PUT",
                body: JSON.stringify({ enabled: !data.global.enabled })
            });
            toast.success(`Global Community Hub ${!data.global.enabled ? 'enabled' : 'disabled'}`);
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update global settings");
        } finally {
            setUpdating(null);
        }
    };

    const toggleEmail = async () => {
        setUpdating("email");
        try {
            const token = await getToken();
            await apiRequest("/admin/community/global", token, {
                method: "PUT",
                body: JSON.stringify({ emailEnabled: !data.global.emailEnabled })
            });
            toast.success(`Global Email Alerts ${!data.global.emailEnabled ? 'enabled' : 'disabled'}`);
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update email settings");
        } finally {
            setUpdating(null);
        }
    };

    const toggleSms = async () => {
        setUpdating("sms");
        try {
            const token = await getToken();
            await apiRequest("/admin/community/global", token, {
                method: "PUT",
                body: JSON.stringify({ smsEnabled: !data.global.smsEnabled })
            });
            toast.success(`Global SMS Alerts ${!data.global.smsEnabled ? 'enabled' : 'disabled'}`);
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update SMS settings");
        } finally {
            setUpdating(null);
        }
    };

    const toggleTenant = async (tenantId: string, current: boolean) => {
        setUpdating(tenantId);
        try {
            const token = await getToken();
            await apiRequest(`/admin/community/tenants/${tenantId}`, token, {
                method: "PUT",
                body: JSON.stringify({ enabled: !current })
            });
            toast.success("Tenant community updated");
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update tenant community");
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Community Hub Management</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">Central control for platform-wide social features and tenant engagement.</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
                    <MessagesSquare size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
            </div>

            {/* Global controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                            <Settings size={20} className="text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Global configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:border-blue-200 dark:hover:border-blue-800">
                            <div className="flex-1">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                    Platform visibility
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${data.global.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                        {data.global.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">When disabled, the Community Hub is hidden for all studios regardless of individual settings.</p>
                            </div>
                            <button
                                onClick={toggleGlobal}
                                disabled={updating === "global"}
                                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 ${data.global.enabled ? 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 shadow-lg'}`}
                            >
                                {updating === "global" ? "Processing..." : data.global.enabled ? (
                                    <><ToggleRight className="text-green-500" /> Disable globally</>
                                ) : (
                                    <><ToggleLeft /> Enable globally</>
                                )}
                            </button>
                        </div>

                        {/* Global Notifications */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Global Community Email</h4>
                                    <p className="text-xs text-zinc-500 mt-1">Master switch for community-specific email notifications (new posts, milestones etc.).</p>
                                </div>
                                <button
                                    onClick={toggleEmail}
                                    disabled={updating === "email"}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 disabled:opacity-50 ${data.global.emailEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${data.global.emailEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Global Community SMS</h4>
                                    <p className="text-xs text-zinc-500 mt-1">Master switch for community-specific SMS/text notifications.</p>
                                </div>
                                <button
                                    onClick={toggleSms}
                                    disabled={updating === "sms"}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 disabled:opacity-50 ${data.global.smsEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${data.global.smsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {data.global.updatedAt && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-4 flex items-center gap-1">
                            <ShieldCheck size={12} /> Last global policy update: {new Date(data.global.updatedAt).toLocaleString()}
                        </p>
                    )}
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl shadow-blue-900/10">
                    <Users size={32} className="mb-6 opacity-80" />
                    <h2 className="text-xl font-bold mb-2">Network reach</h2>
                    <p className="text-blue-50 text-sm leading-relaxed mb-6">
                        You have {data.tenants.length} tenants on the platform. {data.tenants.filter((t: any) => t.communityEnabled).length} have enabled community hubs.
                    </p>
                    <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                        <div className="text-xs text-blue-100 uppercase tracking-widest font-bold mb-1">Adoption rate</div>
                        <div className="text-3xl font-black">{Math.round((data.tenants.filter((t: any) => t.communityEnabled).length / data.tenants.length) * 100)}%</div>
                    </div>
                </div>
            </div>

            {/* Tenant list */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Building2 size={20} className="text-zinc-400" />
                        Tenant controls
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by name or slug..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-full sm:w-64 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Studio / Tenant</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Plan tier</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">Community Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredTenants.map((tenant: any) => (
                                <tr key={tenant.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-zinc-900 dark:text-zinc-50">{tenant.name}</span>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-500 font-mono tracking-tighter">{tenant.slug}.studio.com</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${tenant.plan === 'scale' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800' :
                                            tenant.plan === 'growth' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800' :
                                                'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-100 dark:border-zinc-700'
                                            }`}>
                                            {tenant.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <div className="flex items-center justify-center">
                                            <button
                                                onClick={() => toggleTenant(tenant.id, tenant.communityEnabled)}
                                                disabled={updating === tenant.id || updating === "global"}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 disabled:opacity-50 ${tenant.communityEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tenant.communityEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <a href={`/studio/${tenant.slug}/community`} className="text-zinc-300 hover:text-blue-500 transition-colors">
                                            <ChevronRight size={20} />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
