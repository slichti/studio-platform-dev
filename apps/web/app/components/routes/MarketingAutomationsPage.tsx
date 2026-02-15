
import { useLoaderData, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import { Zap, Plus, Play, Pause, Trash2, Mail, MessageSquare, Users, Clock, X, Calendar, Target, Bell, Sparkles, Loader2, ArrowRight, Check } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { toast } from "sonner";
import { AutomationCard } from "../marketing/AutomationCard";
import { TemplateSelector } from "../marketing/TemplateSelector";

const TRIGGERS = [
    { id: 'new_member', label: 'New Member Signs Up', icon: Users, description: "Send a welcome email when someone joins." },
    { id: 'class_booked', label: 'Class Booked', icon: Calendar, description: "Confirm a booking or send a reminder." },
    { id: 'class_missed', label: 'Class No-Show', icon: Target, description: "Follow up with members who missed class." },
    { id: 'inactive_days', label: 'Inactive for X Days', icon: Clock, description: "Re-engage members who haven't visited." },
    { id: 'birthday', label: 'Member Birthday', icon: Bell, description: "Send a birthday wish or gift." },
    { id: 'membership_expiring', label: 'Membership Expiring', icon: Clock, description: "Remind members to renew." },
    { id: 'product_purchase', label: 'Product Purchased', icon: Zap, description: "Thank you email or cross-sell." },
];

const TIMING_TYPES = [
    { id: 'immediate', label: 'Immediately' },
    { id: 'delay', label: 'Delay (Hours)' },
    { id: 'before', label: 'Before Event (Hours)' },
];

export default function MarketingAutomationsPageComponent() {
    const { automations, stats } = useLoaderData<any>();
    const submit = useSubmit();
    const [isCreating, setIsCreating] = useState(false);
    const [automationToDelete, setAutomationToDelete] = useState<string | null>(null);
    const [editingAutomation, setEditingAutomation] = useState<any>(null);

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
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Marketing Automations</h1>
                        <p className="text-zinc-500 dark:text-zinc-400">Engage your community with automated workflows.</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                    >
                        <Plus size={18} /> Create Workflow
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-8 py-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Stats Row */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard label="Active Workflows" value={stats.activeCount || 0} color="text-green-600 dark:text-green-400" />
                            <StatCard label="Emails Sent (30d)" value={stats.emailsSent || 0} color="text-blue-600 dark:text-blue-400" />
                            <StatCard label="Open Rate" value="--%" color="text-violet-600 dark:text-violet-400" />
                            <StatCard label="Total Workflows" value={stats.totalAutomations || 0} color="text-zinc-600 dark:text-zinc-400" />
                        </div>
                    )}

                    {/* Content Grid */}
                    {automations.length === 0 ? (
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
                            {/* "Add New" Card */}
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

function CreateAutomationModal({ onClose, onSave, initialData }: any) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [trigger, setTrigger] = useState("new_member");
    const [timingType, setTimingType] = useState("immediate");
    const [timingValue, setTimingValue] = useState("0");
    const [audienceType, setAudienceType] = useState("all");
    const [ageMin, setAgeMin] = useState("");
    const [ageMax, setAgeMax] = useState("");
    const [addCoupon, setAddCoupon] = useState(false);
    const [couponType, setCouponType] = useState("percent");
    const [couponValue, setCouponValue] = useState("10");
    const [couponValidity, setCouponValidity] = useState("7");
    const [contentType, setContentType] = useState("template"); // Default to template for better UX
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [aiGenerating, setAiGenerating] = useState(false);

    const handleAiGenerate = async () => {
        // ... (AI logic remains the same)
        toast.info("AI Generation simulation: Content populated.");
        setSubject("Welcome to our community! 🎉");
        setContent("We are thrilled to have you...");
    };

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || initialData.subject || "");
            setTrigger(initialData.triggerEvent || "new_member");
            setTimingType(initialData.timingType || "immediate");
            setTimingValue(String(initialData.timingValue || 0));
            // ... (rest of hydration logic)
            if (initialData.templateId) {
                setContentType("template");
                setTemplateId(initialData.templateId);
            } else {
                setContentType("simple");
                setContent(initialData.content || "");
            }
            setSubject(initialData.subject || "");
        }
    }, [initialData]);

    const handleSubmit = () => {
        const payload: any = { name, trigger, timingType, timingValue: parseInt(timingValue) || 0, isActive: true };
        if (audienceType === 'filter') payload.audienceFilter = { ageMin: parseInt(ageMin), ageMax: parseInt(ageMax) };
        if (addCoupon) payload.couponConfig = { type: couponType, value: parseInt(couponValue), validityDays: parseInt(couponValidity) };
        if (contentType === 'template') { payload.templateId = templateId; payload.subject = subject || "Notification"; }
        else { payload.subject = subject; payload.content = content; }
        onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {/* Modal Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{initialData ? 'Edit Workflow' : 'New Workflow'}</h2>
                        <p className="text-sm text-zinc-500">Step {step} of 4</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1">
                    <div className="h-full bg-violet-600 transition-all duration-500 ease-out" style={{ width: `${(step / 4) * 100}%` }} />
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="max-w-2xl mx-auto">
                        {step === 1 && (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Workflow Name</label>
                                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all" placeholder="e.g., Welcome Series" autoFocus />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">Select Trigger</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {TRIGGERS.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setTrigger(t.id)}
                                                className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] flex items-start gap-3 ${trigger === t.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 ring-1 ring-violet-500' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                            >
                                                <div className={`p-2 rounded-lg shrink-0 ${trigger === t.id ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                                    <t.icon size={18} />
                                                </div>
                                                <div>
                                                    <div className={`font-bold text-sm ${trigger === t.id ? 'text-violet-900 dark:text-violet-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{t.label}</div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{t.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex gap-4 items-center">
                                    <Clock className="text-zinc-400" />
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Timing</label>
                                            <select value={timingType} onChange={(e) => setTimingType(e.target.value)} className="w-full bg-transparent font-medium outline-none">
                                                {TIMING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        {timingType !== 'immediate' && (
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Hours</label>
                                                <input type="number" value={timingValue} onChange={(e) => setTimingValue(e.target.value)} className="w-full bg-transparent font-medium outline-none" placeholder="0" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                                <h3 className="text-lg font-bold">Audience Filtering</h3>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${audienceType === 'all' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'bg-white dark:bg-zinc-900 border-zinc-200'}`}>
                                        <input type="radio" checked={audienceType === 'all'} onChange={() => setAudienceType('all')} className="hidden" />
                                        <div className="font-bold mb-1">All Members</div>
                                        <div className="text-sm text-zinc-500">Send to every member who matches the trigger.</div>
                                    </label>
                                    <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${audienceType === 'filter' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'bg-white dark:bg-zinc-900 border-zinc-200'}`}>
                                        <input type="radio" checked={audienceType === 'filter'} onChange={() => setAudienceType('filter')} className="hidden" />
                                        <div className="font-bold mb-1">Filtered Segment</div>
                                        <div className="text-sm text-zinc-500">Target specific demographics.</div>
                                    </label>
                                </div>
                                {audienceType === 'filter' && (
                                    <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <label className="block text-sm font-bold mb-3">Age Range</label>
                                        <div className="flex items-center gap-4">
                                            <input value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="Min" className="w-24 px-3 py-2 border rounded-lg text-center" />
                                            <span className="text-zinc-400">-</span>
                                            <input value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="Max" className="w-24 px-3 py-2 border rounded-lg text-center" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                                <div className="text-center">
                                    <h3 className="text-lg font-bold mb-2">Design Your Email</h3>
                                    <p className="text-zinc-500 text-sm">Choose a template or write from scratch.</p>
                                </div>

                                <input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-4 py-3 text-lg font-medium border-b-2 border-zinc-200 dark:border-zinc-800 bg-transparent outline-none focus:border-violet-500 transition-colors placeholder:text-zinc-400"
                                    placeholder="Email Subject Line..."
                                />

                                <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-6">
                                    <button onClick={() => setContentType('template')} className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${contentType === 'template' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>Template Gallery</button>
                                    <button onClick={() => setContentType('simple')} className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${contentType === 'simple' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>Simple Text</button>
                                </div>

                                {contentType === 'template' ? (
                                    <TemplateSelector selectedId={templateId} onSelect={setTemplateId} />
                                ) : (
                                    <div className="space-y-4">
                                        <textarea
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            className="w-full h-64 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none resize-none font-mono text-sm leading-relaxed"
                                            placeholder="Write your email content here. Supports Markdown..."
                                        />
                                        <button onClick={handleAiGenerate} className="text-sm font-bold text-violet-600 flex items-center gap-2 hover:underline">
                                            <Sparkles size={14} /> Generate with AI
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300 text-center py-10">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Check size={40} />
                                </div>
                                <h2 className="text-2xl font-black mb-2">Ready to Launch?</h2>
                                <p className="text-zinc-500 max-w-md mx-auto mb-8">
                                    Your automation "{name}" is set to trigger on <strong>{TRIGGERS.find(t => t.id === trigger)?.label}</strong>.
                                </p>

                                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-2xl max-w-sm mx-auto text-left border border-zinc-200 dark:border-zinc-800">
                                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Summary</div>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Trigger</span>
                                            <span className="font-medium">{TRIGGERS.find(t => t.id === trigger)?.label}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Timing</span>
                                            <span className="font-medium">{timingType === 'immediate' ? 'Immediately' : `${timingValue}h ${timingType}`}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Content</span>
                                            <span className="font-medium">{contentType === 'template' ? 'Template: ' + templateId : 'Custom Text'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex justify-between items-center sticky bottom-0 z-10">
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} className="px-6 py-2.5 font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                            Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <button
                        onClick={step < 4 ? () => setStep(step + 1) : handleSubmit}
                        className="px-8 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full font-bold hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                    >
                        {step < 4 ? <>Next <ArrowRight size={16} /></> : 'Launch Workflow'}
                    </button>
                </div>
            </div>
        </div>
    );
}
