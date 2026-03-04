import { useLoaderData, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import {
    Zap, Plus, Play, Pause, Trash2, Mail, MessageSquare,
    Users, Clock, X, Calendar, Target, Bell, Sparkles,
    Loader2, ArrowRight, Check, Save, ChevronRight, Edit, MoreVertical
} from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { AutomationCard } from "../marketing/AutomationCard";
import { AutomationCanvas, type AutomationStep } from "../marketing/AutomationCanvas";

export const TRIGGERS = [
    { id: 'new_member', label: 'New Member Signs Up', icon: Users, description: "Send a welcome email when someone joins." },
    { id: 'class_booked', label: 'Class Booked', icon: Calendar, description: "Confirm a booking or send a reminder." },
    { id: 'class_missed', label: 'Class No-Show', icon: Target, description: "Follow up with members who missed class." },
    { id: 'inactive_days', label: 'Inactive for X Days', icon: Clock, description: "Re-engage members who haven't visited." },
    { id: 'birthday', label: 'Member Birthday', icon: Bell, description: "Send a birthday wish or gift." },
    { id: 'membership_expiring', label: 'Membership Expiring', icon: Clock, description: "Remind members to renew." },
    { id: 'product_purchase', label: 'Product Purchased', icon: Zap, description: "Thank you email or cross-sell." },
    { id: 'waitlist_promoted', label: 'Waitlist Spot Available', icon: Bell, description: "Notify a member when a spot opens up." },
    { id: 'pack_credits_low', label: 'Pack Credits Running Low', icon: Zap, description: "Alert when a class pack has ≤ 2 credits left." },
];

export default function MarketingAutomationsPageComponent() {
    const { automations, stats } = useLoaderData<any>();
    const submit = useSubmit();
    const [isCreating, setIsCreating] = useState(false);
    const [automationToDelete, setAutomationToDelete] = useState<string | null>(null);
    const [editingAutomation, setEditingAutomation] = useState<any>(null);
    const [view, setView] = useState<'my' | 'recommended'>('my');
    const [recommended, setRecommended] = useState<any[]>([]);
    const [isFetchingRecommended, setIsFetchingRecommended] = useState(false);

    useEffect(() => {
        if (view === 'recommended' && recommended.length === 0) {
            fetchRecommended();
        }
    }, [view]);

    const fetchRecommended = async () => {
        setIsFetchingRecommended(true);
        try {
            const res = await fetch('/api/marketing/automations/recommended');
            const data = await res.json() as any[];
            setRecommended(data);
        } catch (e) {
            toast.error("Failed to load recommendations");
        } finally {
            setIsFetchingRecommended(false);
        }
    };

    const handleAdopt = (templateId: string) => {
        const formData = new FormData();
        formData.append("intent", "adopt");
        formData.append("templateId", templateId);
        submit(formData, { method: "post" });
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 1000)),
            {
                loading: 'Adopting automation...',
                success: 'Automation added to your studio! It is paused for review.',
                error: 'Failed to adopt automation',
            }
        );
        setView('my');
    };

    const handleToggle = (id: string) => {
        submit({ intent: 'toggle', id }, { method: 'post' });
        toast.success("Automation status updated");
    };

    const handleDelete = (id: string) => {
        setAutomationToDelete(id);
    };

    const handleConfirmDelete = () => {
        if (automationToDelete) {
            submit({ intent: 'delete', id: automationToDelete }, { method: 'post' });
            setAutomationToDelete(null);
            toast.success("Automation deleted");
        }
    };

    const openCreate = () => {
        setEditingAutomation(null);
        setIsCreating(true);
    };

    const openEdit = (auto: any) => {
        setEditingAutomation(auto);
        setIsCreating(true);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Marketing Automations</h1>
                        <p className="text-zinc-500 dark:text-zinc-400">Engage your community with automated workflows.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => setView('my')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${view === 'my' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                            >
                                My Studio
                            </button>
                            <button
                                onClick={() => setView('recommended')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${view === 'recommended' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                            >
                                Recommended
                            </button>
                        </div>
                        <Button onClick={openCreate} className="rounded-full px-6 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                            <Plus size={18} className="mr-2" /> Create Workflow
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-8 py-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard label="Active Workflows" value={stats.activeCount || 0} color="text-green-600 dark:text-green-400" />
                            <StatCard label="Emails Sent (30d)" value={stats.emailsSent || 0} color="text-blue-600 dark:text-blue-400" />
                            <StatCard label="Open Rate" value="--%" color="text-violet-600 dark:text-violet-400" />
                            <StatCard label="Total Workflows" value={stats.totalAutomations || 0} color="text-zinc-600 dark:text-zinc-400" />
                        </div>
                    )}

                    {view === 'my' ? (
                        automations.length === 0 ? (
                            <div className="text-center py-32 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Zap size={32} className="text-zinc-300 dark:text-zinc-600" />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No automations yet</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto">Start building your first automated workflow to engage your members.</p>
                                <button onClick={openCreate} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Create your first workflow →</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {automations.map((auto: any) => (
                                    <AutomationCard
                                        key={auto.id}
                                        automation={auto}
                                        onEdit={openEdit}
                                        onToggle={handleToggle}
                                        onDelete={handleDelete}
                                        TRIGGERS={TRIGGERS}
                                    />
                                ))}
                                <button
                                    onClick={openCreate}
                                    className="group flex flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors min-h-[300px]"
                                >
                                    <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus size={24} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                                    </div>
                                    <span className="font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">Create New Workflow</span>
                                </button>
                            </div>
                        )
                    ) : view === 'recommended' && isFetchingRecommended ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <Loader2 className="animate-spin text-zinc-400" size={32} />
                            <p className="text-zinc-500 font-medium">Loading premium templates...</p>
                        </div>
                    ) : view === 'recommended' && recommended.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recommended.map((auto: any) => (
                                <AutomationCard
                                    key={auto.id}
                                    automation={auto}
                                    onAdopt={handleAdopt}
                                    isRecommendation={true}
                                    TRIGGERS={TRIGGERS}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Sparkles size={32} className="text-zinc-300 dark:text-zinc-600" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Check back later</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto">We're updating our collection of high-performing email workflows.</p>
                        </div>
                    )}
                </div>
            </div>

            {isCreating && (
                <CreateAutomationModal
                    initialData={editingAutomation}
                    onClose={() => setIsCreating(false)}
                    onSave={(data: any) => {
                        const formData = new FormData();
                        formData.append("intent", editingAutomation ? "update" : "create");
                        if (editingAutomation) formData.append("id", editingAutomation.id);
                        for (const key of Object.keys(data)) {
                            if (typeof data[key] === 'object') formData.append(key, JSON.stringify(data[key]));
                            else formData.append(key, data[key]);
                        }
                        submit(formData, { method: "post" });
                        setIsCreating(false);
                        toast.success(editingAutomation ? "Workflow updated" : "Workflow created");
                    }}
                />
            )}

            <ConfirmDialog
                open={!!automationToDelete}
                onOpenChange={(open) => !open && setAutomationToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Workflow"
                description="Are you sure you want to delete this automation? This action cannot be undone."
                confirmText="Delete Workflow"
                variant="destructive"
            />
        </div>
    );
}

function StatCard({ label, value, color }: { label: string, value: string | number, color: string }) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className={`text-3xl font-black ${color} mb-1 tracking-tight`}>{value}</div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</div>
        </div>
    );
}

