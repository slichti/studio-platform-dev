import { useLoaderData, Link, isRouteErrorResponse, useRouteError, useFetcher, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Mail, MessageSquare, Zap, AlertTriangle, Play, Pause, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/button";
import { CreateAutomationModal, TRIGGERS } from "~/components/routes/MarketingAutomationsPage";
import { AutomationCard } from "~/components/marketing/AutomationCard";

interface LocalAutomation {
    type: string;
    active: boolean;
}

interface TenantStats {
    id: string;
    name: string;
    slug: string;
    emailCount: number;
    smsCount: number;
    automations: LocalAutomation[];
}

interface CommsData {
    totals: { email: number; sms: number };
    tenants: TenantStats[];
    recentEmailLogs: any[];
    recentSmsLogs: any[];
}

interface Automation {
    id: string;
    triggerEvent: string;
    isEnabled: boolean;
    metadata?: any;
    steps: any[];
    createdAt: string;
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    let data: CommsData = { totals: { email: 0, sms: 0 }, tenants: [], recentEmailLogs: [], recentSmsLogs: [] };
    let automations: Automation[] = [];

    try {
        const [statsRes, autoRes] = await Promise.all([
            apiRequest<CommsData>("/admin/stats/communications", token),
            apiRequest<Automation[]>("/admin/automations", token)
        ]);
        if (statsRes && !(statsRes as any).error) data = statsRes;
        if (autoRes && !(autoRes as any).error) automations = autoRes;
    } catch (e) {
        console.error("Failed to load comms stats", e);
    }
    return { data, automations };
};

export const action = async (args: ActionFunctionArgs) => {
    const { request } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        if (request.headers.get("Content-Type")?.includes("application/json")) {
            const body = await request.json() as any;
            if (body._action === 'create') {
                await apiRequest('/admin/automations', token, { method: 'POST', body: JSON.stringify(body) });
                return { success: true };
            }
            if (body._action === 'update') {
                await apiRequest(`/admin/automations/${body.id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
                return { success: true };
            }
        }

        const formData = await request.formData();
        const actionType = formData.get('_action');

        if (actionType === 'delete') {
            const id = formData.get('id') as string;
            await apiRequest(`/admin/automations/${id}`, token, { method: 'DELETE' });
        } else if (actionType === 'toggle') {
            const id = formData.get('id') as string;
            const isEnabled = formData.get('isEnabled') === 'true';
            await apiRequest(`/admin/automations/${id}`, token, { method: 'PATCH', body: JSON.stringify({ isEnabled: !isEnabled }) });
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export default function AdminCommsPage() {
    const { data, automations } = useLoaderData<typeof loader>();
    const { totals, tenants, recentEmailLogs, recentSmsLogs } = data;
    const fetcher = useFetcher();
    const navigate = useNavigate();

    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [draft, setDraft] = useState<Partial<Automation>>({ triggerEvent: "new_student", steps: [] });

    const openBuilder = (automation?: Automation) => {
        if (automation) {
            setDraft({ ...automation, name: automation.metadata?.name } as any);
        } else {
            setDraft({} as any);
        }
        setIsBuilderOpen(true);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto auto-layout">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Communications</h1>
                <p className="text-zinc-500 dark:text-zinc-400">System-wide Email, SMS usage, Activity logs, and Platform Automations.</p>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mb-6 grid w-full md:w-[600px] grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="automations">Automations Builder</TabsTrigger>
                    <TabsTrigger value="activity">Recent Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full"><Mail size={24} /></div>
                            <div>
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Emails</div>
                                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{totals.email.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full"><MessageSquare size={24} /></div>
                            <div>
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total SMS</div>
                                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{totals.sms.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Tenant Usage & Automations</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Tenant</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">Emails</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">SMS</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Active Automations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {tenants.map((t) => (
                                    <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{t.name}</div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{t.slug}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{t.emailCount.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{t.smsCount.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            {t.automations.length === 0 ? (
                                                <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">None active</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {t.automations.map((a, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
                                                            <Zap size={10} className="mr-1 text-amber-500" />
                                                            {a.type.replace(/_/g, ' ')}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                <TabsContent value="automations" className="space-y-6">
                    <div className="flex justify-between items-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Zap size={24} className="text-amber-500" /> Global Marketing Automations</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                                Build multi-step Email & SMS sequences that your tenants can clone into their own studios.
                            </p>
                        </div>
                        <Button onClick={() => openBuilder()}><Plus className="w-4 h-4 mr-2" /> Create Automation</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {automations.map(a => (
                            <AutomationCard
                                key={a.id}
                                automation={a}
                                onEdit={openBuilder}
                                onToggle={(id) => {
                                    const formData = new FormData();
                                    formData.append("_action", "toggle");
                                    formData.append("id", id);
                                    formData.append("isEnabled", a.isEnabled.toString());
                                    fetcher.submit(formData, { method: "post" });
                                }}
                                onDelete={(id) => {
                                    if (confirm('Delete automation?')) {
                                        const formData = new FormData();
                                        formData.append("_action", "delete");
                                        formData.append("id", id);
                                        fetcher.submit(formData, { method: "post" });
                                    }
                                }}
                                TRIGGERS={TRIGGERS}
                            />
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center"><Mail className="w-4 h-4 mr-2" /> Recent Emails</h3>
                            </div>
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[500px] overflow-auto">
                                {recentEmailLogs.map(log => (
                                    <li key={log.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate w-2/3">{log.subject}</span>
                                            <span className="text-xs text-zinc-500">{new Date(log.sentAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-zinc-500 truncate w-1/2">{log.recipient}</span>
                                            <Badge variant="secondary" className="text-[10px]">{log.tenantName}</Badge>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center"><MessageSquare className="w-4 h-4 mr-2" /> Recent SMS</h3>
                            </div>
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[500px] overflow-auto">
                                {recentSmsLogs.map(log => (
                                    <li key={log.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate w-2/3">{log.body}</span>
                                            <span className="text-xs text-zinc-500">{new Date(log.sentAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-zinc-500">{log.recipient}</span>
                                            <div className="flex gap-2">
                                                <Badge variant="outline" className={log.status === 'failed' ? 'text-red-500' : 'text-green-500'}>{log.status}</Badge>
                                                <Badge variant="secondary" className="text-[10px]">{log.tenantName}</Badge>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {isBuilderOpen && (
                <CreateAutomationModal
                    initialData={draft.id ? draft : null}
                    onClose={() => setIsBuilderOpen(false)}
                    onSave={(data: any) => {
                        const payload = {
                            _action: draft.id ? 'update' : 'create',
                            ...(draft.id ? { id: draft.id } : {}),
                            name: data.name,
                            triggerEvent: data.triggerEvent,
                            steps: data.steps,
                            isEnabled: data.isEnabled
                        };
                        fetcher.submit(payload as any, { method: 'POST', encType: 'application/json' });
                        setIsBuilderOpen(false);
                    }}
                />
            )}
        </div>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-600 p-4">
            <AlertTriangle size={48} className="mb-4" />
            <h1 className="text-xl font-bold mb-2">Failed to load Communications Dashboard</h1>
            <p className="text-sm text-zinc-600 mb-4">{isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Unknown Error"}</p>
            <Link to="/admin" className="text-blue-600 hover:underline">Return to Admin Dashboard</Link>
        </div>
    );
}
