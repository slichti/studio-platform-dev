// @ts-ignore
import { useLoaderData, useFetcher } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Send, Mail, CheckCircle, AlertTriangle, Sparkles, Pencil, X, Zap, Clock, Calendar, Plus, Trash2 } from "lucide-react"; // Added Plus, Trash2
import { Modal } from "~/components/Modal";
import { RichTextEditor } from "~/components/RichTextEditor";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    let campaigns = [];
    let automations = [];
    try {
        const [campRes, autoRes] = await Promise.all([
            apiRequest("/marketing", token, { headers: { 'X-Tenant-Slug': slug } }) as Promise<any>,
            apiRequest("/marketing/automations", token, { headers: { 'X-Tenant-Slug': slug } }) as Promise<any>
        ]);
        campaigns = campRes.campaigns || [];
        automations = autoRes.automations || [];
    } catch (e) {
        console.error("Failed to load marketing data", e);
    }

    return { campaigns, automations, slug };
};

export default function MarketingPage() {
    const { campaigns: initialCampaigns, automations: initialAutomations, slug } = useLoaderData<any>();
    const { getToken } = useAuth();
    const [tab, setTab] = useState<'broadcast' | 'automation'>('broadcast');

    // UI Feedback State
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Broadcast State
    const [campaigns, setCampaigns] = useState(initialCampaigns);
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const [filters, setFilters] = useState({
        ageMin: 0,
        ageMax: 100,
        preset: "all"
    });

    // Automation State
    const [automations, setAutomations] = useState(initialAutomations || []);
    const [editingAuto, setEditingAuto] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        subject: "",
        content: "",
        isEnabled: false,
        timingType: 'immediate',
        timingValue: 0,
        triggerEvent: '',
        triggerCondition: '{}', // Display as string
        channels: ['email'],
        couponConfig: { enabled: false, type: 'percent', value: 20, validityDays: 7 }
    });

    // Test Email Modal State
    const [testModal, setTestModal] = useState<{ isOpen: boolean, automationId: string | null, email: string }>({
        isOpen: false,
        automationId: null,
        email: ""
    });
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Helper for notifications
    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };
    const [testEmail, setTestEmail] = useState("");

    async function handleSendBroadcast(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/marketing", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    subject,
                    content,
                    filters: filters.preset === "all" ? {} : { ageMin: filters.ageMin, ageMax: filters.ageMax }
                })
            });

            if (res.error) {
                showNotification(res.error, 'error');
            } else {
                showNotification(`Campaign Sent to ${res.count} recipients!`);
                setSubject("");
                setContent("");
                const refreshed: any = await apiRequest("/marketing", token, { headers: { 'X-Tenant-Slug': slug } });
                setCampaigns(refreshed.campaigns || []);
            }
        } catch (e: any) {
            showNotification("Failed to send: " + e.message, 'error');
        } finally {
            setSending(false);
        }
    }

    async function handleCreateAutomation() {
        try {
            const token = await getToken();
            const res: any = await apiRequest("/marketing/automations", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    triggerEvent: 'new_student',
                    subject: 'New Automation'
                })
            });
            if (res.error) throw new Error(res.error);
            setAutomations([...automations, res]);
            // Open edit immediately
            setEditingAuto(res);
            setEditForm({
                subject: res.subject,
                content: res.content,
                isEnabled: res.isEnabled,
                timingType: res.timingType || 'immediate',
                timingValue: res.timingValue || 0,
                triggerEvent: res.triggerEvent,
                triggerCondition: JSON.stringify(res.triggerCondition || {}, null, 2),
                channels: res.channels || ['email'],
                couponConfig: res.couponConfig ? { ...res.couponConfig, enabled: true } : { enabled: false, type: 'percent', value: 20, validityDays: 7 }
            });
        } catch (e: any) {
            showNotification("Failed to create: " + e.message, 'error');
        }
    }

    async function handleUpdateAutomation(e: React.FormEvent) {
        e.preventDefault();
        if (!editingAuto) return;
        try {
            // Parse condition if we allow editing (JSON)
            let parsedCondition = null;
            try {
                parsedCondition = editForm.triggerCondition ? JSON.parse(editForm.triggerCondition) : null;
            } catch (err) {
                showNotification("Invalid JSON in Condition field", 'error');
                return;
            }

            const token = await getToken();
            const payload = {
                ...editForm,
                triggerCondition: parsedCondition
            };

            const res: any = await apiRequest(`/marketing/automations/${editingAuto.id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(payload)
            });

            // Update local state
            setAutomations(automations.map((a: any) => a.id === editingAuto.id ? res : a));
            setEditingAuto(null);
            showNotification("Automation updated successfully");
        } catch (e: any) {
            showNotification("Failed to update: " + e.message, 'error');
        }
    }

    async function handleDeleteAutomation(id: string) {
        if (!confirm("Are you sure you want to delete this automation? This cannot be undone.")) return;
        try {
            const token = await getToken();
            await apiRequest(`/marketing/automations/${id}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug }
            });
            setAutomations(automations.filter((a: any) => a.id !== id));
            showNotification("Automation deleted.");
        } catch (e: any) {
            showNotification("Failed to delete: " + e.message, 'error');
        }
    }

    function openTestModal(id: string) {
        setTestModal({ isOpen: true, automationId: id, email: testModal.email });
    }

    async function handleSendTestSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!testModal.automationId || !testModal.email) return;

        setIsSendingTest(true);
        try {
            const token = await getToken();
            await apiRequest(`/marketing/automations/${testModal.automationId}/test`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ email: testModal.email })
            });
            showNotification("Test email sent!");
            setTestModal({ ...testModal, isOpen: false });
        } catch (e: any) {
            showNotification("Failed to test: " + e.message, 'error');
        } finally {
            setIsSendingTest(false);
        }
    }

    const triggerLabels: any = {
        'new_student': 'New Student Welcome',
        'birthday': 'Birthday Greeting',
        'absent': 'Win-back (Absent)',
        'class_attended': 'Class Follow-up',
        'order_completed': 'Order Follow-up',
        'trial_ending': 'Trial Ending',
        'subscription_renewing': 'Subscription Renewing'
    };

    const getTimingLabel = (auto: any) => {
        if (auto.timingType === 'immediate') return 'Immediate';
        if (auto.timingType === 'delay') return `Delay: ${auto.timingValue} hours`;
        if (auto.timingType === 'before') return `${auto.timingValue} hours Before`;
        if (auto.timingType === 'after') return `${auto.timingValue} hours After`;
        // Fallback for legacy delayHours
        if (auto.delayHours > 0) return `Delay: ${auto.delayHours} hours`;
        return 'Immediate';
    };

    async function toggleAutomation(auto: any) {
        try {
            const newState = !auto.isEnabled;
            // Optimistic update
            setAutomations(automations.map((a: any) => a.id === auto.id ? { ...a, isEnabled: newState } : a));

            const token = await getToken();
            await apiRequest(`/marketing/automations/${auto.id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ isEnabled: newState })
            });
        } catch (e: any) {
            showNotification("Failed to toggle: " + e.message, 'error');
            // Revert
            setAutomations(automations.map((a: any) => a.id === auto.id ? { ...a, isEnabled: !auto.isEnabled } : a));
        }
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 relative">
            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300 ${notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                    {notification.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                    <span className="font-medium text-sm">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70"><X className="h-4 w-4" /></button>
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900">Marketing</h1>
                <p className="text-zinc-500">Engage your students with broadcasts and automations.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-zinc-200">
                <button
                    onClick={() => setTab('broadcast')}
                    className={`pb-3 px-1 font-medium text-sm transition-colors relative ${tab === 'broadcast' ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    Broadcasts
                    {tab === 'broadcast' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
                </button>
                <button
                    onClick={() => setTab('automation')}
                    className={`pb-3 px-1 font-medium text-sm transition-colors relative ${tab === 'automation' ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    Automations
                    {tab === 'automation' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
                </button>
            </div>

            {tab === 'broadcast' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Compose */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
                            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <Mail className="h-5 w-5 text-blue-600" />
                                New Broadcast
                            </h2>
                            <form onSubmit={handleSendBroadcast} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Subject Line</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        className="w-full border border-zinc-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. November Newsletter"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Message Content</label>
                                    <RichTextEditor
                                        value={content}
                                        onChange={setContent}
                                        placeholder="Write your beautiful email content..."
                                        className="min-h-[300px]"
                                    />
                                    <div className="flex justify-between items-start mt-1">
                                        <p className="text-xs text-zinc-400">Rich text enabled. Use the toolbar to format.</p>
                                        <div className="text-xs text-zinc-500 text-right">
                                            Variables: <span className="font-mono bg-zinc-100 px-1 rounded">{"{{firstName}}"}</span> <span className="font-mono bg-zinc-100 px-1 rounded">{"{{studioName}}"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg">
                                    <label className="block text-sm font-semibold text-zinc-800 mb-3">Target Audience</label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {[
                                            { label: "All Students", value: "all", min: 0, max: 100 },
                                            { label: "Youth (<18)", value: "youth", min: 0, max: 17 },
                                            { label: "Adults (18-64)", value: "adults", min: 18, max: 64 },
                                            { label: "Seniors (65+)", value: "seniors", min: 65, max: 100 },
                                            { label: "Custom", value: "custom", min: filters.ageMin, max: filters.ageMax },
                                        ].map(p => (
                                            <button
                                                key={p.value}
                                                type="button"
                                                onClick={() => setFilters({ ...filters, preset: p.value, ageMin: p.min, ageMax: p.max })}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.preset === p.value
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                                                    }`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>

                                    {filters.preset === "custom" && (
                                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1">
                                            <div className="flex-1">
                                                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Min Age</label>
                                                <input
                                                    type="number"
                                                    value={filters.ageMin}
                                                    onChange={e => setFilters({ ...filters, ageMin: Number(e.target.value) })}
                                                    className="w-full border border-zinc-300 rounded px-2 py-1 text-sm outline-none"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Max Age</label>
                                                <input
                                                    type="number"
                                                    value={filters.ageMax}
                                                    onChange={e => setFilters({ ...filters, ageMax: Number(e.target.value) })}
                                                    className="w-full border border-zinc-300 rounded px-2 py-1 text-sm outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {sending ? "Sending..." : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                Send Broadcast
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right: History */}
                    <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-6 h-fit">
                        <h3 className="font-semibold text-zinc-700 mb-4">Recent Campaigns</h3>
                        <div className="space-y-4">
                            {campaigns.length === 0 && <p className="text-sm text-zinc-500 italic">No campaigns yet.</p>}

                            {campaigns.map((c: any) => (
                                <div key={c.id} className="bg-white border border-zinc-200 rounded p-3 shadow-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-sm text-zinc-900 line-clamp-1">{c.subject}</span>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${c.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {c.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-2">
                                        {new Date(c.sentAt).toLocaleDateString()}
                                    </p>
                                    <div className="flex gap-3 text-xs text-zinc-600">
                                        <span className="flex items-center gap-1">
                                            <Send className="h-3 w-3" />
                                            {c.stats?.sent || 0} Sent
                                        </span>
                                        {c.filters && (
                                            <span className="flex items-center gap-1 bg-zinc-100 px-1.5 rounded">
                                                {c.filters.ageMin}-{c.filters.ageMax} yrs
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'automation' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg border border-zinc-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-semibold text-lg flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-amber-500" />
                                    Active Automations
                                </h2>
                                <p className="text-sm text-zinc-500">
                                    These emails are sent automatically based on student activity.
                                </p>
                            </div>
                            <button
                                onClick={handleCreateAutomation}
                                className="flex items-center gap-2 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-zinc-800"
                            >
                                <Plus className="h-4 w-4" />
                                New Automation
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {automations.map((auto: any) => (
                                <div key={auto.id} className="group border border-zinc-200 rounded-lg px-4 py-3 flex items-center justify-between hover:border-blue-300 transition-colors bg-white">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`p-1.5 rounded-full shrink-0 ${auto.isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <h3 className="font-medium text-zinc-900 whitespace-nowrap shrink-0">{triggerLabels[auto.triggerEvent] || auto.triggerEvent || auto.triggerType}</h3>

                                            <span className="flex items-center gap-1 bg-zinc-50 px-2 py-0.5 rounded text-xs text-zinc-500 whitespace-nowrap shrink-0 border border-zinc-100">
                                                <Clock className="w-3 h-3" />
                                                {getTimingLabel(auto)}
                                            </span>

                                            <span className="text-sm text-zinc-500 truncate min-w-0">
                                                {auto.subject}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0 ml-4">
                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => toggleAutomation(auto)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${auto.isEnabled ? 'bg-blue-600' : 'bg-zinc-200'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${auto.isEnabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>

                                        <button
                                            onClick={() => openTestModal(auto.id)}
                                            className="text-xs text-zinc-500 hover:text-zinc-800 p-2 hover:bg-zinc-100 rounded"
                                            title="Send Test"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingAuto(auto);
                                                setEditForm({
                                                    subject: auto.subject,
                                                    content: auto.content,
                                                    isEnabled: auto.isEnabled,
                                                    timingType: auto.timingType || (auto.delayHours > 0 ? 'delay' : 'immediate'),
                                                    timingValue: auto.timingValue || auto.delayHours || 0,
                                                    triggerEvent: auto.triggerEvent || auto.triggerType,
                                                    triggerCondition: JSON.stringify(auto.triggerCondition || {}, null, 2),
                                                    channels: auto.channels || ['email'],
                                                    couponConfig: auto.couponConfig ? { ...auto.couponConfig, enabled: true } : { enabled: false, type: 'percent', value: 20, validityDays: 7 }
                                                });
                                            }}
                                            className="text-xs text-zinc-500 hover:text-blue-600 p-2 hover:bg-blue-50 rounded"
                                            title="Edit"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAutomation(auto.id)}
                                            className="text-xs text-zinc-500 hover:text-red-600 p-2 hover:bg-red-50 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Test Email Modal */}
            <Modal
                isOpen={testModal.isOpen}
                onClose={() => setTestModal({ ...testModal, isOpen: false })}
                title="Send Test Email"
            >
                <form onSubmit={handleSendTestSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">To Email Address</label>
                        <input
                            type="email"
                            value={testModal.email}
                            onChange={e => setTestModal({ ...testModal, email: e.target.value })}
                            className="w-full border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="you@example.com"
                            autoFocus
                            required
                        />
                        <p className="text-xs text-zinc-500 mt-1">This will send a real email to the address above.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setTestModal({ ...testModal, isOpen: false })}
                            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSendingTest}
                            className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {isSendingTest ? 'Sending...' : 'Send Test'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Automation Modal */}
            <Modal
                isOpen={!!editingAuto}
                onClose={() => setEditingAuto(null)}
                title={`Edit Automation`}
                maxWidth="max-w-2xl"
            >
                {editingAuto && (
                    <form onSubmit={handleUpdateAutomation} className="flex flex-col h-full">
                        {/* Scrollable Body */}
                        <div className="flex-1 overflow-y-auto max-h-[70vh] pr-2 space-y-4">

                            {/* Enable Toggle */}
                            <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                                <span className="text-sm font-medium text-zinc-900">Automation Status</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editForm.isEnabled}
                                        onChange={e => setEditForm({ ...editForm, isEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-zinc-700">{editForm.isEnabled ? 'Enabled' : 'Disabled'}</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Trigger Event</label>
                                    <select
                                        value={editForm.triggerEvent}
                                        onChange={e => setEditForm({ ...editForm, triggerEvent: e.target.value })}
                                        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm bg-white"
                                    >
                                        {Object.entries(triggerLabels).map(([key, label]: any) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Timing Rule</label>
                                            <select
                                                value={editForm.timingType}
                                                onChange={e => setEditForm({ ...editForm, timingType: e.target.value })}
                                                className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm bg-white"
                                            >
                                                <option value="immediate">Immediately</option>
                                                <option value="delay">Delay (Wait)</option>
                                                <option value="before">Before Event</option>
                                                <option value="after">After Event</option>
                                            </select>
                                        </div>
                                        {editForm.timingType !== 'immediate' && (
                                            <div className="w-20">
                                                <label className="block text-xs font-medium text-zinc-500 mb-1">Hours</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editForm.timingValue}
                                                    onChange={e => setEditForm({ ...editForm, timingValue: parseInt(e.target.value) || 0 })}
                                                    className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm bg-white"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Trigger Conditions */}
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Trigger Conditions (JSON)</label>
                                <textarea
                                    value={editForm.triggerCondition}
                                    onChange={e => setEditForm({ ...editForm, triggerCondition: e.target.value })}
                                    className="w-full border border-zinc-300 rounded px-2 py-1 text-xs font-mono h-12 bg-zinc-50"
                                    placeholder='{ "planId": "..." }'
                                ></textarea>
                            </div>


                            <div className="flex flex-col gap-1">
                                <label className="block text-xs font-medium text-zinc-500">Channels</label>
                                <div className="flex gap-4 items-center">
                                    <label className="flex items-center gap-2 text-sm bg-white border border-zinc-200 rounded px-3 py-1.5">
                                        <input
                                            type="checkbox"
                                            checked={(editForm.channels as string[]).includes('email')}
                                            onChange={e => {
                                                const current = editForm.channels as string[];
                                                const next = e.target.checked
                                                    ? [...current, 'email']
                                                    : current.filter(c => c !== 'email');
                                                setEditForm({ ...editForm, channels: next });
                                            }}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Email
                                    </label>
                                    <span className="text-xs text-zinc-400">SMS Coming Soon</span>
                                </div>
                            </div>

                            {/* Coupon Config Section - Compact */}
                            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={(editForm.couponConfig as any).enabled}
                                        onChange={e => setEditForm({
                                            ...editForm,
                                            couponConfig: { ...(editForm.couponConfig as any), enabled: e.target.checked }
                                        })}
                                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                    />
                                    <span className="text-sm font-medium text-zinc-900">Include Discount Coupon</span>
                                </label>

                                {(editForm.couponConfig as any).enabled && (
                                    <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
                                        <div>
                                            <label className="block text-[10px] font-medium text-zinc-500 mb-1">Type</label>
                                            <select
                                                value={(editForm.couponConfig as any).type}
                                                onChange={e => setEditForm({
                                                    ...editForm,
                                                    couponConfig: { ...(editForm.couponConfig as any), type: e.target.value }
                                                })}
                                                className="w-full border border-zinc-300 rounded px-2 py-1 text-xs"
                                            >
                                                <option value="percent">Percent (%)</option>
                                                <option value="amount">Amount ($)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-zinc-500 mb-1">Value</label>
                                            <input
                                                type="number"
                                                value={(editForm.couponConfig as any).value}
                                                onChange={e => setEditForm({
                                                    ...editForm,
                                                    couponConfig: { ...(editForm.couponConfig as any), value: parseInt(e.target.value) || 0 }
                                                })}
                                                className="w-full border border-zinc-300 rounded px-2 py-1 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-zinc-500 mb-1">Validity (Days)</label>
                                            <input
                                                type="number"
                                                value={(editForm.couponConfig as any).validityDays}
                                                onChange={e => setEditForm({
                                                    ...editForm,
                                                    couponConfig: { ...(editForm.couponConfig as any), validityDays: parseInt(e.target.value) || 7 }
                                                })}
                                                className="w-full border border-zinc-300 rounded px-2 py-1 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Subject Line</label>
                                <input
                                    type="text"
                                    value={editForm.subject}
                                    onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                                    className="w-full border border-zinc-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Content</label>
                                <RichTextEditor
                                    value={editForm.content}
                                    onChange={(html) => setEditForm({ ...editForm, content: html })}
                                    placeholder="Write your automation content..."
                                    className="min-h-[200px]"
                                />
                                <div className="flex gap-2 mt-1 text-[10px] text-zinc-500 flex-wrap">
                                    <span>Variables:</span>
                                    <code className="bg-zinc-100 px-1 rounded">{"{{firstName}}"}</code>
                                    <code className="bg-zinc-100 px-1 rounded">{"{{lastName}}"}</code>
                                    <code className="bg-zinc-100 px-1 rounded">{"{{email}}"}</code>
                                    <code className="bg-zinc-100 px-1 rounded">{"{{title}}"}</code>
                                    <code className="bg-zinc-100 px-1 rounded">{"{{address}}"}</code>
                                    {(editForm.couponConfig as any).enabled && <code className="bg-yellow-100 text-yellow-800 px-1 rounded">{"{{coupon_code}}"}</code>}
                                </div>
                            </div>
                        </div>

                        {/* Footer (Fixed) */}
                        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-zinc-100">
                            <button
                                type="button"
                                onClick={() => setEditingAuto(null)}
                                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