export function CreateAutomationModal({ onClose, onSave, initialData }: any) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState(initialData?.name || "");
    const [trigger, setTrigger] = useState(initialData?.triggerEvent || "new_member");
    const [steps, setSteps] = useState<AutomationStep[]>(initialData?.steps || []);

    const handleSubmit = () => {
        const payload: any = {
            name,
            triggerEvent: trigger,
            steps,
            isEnabled: true
        };
        onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {/* Modal Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{initialData ? 'Edit Workflow' : 'New Workflow'}</h2>
                        <p className="text-sm text-zinc-500">Step {step} of 2</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1">
                    <div className="h-full bg-indigo-600 transition-all duration-500 ease-out" style={{ width: `${(step / 2) * 100}%` }} />
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8 bg-zinc-50 dark:bg-zinc-900/50">
                    {step === 1 && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-8 duration-300">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Workflow Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="e.g., Welcome Series"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3 text-center">What triggers this automation?</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {TRIGGERS.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTrigger(t.id)}
                                            className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${trigger === t.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'}`}
                                        >
                                            <div className={`p-3 rounded-xl shrink-0 ${trigger === t.id ? 'bg-indigo-500 text-white' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                                                <t.icon size={20} />
                                            </div>
                                            <div>
                                                <div className={`font-bold ${trigger === t.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{t.label}</div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{t.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="h-full -mx-8 -my-8">
                            <AutomationCanvas
                                steps={steps}
                                onChange={setSteps}
                                triggerEvent={trigger}
                            />
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between bg-white dark:bg-zinc-950 sticky bottom-0 z-10">
                    <Button variant="secondary" onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
                        {step === 1 ? 'Cancel' : 'Back'}
                    </Button>
                    <div className="flex gap-3">
                        {step < 2 ? (
                            <Button onClick={() => setStep(step + 1)} disabled={!name} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                                Next: Design Flow <ChevronRight size={18} className="ml-1" />
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Save size={18} className="mr-2" /> Save Workflow
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
