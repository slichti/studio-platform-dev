

import { useLoaderData, useFetcher } from "react-router";

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useState } from "react";
import {
    Cake,
    UserPlus,
    CalendarClock,
    AlertCircle,
    Plus,
    Pencil,
    Trash2,
    Clock
} from "lucide-react";
// Import only existing components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "../components/ui/dialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { apiRequest } from "../utils/api";

interface Automation {
    id: string;
    triggerEvent: 'new_student' | 'birthday' | 'absent' | 'trial_ending';
    subject: string;
    content: string;
    timingType: 'immediate' | 'delay' | 'before' | 'after';
    timingValue: number;
    isEnabled: boolean;
    tenantId?: string | null;
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        const automations = await apiRequest<Automation[]>('/admin/automations', token, {}, apiUrl);
        return { automations: automations || [] };
    } catch (e: any) {
        console.error("Failed to load automations", e);
        return { automations: [], error: e.message };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, context } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const env = (context as any).cloudflare?.env || (context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    const formData = await request.formData();
    const actionType = formData.get('_action');

    try {
        if (actionType === 'create') {
            const data = {
                triggerEvent: formData.get('triggerEvent'),
                subject: formData.get('subject'),
                content: formData.get('content'),
                timingType: formData.get('timingType'),
                timingValue: Number(formData.get('timingValue'))
            };
            await apiRequest('/admin/automations', token, {
                method: 'POST',
                body: JSON.stringify(data)
            }, apiUrl);
        } else if (actionType === 'update') {
            const id = formData.get('id') as string;
            const data: any = {};
            if (formData.has('isEnabled')) data.isEnabled = formData.get('isEnabled') === 'true';
            if (formData.has('subject')) data.subject = formData.get('subject');
            if (formData.has('content')) data.content = formData.get('content');
            if (formData.has('timingType')) data.timingType = formData.get('timingType');
            if (formData.has('timingValue')) data.timingValue = Number(formData.get('timingValue'));

            await apiRequest(`/admin/automations/${id}`, token, {
                method: 'PATCH',
                body: JSON.stringify(data)
            }, apiUrl);
        } else if (actionType === 'delete') {
            const id = formData.get('id') as string;
            await apiRequest(`/admin/automations/${id}`, token, {
                method: 'DELETE'
            }, apiUrl);
        } else if (actionType === 'test') {
            const id = formData.get('id') as string;
            const email = formData.get('email') as string;
            await apiRequest(`/admin/automations/${id}/test`, token, {
                method: 'POST',
                body: JSON.stringify({ email })
            }, apiUrl);
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

// ... (previous imports and interfaces)

export default function AdminWorkflows() {
    const { automations } = useLoaderData<{ automations: Automation[] }>();
    const fetcher = useFetcher();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [groupByTenant, setGroupByTenant] = useState(false);
    const [filterType, setFilterType] = useState<string>("all");

    const getIcon = (type: string) => {
        switch (type) {
            case 'birthday': return <Cake className="text-pink-500" />;
            case 'new_student': return <UserPlus className="text-emerald-500" />;
            case 'absent': return <CalendarClock className="text-amber-500" />;
            case 'trial_ending': return <AlertCircle className="text-indigo-500" />;
            default: return <Clock className="text-blue-500" />;
        }
    };

    const getTimingLabel = (auto: Automation) => {
        if (auto.timingType === 'immediate') return 'Sends Immediately';
        if (auto.timingType === 'delay') return `Wait ${auto.timingValue} hours`;
        if (auto.timingType === 'before') return `${auto.timingValue} hours Before`;
        if (auto.timingType === 'after') return `${auto.timingValue} hours After`;
        return 'Custom Schedule';
    };

    // Filter Logic
    const filteredAutomations = automations.filter(a =>
        filterType === "all" ? true : a.triggerEvent === filterType
    );

    // Group Logic
    const groupedAutomations = filteredAutomations.reduce((acc, curr) => {
        const key = curr.tenantId || "Platform Global";
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {} as Record<string, Automation[]>);

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Marketing Workflows</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Automate your student communication lifecycle.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {/* Use native select if custom Select component issues persist, or ensure correct props */}
                        <div className="relative">
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="h-10 w-[180px] rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
                            >
                                <option value="all">All Types</option>
                                <option value="new_student">New Student Signup</option>
                                <option value="birthday">Birthday</option>
                                <option value="absent">Student Absent (Re-engage)</option>
                                <option value="trial_ending">Trial Ending</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="groupByTenant" className="text-sm cursor-pointer select-none">Group by Tenant</Label>
                        <Switch id="groupByTenant" checked={groupByTenant} onCheckedChange={setGroupByTenant} />
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="w-4 h-4 mr-2" /> New Workflow</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Create Workflow</DialogTitle>
                            </DialogHeader>
                            <WorkflowForm
                                onSubmit={(formData) => {
                                    formData.append('_action', 'create');
                                    fetcher.submit(formData, { method: 'post' });
                                    setIsCreateOpen(false);
                                }}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {groupByTenant ? (
                <div className="space-y-8">
                    {Object.entries(groupedAutomations).map(([tenant, tenantAutomations]) => (
                        <div key={tenant} className="space-y-4">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                                {tenant === "Platform Global" ? "Platform Global Defaults" : `Tenant: ${tenant.slice(0, 8)}...`}
                            </h2>
                            <div className="grid gap-4">
                                {tenantAutomations.map(auto => (
                                    <AutomationCard key={auto.id} auto={auto} getIcon={getIcon} getTimingLabel={getTimingLabel} fetcher={fetcher} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredAutomations.map((auto) => (
                        <AutomationCard key={auto.id} auto={auto} getIcon={getIcon} getTimingLabel={getTimingLabel} fetcher={fetcher} />
                    ))}
                </div>
            )}
        </div>
    );
}

function AutomationCard({ auto, getIcon, getTimingLabel, fetcher }: { auto: Automation, getIcon: any, getTimingLabel: any, fetcher: any }) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-full shrink-0">
                {getIcon(auto.triggerEvent)}
            </div>

            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{auto.subject}</h3>
                    <Badge variant={auto.isEnabled ? "default" : "outline"}>
                        {auto.isEnabled ? "Active" : "Paused"}
                    </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimingLabel(auto)}
                    </span>
                    <span className="capitalize px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                        Trigger: {
                            auto.triggerEvent === 'absent' ? 'Student Absent (Re-engage)' :
                                auto.triggerEvent === 'new_student' ? 'New Student Signup' :
                                    auto.triggerEvent.replace('_', ' ')
                        }
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4 pt-4 sm:pt-0 border-t sm:border-0 border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${auto.id}`} className="sr-only">Enable</Label>
                    <Switch
                        checked={auto.isEnabled}
                        onCheckedChange={(checked) => {
                            fetcher.submit(
                                { _action: 'update', id: auto.id, isEnabled: String(checked) },
                                { method: 'post' }
                            );
                        }}
                    />
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Edit "{auto.subject}"</DialogTitle>
                        </DialogHeader>
                        <WorkflowForm
                            initialData={auto}
                            onSubmit={(formData) => {
                                formData.append('_action', 'update');
                                formData.append('id', auto.id);
                                fetcher.submit(formData, { method: 'post' });
                            }}
                        />
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" className="text-zinc-400 hover:text-red-500 hover:bg-zinc-100">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Workflow?</DialogTitle>
                            <DialogDescription>
                                This action cannot be undone. Typically we recommend pausing instead.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="destructive" onClick={() => {
                                fetcher.submit({ _action: 'delete', id: auto.id }, { method: 'post' });
                            }}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

interface WorkflowFormProps {
    initialData?: Automation;
    onSubmit: (formData: FormData) => void;
}

function WorkflowForm({ initialData, onSubmit }: WorkflowFormProps) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit(formData);
    };

    const getLabel = (type: string) => {
        switch (type) {
            case 'new_student': return 'New Student Signup';
            case 'birthday': return 'Birthday';
            case 'absent': return 'Student Absent (Re-engage)';
            case 'trial_ending': return 'Trial Ending';
            default: return type.replace('_', ' ');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <Select
                        name="triggerEvent"
                        defaultValue={initialData?.triggerEvent || "new_student"}
                    >
                        <option value="new_student">New Student Signup</option>
                        <option value="birthday">Birthday</option>
                        <option value="absent">Student Absent (Re-engage)</option>
                        <option value="trial_ending">Trial Ending Soon</option>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Timing</Label>
                    <div className="flex items-center gap-2">
                        <Select
                            name="timingType"
                            defaultValue={initialData?.timingType || "immediate"}
                            className="w-[140px]"
                        >
                            <option value="immediate">Immediately</option>
                            <option value="delay">Wait (Delay)</option>
                            <option value="before">Before Event</option>
                            <option value="after">After Event</option>
                        </Select>
                        <Input
                            name="timingValue"
                            type="number"
                            defaultValue={initialData?.timingValue || 0}
                            placeholder="Hours"
                            className="w-20"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                    name="subject"
                    defaultValue={initialData?.subject}
                    required
                    placeholder="e.g. Welcome to the family!"
                />
            </div>

            <div className="space-y-2">
                <Label>Email Content</Label>
                <Textarea
                    name="content"
                    defaultValue={initialData?.content}
                    required
                    placeholder="Hello {firstname}..."
                    className="h-32 font-mono"
                />
                <p className="text-xs text-zinc-500">Supported variables: {'{firstname}'}, {'{lastname}'}, {'{tenant}'} (Studio Name).</p>
            </div>

            <DialogFooter className="mt-4 flex justify-end gap-2">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Workflow</Button>
            </DialogFooter>
        </form>
    );
}
