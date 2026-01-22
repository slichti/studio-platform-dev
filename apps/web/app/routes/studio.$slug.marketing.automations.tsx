// @ts-ignore
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useSubmit, Form, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Zap, Plus, Play, Pause, Trash2, Mail, MessageSquare, Users, Clock, ChevronRight, X, Settings, Calendar, Target, Bell, Pencil } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();
    const tenantSlug = slug || '';

    try {
        const [automationsData, statsData] = await Promise.all([
            apiRequest('/marketing/automations', token, { headers: { 'X-Tenant-Slug': tenantSlug } }),
            apiRequest('/marketing/automations/stats', token, { headers: { 'X-Tenant-Slug': tenantSlug } }).catch(() => null)
        ]) as any[];

        return { automations: automationsData?.automations || [], stats: statsData };
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
    const tenantSlug = slug || '';

    if (intent === 'create' || intent === 'update') {
        const data: any = {};
        for (const [key, val] of formData.entries()) {
            if (key === 'intent') continue;
            try {
                data[key] = JSON.parse(val as string);
            } catch (e) {
                data[key] = val;
            }
        }

        if (intent === 'update') {
            const id = data.id;
            await apiRequest(`/marketing/automations/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: JSON.stringify(data)
            });
        } else {
            await apiRequest('/marketing/automations', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: JSON.stringify(data)
            });
        }
        return { success: true };
    }

    if (intent === 'toggle') {
        const id = formData.get("id");
        await apiRequest(`/marketing/automations/${id}/toggle`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': tenantSlug }
        });
        return { success: true };
    }

    if (intent === 'delete') {
        const id = formData.get("id");
        await apiRequest(`/marketing/automations/${id}`, token, {
            method: 'DELETE',
            headers: { 'X-Tenant-Slug': tenantSlug }
        });
        return { success: true };
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
    // New Events
    { id: 'product_purchase', label: 'Product Purchased', icon: Zap },
    { id: 'subscription_canceled', label: 'Subscription Canceled (Period End)', icon: X },
    { id: 'subscription_terminated', label: 'Subscription Terminated', icon: Trash2 },
    { id: 'student_updated', label: 'Student Profile Updated', icon: Users },
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
                        onClick={openCreate}
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
                        <button onClick={openCreate} className="text-sm text-zinc-900 underline">Create your first</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {automations.map((auto: any) => {
                            const trigger = TRIGGERS.find(t => t.id === auto.triggerEvent || t.id === auto.trigger); // Support both naming just in case
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
                                            <button
                                                onClick={() => openEdit(auto)}
                                                className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500"
                                                title="Edit"
                                            >
                                                <Pencil size={16} />
                                            </button>
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

            {/* Create/Edit Modal */}
            {isCreating && (
                <CreateAutomationModal
                    initialData={editingAutomation}
                    onClose={() => setIsCreating(false)}
                    onSave={(data: any) => {
                        const formData = new FormData();
                        formData.append("intent", editingAutomation ? "update" : "create");
                        if (editingAutomation) formData.append("id", editingAutomation.id);

                        for (const key of Object.keys(data)) {
                            if (typeof data[key] === 'object') {
                                formData.append(key, JSON.stringify(data[key]));
                            } else {
                                formData.append(key, data[key]);
                            }
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
                description="Are you sure you want to delete this automation? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    );
}

const TIMING_TYPES = [
    { id: 'immediate', label: 'Immediately' },
    { id: 'delay', label: 'Delay (Hours)' },
    { id: 'before', label: 'Before Event (Hours)' },
];

import { useEffect } from "react";

function CreateAutomationModal({ onClose, onSave, initialData }: { onClose: () => void; onSave: (data: any) => void; initialData?: any }) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [trigger, setTrigger] = useState("new_student");

    // Timing
    const [timingType, setTimingType] = useState("immediate");
    const [timingValue, setTimingValue] = useState("0");

    // Audience
    const [audienceType, setAudienceType] = useState("all"); // all, filter
    const [ageMin, setAgeMin] = useState("");
    const [ageMax, setAgeMax] = useState("");

    // Coupon
    const [addCoupon, setAddCoupon] = useState(false);
    const [couponType, setCouponType] = useState("percent"); // percent, amount
    const [couponValue, setCouponValue] = useState("10");
    const [couponValidity, setCouponValidity] = useState("7");

    // Content
    const [contentType, setContentType] = useState("simple"); // simple, template
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [templateId, setTemplateId] = useState("");

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || initialData.subject || "");
            setTrigger(initialData.triggerEvent || "new_student");
            setTimingType(initialData.timingType || "immediate");
            setTimingValue(String(initialData.timingValue || 0));

            // Audience
            if (initialData.audienceFilter) {
                setAudienceType("filter");
                setAgeMin(initialData.audienceFilter.ageMin ? String(initialData.audienceFilter.ageMin) : "");
                setAgeMax(initialData.audienceFilter.ageMax ? String(initialData.audienceFilter.ageMax) : "");
            }

            // Coupon
            if (initialData.couponConfig) {
                setAddCoupon(true);
                setCouponType(initialData.couponConfig.type || "percent");
                setCouponValue(String(initialData.couponConfig.value || 10));
                setCouponValidity(String(initialData.couponConfig.validityDays || 7));
            }

            // Content
            if (initialData.templateId) {
                setContentType("template");
                setTemplateId(initialData.templateId);
                setSubject(initialData.subject || "");
            } else {
                setContentType("simple");
                setSubject(initialData.subject || "");
                setContent(initialData.content || "");
            }
        }
    }, [initialData]);

    const totalSteps = 4;

    const handleSubmit = () => {
        const payload: any = {
            name,
            trigger,
            triggerConfig: {}, // Default
            actions: [], // Legacy/Unused
            isActive: true,
            timingType,
            timingValue: parseInt(timingValue) || 0
        };

        // Audience
        if (audienceType === 'filter') {
            payload.audienceFilter = {};
            if (ageMin) payload.audienceFilter.ageMin = parseInt(ageMin);
            if (ageMax) payload.audienceFilter.ageMax = parseInt(ageMax);
        }

        // Coupon
        if (addCoupon) {
            payload.couponConfig = {
                type: couponType,
                value: parseInt(couponValue),
                validityDays: parseInt(couponValidity)
            };
        }

        // Content
        if (contentType === 'template') {
            payload.templateId = templateId;
            // Subject might be optional if template overrides, but good to have fallback
            payload.subject = subject || "Notification";
            payload.content = "Template: " + templateId;
        } else {
            payload.subject = subject;
            payload.content = content;
        }

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">{initialData ? 'Edit Automation' : 'Create Automation'}</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>

                <div className="p-6">
                    {/* Progress Bar */}
                    <div className="flex gap-2 mb-6">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-purple-600' : 'bg-zinc-100'}`} />
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Automation Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="e.g., Welcome Series" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-2">Trigger</label>
                                <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto pr-1">
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

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-2">Timing</label>
                                <div className="flex bg-zinc-100 p-1 rounded-lg mb-2">
                                    {TIMING_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTimingType(t.id)}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded-md ${timingType === t.id ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                {timingType !== 'immediate' && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={timingValue}
                                            onChange={(e) => setTimingValue(e.target.value)}
                                            className="w-24 px-3 py-2 border border-zinc-200 rounded-lg"
                                        />
                                        <span className="text-sm text-zinc-500">hours</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-zinc-900">Audience Targeting</h3>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input type="radio" name="aud" checked={audienceType === 'all'} onChange={() => setAudienceType('all')} />
                                    <span>All Members</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" name="aud" checked={audienceType === 'filter'} onChange={() => setAudienceType('filter')} />
                                    <span>Filtered</span>
                                </label>
                            </div>

                            {audienceType === 'filter' && (
                                <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 rounded-lg">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Min Age</label>
                                        <input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="18" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Max Age</label>
                                        <input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="65" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-zinc-900">Sweeteners</h3>
                            <div className="p-4 border border-zinc-200 rounded-lg">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${addCoupon ? 'bg-purple-600 border-purple-600' : 'border-zinc-300'}`}>
                                            {addCoupon && <CheckIcon size={12} className="text-white" />}
                                        </div>
                                        <div>
                                            <span className="font-medium text-sm">Generate Unique Coupon</span>
                                            <p className="text-xs text-zinc-500">Include a single-use code in the email.</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={addCoupon} onChange={(e) => setAddCoupon(e.target.checked)} className="hidden" />
                                </label>

                                {addCoupon && (
                                    <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-2 gap-4">
                                        <div className="col-span-2 flex bg-zinc-100 p-1 rounded-lg">
                                            <button onClick={() => setCouponType('percent')} className={`flex-1 py-1 text-xs font-medium rounded-md ${couponType === 'percent' ? 'bg-white shadow' : 'text-zinc-500'}`}>Percentage Off</button>
                                            <button onClick={() => setCouponType('amount')} className={`flex-1 py-1 text-xs font-medium rounded-md ${couponType === 'amount' ? 'bg-white shadow' : 'text-zinc-500'}`}>Flat Amount</button>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Value</label>
                                            <div className="relative">
                                                <input type="number" value={couponValue} onChange={(e) => setCouponValue(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-zinc-200 rounded-lg" />
                                                <span className="absolute left-3 top-2 text-zinc-400 text-sm">{couponType === 'percent' ? '%' : '$'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Expires In (Days)</label>
                                            <input type="number" value={couponValidity} onChange={(e) => setCouponValidity(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-zinc-900">Email Content</h3>

                            {/* Subject is always needed (at least as fallback/title) */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Subject Line</label>
                                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="Welcome!" />
                            </div>

                            <div className="flex gap-4 border-b border-zinc-100 pb-2">
                                <button onClick={() => setContentType('simple')} className={`pb-2 text-sm font-medium ${contentType === 'simple' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-zinc-500'}`}>Simple Text</button>
                                <button onClick={() => setContentType('template')} className={`pb-2 text-sm font-medium ${contentType === 'template' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-zinc-500'}`}>Resend Template</button>
                            </div>

                            {contentType === 'simple' ? (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Message Body</label>
                                    <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg h-32" placeholder="Start typing... Use {{firstName}} for variables." />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Template ID</label>
                                    <input type="text" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="re_123456789" />
                                    <p className="text-xs text-zinc-500 mt-1">
                                        Variables sent: generic data + <code>title</code>, <code>address</code>, <code>firstName</code>, <code>couponCode</code>.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-200 flex justify-between">
                    {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-sm text-zinc-500">Back</button>}

                    {step < 4 ? (
                        <button onClick={() => setStep(step + 1)} disabled={!name && step === 1} className="ml-auto px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm disabled:opacity-50">Next</button>
                    ) : (
                        <button onClick={handleSubmit} disabled={contentType === 'simple' ? !content : !templateId} className="ml-auto px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm disabled:opacity-50">{initialData ? 'Save Changes' : 'Create Automation'}</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function CheckIcon({ size, className }: { size?: number, className?: string }) {
    return (
        <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    )
}
