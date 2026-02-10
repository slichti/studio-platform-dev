
import { useLoaderData, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import { Zap, Plus, Play, Pause, Trash2, Mail, MessageSquare, Users, Clock, X, Calendar, Target, Bell, Pencil, Sparkles, Loader2 } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { toast } from "sonner";

const TRIGGERS = [
    { id: 'new_member', label: 'New Member Signs Up', icon: Users },
    { id: 'class_booked', label: 'Class Booked', icon: Calendar },
    { id: 'class_missed', label: 'Class No-Show', icon: Target },
    { id: 'inactive_days', label: 'Inactive for X Days', icon: Clock },
    { id: 'birthday', label: 'Member Birthday', icon: Bell },
    { id: 'membership_expiring', label: 'Membership Expiring', icon: Clock },
    { id: 'product_purchase', label: 'Product Purchased', icon: Zap },
    { id: 'subscription_canceled', label: 'Subscription Canceled (Period End)', icon: X },
    { id: 'subscription_terminated', label: 'Subscription Terminated', icon: Trash2 },
    { id: 'student_updated', label: 'Student Profile Updated', icon: Users },
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
    };

    const handleDelete = (id: string) => {
        setAutomationToDelete(id);
    };

    const handleConfirmDelete = () => {
        if (automationToDelete) {
            submit({ intent: 'delete', id: automationToDelete }, { method: 'post' });
            setAutomationToDelete(null);
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
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg text-white"><Zap size={20} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Automations</h1>
                            <p className="text-sm text-zinc-500">Set up automated email & SMS campaigns</p>
                        </div>
                    </div>
                    <button onClick={openCreate} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 flex items-center gap-2">
                        <Plus size={16} /> Create Automation
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
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

                {automations.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-zinc-200">
                        <Zap size={48} className="mx-auto mb-4 text-zinc-300" />
                        <p className="text-zinc-500 mb-4">No automations yet</p>
                        <button onClick={openCreate} className="text-sm text-zinc-900 underline">Create your first</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {automations.map((auto: any) => {
                            const trigger = TRIGGERS.find(t => t.id === auto.triggerEvent || t.id === auto.trigger);
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
                                                    <h3 className="font-bold text-zinc-900">{auto.name || auto.subject}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${auto.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                                        {auto.isActive ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-500 mt-1">Trigger: {trigger?.label || auto.triggerEvent}</p>
                                                {auto.timingType !== 'immediate' && (
                                                    <p className="text-xs text-zinc-400 mt-1">
                                                        Timing: {auto.timingType === 'delay' ? `Delay ${auto.timingValue}h` : `Before ${auto.timingValue}h`}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                                                    <span>Runs: {auto.runCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openEdit(auto)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500"><Pencil size={16} /></button>
                                            <button onClick={() => handleToggle(auto.id)} className={`p-2 rounded-lg ${auto.isActive ? 'hover:bg-yellow-50 text-yellow-600' : 'hover:bg-green-50 text-green-600'}`}>
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
                    }}
                />
            )}

            <ConfirmDialog
                open={!!automationToDelete}
                onOpenChange={(open) => !open && setAutomationToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Automation"
                description="Are you sure you want to delete this automation?"
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    );
}

function CreateAutomationModal({ onClose, onSave, initialData }: any) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [trigger, setTrigger] = useState("new_student");
    const [timingType, setTimingType] = useState("immediate");
    const [timingValue, setTimingValue] = useState("0");
    const [audienceType, setAudienceType] = useState("all");
    const [ageMin, setAgeMin] = useState("");
    const [ageMax, setAgeMax] = useState("");
    const [addCoupon, setAddCoupon] = useState(false);
    const [couponType, setCouponType] = useState("percent");
    const [couponValue, setCouponValue] = useState("10");
    const [couponValidity, setCouponValidity] = useState("7");
    const [contentType, setContentType] = useState("simple");
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [aiGenerating, setAiGenerating] = useState(false);

    const handleAiGenerate = async () => {
        setAiGenerating(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const slug = window.location.pathname.split('/')[2];
            const response = await fetch(`${(import.meta as any).env.VITE_API_URL || ''}/marketing/automations/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': slug },
                body: JSON.stringify({ trigger })
            });
            const data = await response.json() as any;
            if (data.success) {
                setSubject(data.subject);
                setContent(data.content);
                setContentType('simple');
            }
        } finally {
            setAiGenerating(false);
        }
    };

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || initialData.subject || "");
            setTrigger(initialData.triggerEvent || "new_student");
            setTimingType(initialData.timingType || "immediate");
            setTimingValue(String(initialData.timingValue || 0));
            if (initialData.audienceFilter) {
                setAudienceType("filter");
                setAgeMin(String(initialData.audienceFilter.ageMin || ""));
                setAgeMax(String(initialData.audienceFilter.ageMax || ""));
            }
            if (initialData.couponConfig) {
                setAddCoupon(true);
                setCouponType(initialData.couponConfig.type || "percent");
                setCouponValue(String(initialData.couponConfig.value || 10));
                setCouponValidity(String(initialData.couponConfig.validityDays || 7));
            }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                <div className="p-4 border-b flex justify-between items-center text-zinc-900 dark:text-zinc-100">
                    <h2 className="text-lg font-bold">{initialData ? 'Edit Automation' : 'Create Automation'}</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="p-6">
                    <div className="flex gap-2 mb-6">
                        {[1, 2, 3, 4].map(s => <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-purple-600' : 'bg-zinc-100'}`} />)}
                    </div>
                    {step === 1 && (
                        <div className="space-y-4">
                            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Automation Name" />
                            <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto">
                                {TRIGGERS.map(t => (
                                    <button key={t.id} onClick={() => setTrigger(t.id)} className={`p-3 rounded-lg border text-left flex items-center gap-2 ${trigger === t.id ? 'border-purple-500 bg-purple-50' : 'hover:bg-zinc-50'}`}>
                                        <t.icon size={16} /> <span className="text-sm">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                            <select value={timingType} onChange={(e) => setTimingType(e.target.value)} className="w-full p-2 border rounded-lg">
                                {TIMING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            {timingType !== 'immediate' && <input type="number" value={timingValue} onChange={(e) => setTimingValue(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Hours" />}
                        </div>
                    )}
                    {step === 2 && (
                        <div className="space-y-4">
                            <label className="flex items-center gap-2"><input type="radio" checked={audienceType === 'all'} onChange={() => setAudienceType('all')} /> All Members</label>
                            <label className="flex items-center gap-2"><input type="radio" checked={audienceType === 'filter'} onChange={() => setAudienceType('filter')} /> Filtered</label>
                            {audienceType === 'filter' && <div className="flex gap-2"><input value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="Min Age" className="p-2 border rounded flex-1" /><input value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="Max Age" className="p-2 border rounded flex-1" /></div>}
                        </div>
                    )}
                    {step === 3 && (
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={addCoupon} onChange={(e) => setAddCoupon(e.target.checked)} /> Add Coupon
                            </label>
                            {addCoupon && (
                                <div className="space-y-2">
                                    <select value={couponType} onChange={(e) => setCouponType(e.target.value)} className="w-full p-2 border rounded">
                                        <option value="percent">Percentage</option>
                                        <option value="amount">Amount</option>
                                    </select>
                                    <input value={couponValue} onChange={(e) => setCouponValue(e.target.value)} placeholder="Value" className="w-full p-2 border rounded" />
                                    <input value={couponValidity} onChange={(e) => setCouponValidity(e.target.value)} placeholder="Validity (Days)" className="w-full p-2 border rounded" />
                                </div>
                            )}
                        </div>
                    )}
                    {step === 4 && (
                        <div className="space-y-4">
                            <button onClick={handleAiGenerate} disabled={aiGenerating} className="w-full py-2 bg-purple-600 text-white rounded gap-2 flex items-center justify-center">
                                {aiGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />} AI Generate
                            </button>
                            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-2 border rounded" placeholder="Subject" />
                            <div className="flex gap-2">
                                <button onClick={() => setContentType('simple')} className={`flex-1 p-2 ${contentType === 'simple' ? 'bg-zinc-100 font-bold' : ''}`}>Simple</button>
                                <button onClick={() => setContentType('template')} className={`flex-1 p-2 ${contentType === 'template' ? 'bg-zinc-100 font-bold' : ''}`}>Template</button>
                            </div>
                            {contentType === 'simple' ? <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-32 p-2 border rounded" /> : <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full p-2 border rounded" placeholder="Template ID" />}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t flex justify-between">
                    {step > 1 && <button onClick={() => setStep(step - 1)} className="p-2">Back</button>}
                    <button onClick={step < 4 ? () => setStep(step + 1) : handleSubmit} className="ml-auto px-6 py-2 bg-zinc-900 text-white rounded">
                        {step < 4 ? 'Next' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
