
// @ts-ignore
import { useLoaderData, useFetcher } from "react-router";
// @ts-ignore
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog";
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
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        const automations = await apiRequest<Automation[]>('/studios/marketing/automations', token, {}, apiUrl);
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
            await apiRequest('/studios/marketing/automations', token, {
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

            await apiRequest(`/studios/marketing/automations/${id}`, token, {
                method: 'PATCH',
                body: JSON.stringify(data)
            }, apiUrl);
        } else if (actionType === 'delete') {
            const id = formData.get('id') as string;
            await apiRequest(`/studios/marketing/automations/${id}`, token, {
                method: 'DELETE'
            }, apiUrl);
        } else if (actionType === 'test') {
            const id = formData.get('id') as string;
            const email = formData.get('email') as string;
            await apiRequest(`/studios/marketing/automations/${id}/test`, token, {
                method: 'POST',
                body: JSON.stringify({ email })
            }, apiUrl);
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export default function AdminWorkflows() {
    const { automations } = useLoaderData<{ automations: Automation[] }>();
    const fetcher = useFetcher();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

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

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Marketing Workflows</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Automate your student communication lifecycle.</p>
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

            <div className="grid gap-4">
                {automations.map((auto) => (
                    <div key={auto.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
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
                                    Trigger: {auto.triggerEvent.replace('_', ' ')}
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
                ))}
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

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <Select
                        name="triggerEvent"
                        defaultValue={initialData?.triggerEvent || "new_student"}
                        disabled={!!initialData}
                    >
                        <option value="new_student">New Student Signup</option>
                        <option value="birthday">Birthday</option>
                        <option value="absent">Student Absent (Re-engage)</option>
                        <option value="trial_ending">Trial Ending Soon</option>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Timing</Label>
                    <div className="flex gap-2">
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
                <p className="text-xs text-zinc-500">Supported variables: {'{firstname}'}, {'{lastname}'}.</p>
            </div>

            <DialogFooter className="mt-4">
                <Button type="submit">Save Workflow</Button>
            </DialogFooter>
        </form>
    );
}
