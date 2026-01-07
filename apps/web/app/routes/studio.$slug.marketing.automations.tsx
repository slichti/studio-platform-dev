// @ts-ignore
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useSubmit, Form, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Zap, Plus, Play, Pause, Trash2, Mail, MessageSquare, Users, Clock, ChevronRight, X, Settings, Calendar, Target, Bell } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const [automationsData, statsData] = await Promise.all([
            apiRequest('/marketing/automations', token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/marketing/automations/stats', token, { headers: { 'X-Tenant-Slug': slug } }).catch(() => null)
        ]) as any[];

        return { automations: automationsData || [], stats: statsData };
    } catch (e) {
        console.error("Automations Loader Error", e);
        return { automations: [], stats: null };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'create') {
        await apiRequest('/marketing/automations', token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({
                name: formData.get("name"),
                trigger: formData.get("trigger"),
                triggerConfig: JSON.parse(formData.get("triggerConfig") as string || "{}"),
                actions: JSON.parse(formData.get("actions") as string || "[]"),
                isActive: formData.get("isActive") === "true"
            })
        });
    }

    if (intent === 'toggle') {
        const id = formData.get("id");
        await apiRequest(`/marketing/automations/${id}/toggle`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug }
        });
    }

    if (intent === 'delete') {
        const id = formData.get("id");
        await apiRequest(`/marketing/automations/${id}`, token, {
            method: 'DELETE',
            headers: { 'X-Tenant-Slug': slug }
        });
    }

    return { success: true };
};

const TRIGGERS = [
    { id: 'new_member', label: 'New Member Signs Up', icon: Users },
    { id: 'class_booked', label: 'Class Booked', icon: Calendar },
    { id: 'class_missed', label: 'Class No-Show', icon: Target },
    { id: 'inactive_days', label: 'Inactive for X Days', icon: Clock },
    { id: 'birthday', label: 'Member Birthday', icon: Bell },
    { id: 'membership_expiring', label: 'Membership Expiring', icon: Clock },
];

const ACTIONS = [
    { id: 'send_email', label: 'Send Email', icon: Mail },
    { id: 'send_sms', label: 'Send SMS', icon: MessageSquare },
    { id: 'add_tag', label: 'Add Tag', icon: Target },
    { id: 'wait', label: 'Wait (Delay)', icon: Clock },
];

