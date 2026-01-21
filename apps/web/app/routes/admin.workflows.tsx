
import { useLoaderData, useFetcher } from "@remix-run/react";
import { json, LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useState } from "react";
import {
    Cake,
    UserPlus,
    CalendarClock,
    AlertCircle,
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    Play,
    CheckCircle2,
    XCircle,
    Clock
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { api } from "~/utils/api";

export const loader: LoaderFunction = async ({ request, context }) => {
    const response = await api(request, context).get('/studios/marketing/automations');
    if (!response.ok) throw new Response("Failed to load automations", { status: response.status });
    return json(await response.json());
};

export const action: ActionFunction = async ({ request, context }) => {
    const formData = await request.formData();
    const actionType = formData.get('_action');
    const client = api(request, context);

    if (actionType === 'create') {
        const data = {
            triggerEvent: formData.get('triggerEvent'),
            subject: formData.get('subject'),
            content: formData.get('content'),
            timingType: formData.get('timingType'),
            timingValue: Number(formData.get('timingValue'))
        };
        await client.post('/studios/marketing/automations', data);
    } else if (actionType === 'update') {
        const id = formData.get('id') as string;
        const data: any = {};
        if (formData.has('isEnabled')) data.isEnabled = formData.get('isEnabled') === 'true';
        if (formData.has('subject')) data.subject = formData.get('subject');
        if (formData.has('content')) data.content = formData.get('content');
        if (formData.has('timingType')) data.timingType = formData.get('timingType');
        if (formData.has('timingValue')) data.timingValue = Number(formData.get('timingValue'));

        await client.patch(`/studios/marketing/automations/${id}`, data);
    } else if (actionType === 'delete') {
        const id = formData.get('id') as string;
        await client.delete(`/studios/marketing/automations/${id}`);
    } else if (actionType === 'test') {
        const id = formData.get('id') as string;
        const email = formData.get('email') as string;
        await client.post(`/studios/marketing/automations/${id}/test`, { email });
    }

    return json({ success: true });
};

export default function AdminWorkflows() {
    const { automations } = useLoaderData<any>();
    const fetcher = useFetcher();
    const [editingId, setEditingId] = useState<string | null>(null);
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

    const getTimingLabel = (auto: any) => {
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
                {automations.map((auto: any) => (
                    <div key={auto.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-full shrink-0">
                            {getIcon(auto.triggerEvent)}
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{auto.subject}</h3>
                                <Badge variant={auto.isEnabled ? "default" : "secondary"}>
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
                                    id={`toggle-${auto.id}`}
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
                                    <Button variant="outline" size="sm">
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
                                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delete Workflow?</DialogTitle>
                                    </DialogHeader>
                                    <p className="text-zinc-500">This action cannot be undone. Typically we recommend pausing instead.</p>
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

function WorkflowForm({ initialData, onSubmit }: { initialData?: any, onSubmit: (data: FormData) => void }) {
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
                    <Select name="triggerEvent" defaultValue={initialData?.triggerEvent || "new_student"} disabled={!!initialData}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="new_student">New Student Signup</SelectItem>
                            <SelectItem value="birthday">Birthday</SelectItem>
                            <SelectItem value="absent">Student Absent (Re-engage)</SelectItem>
                            <SelectItem value="trial_ending">Trial Ending Soon</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Timing</Label>
                    <div className="flex gap-2">
                        <Select name="timingType" defaultValue={initialData?.timingType || "immediate"}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="immediate">Immediately</SelectItem>
                                <SelectItem value="delay">Wait (Delay)</SelectItem>
                                <SelectItem value="before">Before Event</SelectItem>
                                <SelectItem value="after">After Event</SelectItem>
                            </SelectContent>
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
                <Input name="subject" defaultValue={initialData?.subject} required placeholder="e.g. Welcome to the family!" />
            </div>

            <div className="space-y-2">
                <Label>Email Content</Label>
                <Textarea
                    name="content"
                    defaultValue={initialData?.content}
                    required
                    placeholder="Hello {firstname}..."
                    className="h-32 font-mono text-sm"
                />
                <p className="text-xs text-zinc-500">Supported variables: {'{firstname}'}, {'{lastname}'}.</p>
            </div>

            <DialogFooter>
                <Button type="submit">Save Workflow</Button>
            </DialogFooter>
        </form>
    );
}
