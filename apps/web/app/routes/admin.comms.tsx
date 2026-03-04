import { useLoaderData, Link, isRouteErrorResponse, useRouteError, useFetcher, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Mail, MessageSquare, Zap, AlertTriangle, Play, Pause, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";

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
            setDraft({ ...automation });
        } else {
            setDraft({ triggerEvent: "new_student", steps: [] });
        }
        setIsBuilderOpen(true);
    };

    const addStep = (type: "email" | "sms" | "delay") => {
        const newStep = type === "delay"
            ? { id: crypto.randomUUID(), type, delayHours: 24 }
            : { id: crypto.randomUUID(), type, subject: type === 'email' ? "" : undefined, content: "" };
        setDraft(d => ({ ...d, steps: [...(d.steps || []), newStep] }));
    };

    const updateStep = (index: number, field: string, value: any) => {
        const newSteps = [...(draft.steps || [])];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setDraft(d => ({ ...d, steps: newSteps }));
    };

    const removeStep = (index: number) => {
        const newSteps = [...(draft.steps || [])];
        newSteps.splice(index, 1);
        setDraft(d => ({ ...d, steps: newSteps }));
    };

    const moveStep = (index: number, dir: -1 | 1) => {
        const newSteps = [...(draft.steps || [])];
        if (index + dir < 0 || index + dir >= newSteps.length) return;
        const temp = newSteps[index];
        newSteps[index] = newSteps[index + dir];
        newSteps[index + dir] = temp;
        setDraft(d => ({ ...d, steps: newSteps }));
    };

    const handleSave = async () => {
        const payload = {
            _action: draft.id ? 'update' : 'create',
            ...draft
        };
        fetcher.submit(payload, { method: 'POST', encType: 'application/json' });
        setIsBuilderOpen(false);
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
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
                        <Zap size={48} className="text-amber-500" />
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Global Marketing Automations</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 max-w-lg">
                            Build multi-step Email & SMS sequences that your tenants can clone into their own studios.
                        </p>
                        <Button onClick={() => openBuilder()} className="mt-4"><Plus className="w-4 h-4 mr-2" /> Create Automation</Button>
                    </div>

                    {automations.map(a => (
                        <div key={a.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold font-mono text-zinc-900 dark:text-zinc-100">{a.triggerEvent}</h3>
                                <p className="text-sm text-zinc-500">{a.steps?.length || 0} Steps Configured</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <fetcher.Form method="post">
                                    <input type="hidden" name="id" value={a.id} />
                                    <input type="hidden" name="isEnabled" value={a.isEnabled.toString()} />
                                    <Button name="_action" value="toggle" variant={a.isEnabled ? "outline" : "default"} size="sm">
                                        {a.isEnabled ? <><Pause className="w-4 h-4 mr-2" /> Pause</> : <><Play className="w-4 h-4 mr-2" /> Activate</>}
                                    </Button>
                                </fetcher.Form>
                                <Button onClick={() => openBuilder(a)} variant="outline" size="sm"><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
                                <fetcher.Form method="post" onSubmit={(e) => !confirm('Delete automation?') && e.preventDefault()}>
                                    <input type="hidden" name="id" value={a.id} />
                                    <Button name="_action" value="delete" variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button>
                                </fetcher.Form>
                            </div>
                        </div>
                    ))}
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

            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Edit Automation" : "Create Automation"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Trigger Event</label>
                            <select
                                value={draft.triggerEvent || ""}
                                onChange={e => setDraft({ ...draft, triggerEvent: e.target.value })}
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="new_student">New Student Signup</option>
                                <option value="class_attended">Class Attended</option>
                                <option value="class_missed">Class Missed</option>
                                <option value="order_completed">Order Completed</option>
                                <option value="subscription_canceled">Subscription Canceled</option>
                                <option value="birthday">Birthday</option>
                            </select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Workflow Steps</h3>
                                <div className="space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => addStep("delay")}><Plus className="w-3 h-3 mr-1" /> Delay</Button>
                                    <Button variant="outline" size="sm" onClick={() => addStep("email")}><Mail className="w-3 h-3 mr-1" /> Email</Button>
                                    <Button variant="outline" size="sm" onClick={() => addStep("sms")}><MessageSquare className="w-3 h-3 mr-1" /> SMS</Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {draft.steps?.map((step, idx) => (
                                    <div key={step.id || idx} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900">
                                        <div className="flex justify-between items-center mb-4 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge>{idx + 1}. {step.type.toUpperCase()}</Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => moveStep(idx, -1)} disabled={idx === 0}><ChevronUp className="w-4 h-4" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => moveStep(idx, 1)} disabled={idx === draft.steps!.length - 1}><ChevronDown className="w-4 h-4" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => removeStep(idx)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                                            </div>
                                        </div>

                                        {step.type === "delay" && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-zinc-600 dark:text-zinc-400">Wait for</span>
                                                <input
                                                    type="number"
                                                    value={step.delayHours || 0}
                                                    onChange={e => updateStep(idx, "delayHours", parseInt(e.target.value))}
                                                    className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
                                                />
                                                <span className="text-sm text-zinc-600 dark:text-zinc-400">hours</span>
                                            </div>
                                        )}

                                        {step.type === "email" && (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    placeholder="Subject line..."
                                                    value={step.subject || ""}
                                                    onChange={e => updateStep(idx, "subject", e.target.value)}
                                                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium"
                                                />
                                                <textarea
                                                    placeholder="HTML/Text Content..."
                                                    value={step.content || ""}
                                                    onChange={e => updateStep(idx, "content", e.target.value)}
                                                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono h-32 resize-y"
                                                />
                                            </div>
                                        )}

                                        {step.type === "sms" && (
                                            <div className="space-y-3">
                                                <textarea
                                                    placeholder="SMS Content..."
                                                    value={step.content || ""}
                                                    onChange={e => updateStep(idx, "content", e.target.value)}
                                                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm h-24 resize-y"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!draft.steps || draft.steps.length === 0) && (
                                    <p className="text-center text-zinc-500 text-sm py-4">No steps added yet. Add a step to begin your sequence.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBuilderOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Automation</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