export default function AutomatedCampaigns() {
    const { automations, stats } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const [isCreating, setIsCreating] = useState(false);

    const handleToggle = (id: string) => {
        submit({ intent: 'toggle', id }, { method: 'post' });
    };

    const handleDelete = (id: string) => {
        if (confirm("Delete this automation?")) {
            submit({ intent: 'delete', id }, { method: 'post' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg text-white"><Zap size={20} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Automations</h1>
                            <p className="text-sm text-zinc-500">Set up automated email & SMS campaigns</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 flex items-center gap-2"
                    >
                        <Plus size={16} /> Create Automation
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg border border-zinc-200 p-4">
                            <div className="text-2xl font-bold text-zinc-900">{stats.totalAutomations || 0}</div>
                            <div className="text-xs text-zinc-500">Total Automations</div>
                        </div>
                        <div className="bg-white rounded-lg border border-zinc-200 p-4">
                            <div className="text-2xl font-bold text-green-600">{stats.activeCount || 0}</div>
                            <div className="text-xs text-zinc-500">Active</div>
                        </div>
                        <div className="bg-white rounded-lg border border-zinc-200 p-4">
                            <div className="text-2xl font-bold text-blue-600">{stats.emailsSent || 0}</div>
                            <div className="text-xs text-zinc-500">Emails Sent (30d)</div>
                        </div>
                        <div className="bg-white rounded-lg border border-zinc-200 p-4">
                            <div className="text-2xl font-bold text-purple-600">{stats.smsSent || 0}</div>
                            <div className="text-xs text-zinc-500">SMS Sent (30d)</div>
                        </div>
                    </div>
                )}

                {/* Automation List */}
                {automations.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-zinc-200">
                        <Zap size={48} className="mx-auto mb-4 text-zinc-300" />
                        <p className="text-zinc-500 mb-4">No automations yet</p>
                        <button onClick={() => setIsCreating(true)} className="text-sm text-zinc-900 underline">Create your first</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {automations.map((auto: any) => {
                            const trigger = TRIGGERS.find(t => t.id === auto.trigger);
                            const TriggerIcon = trigger?.icon || Zap;

                            return (
                                <div key={auto.id} className={`bg-white rounded-xl border ${auto.isActive ? 'border-green-200' : 'border-zinc-200'} p-5`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-xl ${auto.isActive ? 'bg-green-100' : 'bg-zinc-100'}`}>
                                                <TriggerIcon size={24} className={auto.isActive ? 'text-green-600' : 'text-zinc-400'} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-zinc-900">{auto.name}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${auto.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                                        {auto.isActive ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-500 mt-1">Trigger: {trigger?.label || auto.trigger}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                                                    <span>Actions: {auto.actions?.length || 0}</span>
                                                    <span>Runs: {auto.runCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggle(auto.id)}
                                                className={`p-2 rounded-lg ${auto.isActive ? 'hover:bg-yellow-50 text-yellow-600' : 'hover:bg-green-50 text-green-600'}`}
                                                title={auto.isActive ? 'Pause' : 'Activate'}
                                            >
                                                {auto.isActive ? <Pause size={16} /> : <Play size={16} />}
                                            </button>
                                            <button onClick={() => handleDelete(auto.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreating && (
                <CreateAutomationModal
                    onClose={() => setIsCreating(false)}
                    onSave={(data: any) => {
                        const formData = new FormData();
                        formData.append("intent", "create");
                        formData.append("name", data.name);
                        formData.append("trigger", data.trigger);
                        formData.append("triggerConfig", JSON.stringify(data.triggerConfig || {}));
                        formData.append("actions", JSON.stringify(data.actions || []));
                        formData.append("isActive", "true");
                        submit(formData, { method: "post" });
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
}

function CreateAutomationModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [trigger, setTrigger] = useState("");
    const [actions, setActions] = useState<{ type: string; config: any }[]>([]);

    const addAction = (type: string) => {
        setActions([...actions, { type, config: {} }]);
    };

    const handleSubmit = () => {
        onSave({ name, trigger, actions });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Create Automation</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Automation Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="e.g., Welcome Series" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-2">Trigger</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TRIGGERS.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTrigger(t.id)}
                                            className={`p-3 rounded-lg border text-left flex items-center gap-2 ${trigger === t.id ? 'border-purple-500 bg-purple-50' : 'border-zinc-200 hover:bg-zinc-50'}`}
                                        >
                                            <t.icon size={16} className={trigger === t.id ? 'text-purple-600' : 'text-zinc-400'} />
                                            <span className="text-sm">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-zinc-700 mb-2">Actions</label>
                            {actions.map((action, i) => {
                                const actionDef = ACTIONS.find(a => a.id === action.type);
                                return (
                                    <div key={i} className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                                        <span className="text-sm font-medium">{i + 1}. {actionDef?.label}</span>
                                        <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="ml-auto text-red-500 text-xs">Remove</button>
                                    </div>
                                );
                            })}
                            <div className="grid grid-cols-2 gap-2">
                                {ACTIONS.map((a) => (
                                    <button
                                        key={a.id}
                                        onClick={() => addAction(a.id)}
                                        className="p-2 rounded-lg border border-dashed border-zinc-300 hover:border-purple-500 hover:bg-purple-50 flex items-center gap-2 text-sm"
                                    >
                                        <Plus size={14} /> {a.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-200 flex justify-between">
                    {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-sm text-zinc-500">Back</button>}
                    {step < 2 ? (
                        <button onClick={() => setStep(2)} disabled={!name || !trigger} className="ml-auto px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm disabled:opacity-50">Next</button>
                    ) : (
                        <button onClick={handleSubmit} disabled={actions.length === 0} className="ml-auto px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm disabled:opacity-50">Create</button>
                    )}
                </div>
            </div>
        </div>
    );
}
