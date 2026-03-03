
import { useAuth } from "@clerk/react-router";
import { useState } from "react";
import { useOutletContext } from "react-router";
import {
    Mail, Plus, Trash2, Save, Send, Settings, Sparkles, Clock, AlertCircle, ChevronRight, Check, X, Pencil, Filter, ChevronDown, CheckCircle, AlertTriangle, Zap, Calendar, Users, GripVertical
} from "lucide-react";
import { Modal } from "~/components/Modal";
import { RichTextEditor } from "~/components/RichTextEditor";
import { apiRequest } from "~/utils/api";

export default function MarketingPageComponent({ campaigns: initialCampaigns, automations: initialAutomations, slug }: { campaigns: any[], automations: any[], slug: string }) {
    const { getToken } = useAuth();
    const [tab, setTab] = useState<'broadcast' | 'automation' | 'settings'>('broadcast');

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
        isEnabled: false,
        triggerEvent: '',
        conditions: [] as { field: string, operator: string, value: string }[], // Visual builder state
        daysBefore: 0,
        steps: [] as any[]
    });
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

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

    // Email Settings State (from tenant branding)
    const { tenant } = useOutletContext<any>();
    const [replyTo, setReplyTo] = useState(tenant?.branding?.emailReplyTo || '');
    const [footerText, setFooterText] = useState(tenant?.branding?.emailFooterText || '');
    const [savingSettings, setSavingSettings] = useState(false);

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

    const [openFieldDropdown, setOpenFieldDropdown] = useState<number | null>(null);

    // Recommended Fields Mapping
    const recommendedFields: Record<string, string[]> = {
        'membership_started': ['planName', 'price'],
        'subscription_canceled': ['planName'],
        'class_milestone': ['milestone'],
        'class_noshow': ['classTitle', 'instructorName'],
        'credits_low': ['remainingCredits'],
        'booking_cancelled': ['classTitle', 'instructorName'],
        'new_student': ['source'],
    };

    async function handleCreateAutomation() {
        const newAuto = {
            id: null, // Temporary ID indicating new
            isEnabled: false,
            triggerEvent: 'new_student',
            triggerCondition: {},
            steps: []
        };

        setEditingAuto(newAuto);

        setActiveStepIndex(null);

        setEditForm({
            isEnabled: newAuto.isEnabled,
            triggerEvent: newAuto.triggerEvent,
            conditions: [],
            daysBefore: 0,
            steps: newAuto.steps
        });
    }

    async function handleUpdateAutomation(e: React.FormEvent) {
        e.preventDefault();
        if (!editingAuto) return;

        try {
            const token = await getToken();

            // Convert visual conditions back to JSON object
            const conditionObject: any = {};
            editForm.conditions.forEach(c => {
                if (c.field && c.value) {
                    // Try to parse numbers if value looks numeric
                    const isNum = !isNaN(Number(c.value)) && c.value.trim() !== '';
                    conditionObject[c.field] = isNum ? Number(c.value) : c.value;
                }
            });

            if (editForm.triggerEvent === 'birthday' && editForm.daysBefore > 0) {
                conditionObject.daysBefore = editForm.daysBefore;
            }

            const payload = {
                isEnabled: editForm.isEnabled,
                triggerEvent: editForm.triggerEvent,
                triggerCondition: conditionObject,
                steps: editForm.steps
            };

            if (editingAuto.id) {
                // UPDATE existing
                const res: any = await apiRequest(`/marketing/automations/${editingAuto.id}`, token, {
                    method: "PATCH",
                    headers: { 'X-Tenant-Slug': slug },
                    body: JSON.stringify(payload)
                });
                setAutomations(automations.map((a: any) => a.id === editingAuto.id ? res : a));
                showNotification("Automation updated successfully");
            } else {
                // CREATE new
                const res: any = await apiRequest("/marketing/automations", token, {
                    method: "POST",
                    headers: { 'X-Tenant-Slug': slug },
                    body: JSON.stringify(payload)
                });
                if (res.error) throw new Error(res.error);
                setAutomations([...automations, { id: res.id, ...payload }]);
                showNotification("Automation created successfully");
            }

            setEditingAuto(null);
        } catch (e: any) {
            showNotification("Failed to save: " + e.message, 'error');
        }
    }

    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, automationId: string | null }>({
        isOpen: false,
        automationId: null
    });

    function handleDeleteAutomation(id: string) {
        setDeleteModal({ isOpen: true, automationId: id });
    }

    async function confirmDeleteAutomation() {
        if (!deleteModal.automationId) return;

        const id = deleteModal.automationId;
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
        } finally {
            setDeleteModal({ isOpen: false, automationId: null });
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
        'subscription_renewing': 'Subscription Renewing',
        'booking_cancelled': 'Booking Cancelled',
        'class_noshow': 'Class No-Show',
        'subscription_canceled': 'Subscription Canceled',
        'credits_low': 'Low Class Credits',
        'class_milestone': 'Milestone Celebration',
        'membership_started': 'Membership Started'
    };

    const getTimingLabel = (auto: any) => {
        if (auto.timingType === 'immediate') return 'Immediate';
        if (auto.timingType === 'delay') return `Delay: ${auto.timingValue} hours`;
        if (auto.timingType === 'before') return `${auto.timingValue} hours Before`;
        if (auto.timingType === 'after') return `${auto.timingValue} hours After`;
        if (auto.delayHours > 0) return `Delay: ${auto.delayHours} hours`;
        return 'Immediate';
    };

    async function toggleAutomation(auto: any) {
        try {
            const newState = !auto.isEnabled;
            setAutomations(automations.map((a: any) => a.id === auto.id ? { ...a, isEnabled: newState } : a));

            const token = await getToken();
            await apiRequest(`/marketing/automations/${auto.id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ isEnabled: newState })
            });
        } catch (e: any) {
            showNotification("Failed to toggle: " + e.message, 'error');
            setAutomations(automations.map((a: any) => a.id === auto.id ? { ...a, isEnabled: !auto.isEnabled } : a));
        }
    }

    async function handleSaveEmailSettings(e: React.FormEvent) {
        e.preventDefault();
        setSavingSettings(true);
        try {
            const token = await getToken();
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    branding: {
                        emailReplyTo: replyTo,
                        emailFooterText: footerText
                    }
                })
            });
            showNotification("Email settings saved successfully!");
        } catch (e: any) {
            showNotification("Failed to save: " + e.message, 'error');
        } finally {
            setSavingSettings(false);
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
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Email Automations</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Engage your students with broadcasts, automations, and email settings.</p>
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
                <button
                    onClick={() => setTab('settings')}
                    className={`pb-3 px-1 font-medium text-sm transition-colors relative ${tab === 'settings' ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    Settings
                    {tab === 'settings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
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
                                    <div className="flex-1 w-full flex flex-col relative w-full mt-1">
                                        <RichTextEditor
                                            value={content}
                                            onChange={setContent}
                                            placeholder="Write your beautiful email content..."
                                        />
                                    </div>
                                    <div className="flex justify-between items-start mt-2">
                                        <p className="text-xs text-zinc-400">Rich text enabled. Use the toolbar to format.</p>
                                        <div className="text-xs text-zinc-500 text-right flex gap-2 items-center select-none">
                                            <span>Drag Variables:</span>
                                            {["{{firstName}}", "{{studioName}}"].map(v => (
                                                <span
                                                    key={v}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData("text/plain", v);
                                                        e.dataTransfer.effectAllowed = "copy";
                                                    }}
                                                    className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded cursor-grab hover:bg-blue-50 hover:text-blue-600 border border-transparent transition-colors active:cursor-grabbing"
                                                >
                                                    {v}
                                                </span>
                                            ))}
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
                                                setActiveStepIndex(null);
                                                setEditForm({
                                                    isEnabled: auto.isEnabled,
                                                    triggerEvent: auto.triggerEvent || auto.triggerType,
                                                    conditions: (() => {
                                                        const parsed = auto.triggerCondition;
                                                        if (parsed && typeof parsed === 'object') {
                                                            return Object.entries(parsed).map(([key, val]) => ({
                                                                field: key,
                                                                operator: 'equals',
                                                                value: String(val)
                                                            }));
                                                        }
                                                        return [];
                                                    })(),
                                                    daysBefore: Number(auto.triggerCondition?.daysBefore) || 0,
                                                    steps: auto.steps || []
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

            {tab === 'settings' && (
                <div className="max-w-2xl">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Email Settings</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure how your emails appear to students.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveEmailSettings} className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                                    Reply-To Address
                                </label>
                                <input
                                    type="email"
                                    value={replyTo}
                                    onChange={(e) => setReplyTo(e.target.value)}
                                    className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="hello@yourstudio.com"
                                />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    This is the email address students will reply to.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                                    Email Footer Text
                                </label>
                                <textarea
                                    value={footerText}
                                    onChange={(e) => setFooterText(e.target.value)}
                                    className="w-full min-h-[80px] bg-transparent text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                    placeholder="e.g. 123 Yoga St, City, ST 12345"
                                />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    Address or legal text to include at the bottom of every email.
                                </p>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={savingSettings}
                                    className={`bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-opacity ${savingSettings ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {savingSettings ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
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
                maxWidth="max-w-7xl"
            >
                {editingAuto && (
                    <form onSubmit={handleUpdateAutomation} className="flex flex-col h-[80vh]">
                        <div className="flex flex-1 gap-6 overflow-hidden min-h-0 bg-zinc-50 rounded-lg border border-zinc-200">

                            {/* Left Column: Timeline Builder */}
                            <div className="w-1/3 flex flex-col border-r border-zinc-200 bg-white">
                                <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col gap-3 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-zinc-900">Automation Status</span><span className={`ml-2 text-xs font-semibold ${editForm.isEnabled ? "text-emerald-600" : "text-zinc-500"}`}>{editForm.isEnabled ? "Active" : "Paused"}</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editForm.isEnabled}
                                                onChange={e => setEditForm({ ...editForm, isEnabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">When this happens:</label>
                                        <select
                                            value={editForm.triggerEvent}
                                            onChange={e => setEditForm({ ...editForm, triggerEvent: e.target.value })}
                                            className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm bg-white font-medium text-zinc-800 shadow-sm"
                                        >
                                            {Object.entries(triggerLabels).map(([key, label]: any) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {editForm.triggerEvent === 'birthday' && (
                                        <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                                            <label className="block text-xs font-medium text-zinc-700 mb-2">When should this start?</label>
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-2 text-xs">
                                                    <input
                                                        type="radio"
                                                        checked={editForm.daysBefore === 0}
                                                        onChange={() => setEditForm({ ...editForm, daysBefore: 0 })}
                                                        className="text-blue-600 focus:ring-blue-500"
                                                    />
                                                    On their birthday
                                                </label>
                                                <label className="flex items-center gap-2 text-xs">
                                                    <input
                                                        type="radio"
                                                        checked={editForm.daysBefore > 0}
                                                        onChange={() => setEditForm({ ...editForm, daysBefore: editForm.daysBefore || 7 })}
                                                        className="text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Before their birthday
                                                </label>
                                            </div>

                                            {editForm.daysBefore > 0 && (
                                                <div className="mt-3 flex items-center gap-2 pl-6">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={365}
                                                        value={editForm.daysBefore}
                                                        onChange={e => setEditForm({ ...editForm, daysBefore: parseInt(e.target.value) || 0 })}
                                                        className="w-16 h-7 text-xs border border-zinc-200 rounded px-2"
                                                    />
                                                    <span className="text-xs text-zinc-500">Days before</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Trigger Conditions */}
                                    {recommendedFields[String(editForm.triggerEvent)] && (
                                        <div className="mt-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[10px] uppercase font-bold text-zinc-500">Filter Conditions</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm(prev => ({
                                                        ...prev,
                                                        conditions: [...prev.conditions, { field: recommendedFields[String(editForm.triggerEvent)][0], operator: 'equals', value: '' }]
                                                    }))}
                                                    className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    <Plus className="h-3 w-3" /> Add
                                                </button>
                                            </div>
                                            {editForm.conditions.length === 0 ? (
                                                <div className="text-[10px] text-zinc-400 italic">No filters. Runs for all.</div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {editForm.conditions.map((c, i) => (
                                                        <div key={i} className="flex items-center gap-1">
                                                            <select
                                                                value={c.field}
                                                                onChange={e => { const n = [...editForm.conditions]; n[i].field = e.target.value; setEditForm({ ...editForm, conditions: n }); }}
                                                                className="flex-1 min-w-0 border border-zinc-200 rounded px-1.5 py-1 text-[10px] bg-white outline-none"
                                                            >
                                                                {recommendedFields[String(editForm.triggerEvent)].map((rField: string) => (
                                                                    <option key={rField} value={rField}>{rField}</option>
                                                                ))}
                                                            </select>
                                                            <span className="text-[10px] text-zinc-400">=</span>
                                                            {c.field === 'source' ? (
                                                                <select
                                                                    value={c.value}
                                                                    onChange={e => { const n = [...editForm.conditions]; n[i].value = e.target.value; setEditForm({ ...editForm, conditions: n }); }}
                                                                    className="flex-1 min-w-0 border border-zinc-200 rounded px-1.5 py-1 text-[10px] bg-white outline-none"
                                                                >
                                                                    <option value="">Select source...</option>
                                                                    <option value="website">Website</option>
                                                                    <option value="referral">Referral</option>
                                                                    <option value="walk_in">Walk-in</option>
                                                                    <option value="social_media">Social Media</option>
                                                                    <option value="other">Other</option>
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={c.value}
                                                                    onChange={e => { const n = [...editForm.conditions]; n[i].value = e.target.value; setEditForm({ ...editForm, conditions: n }); }}
                                                                    placeholder="value"
                                                                    className="flex-1 min-w-0 border border-zinc-200 rounded px-1.5 py-1 text-[10px] outline-none"
                                                                />
                                                            )}
                                                            <button type="button" onClick={() => setEditForm({ ...editForm, conditions: editForm.conditions.filter((_, idx) => idx !== i) })} className="text-zinc-400 hover:text-red-500 p-0.5"><X className="h-3 w-3" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Timeline */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-0 relative">
                                    <div className="absolute left-8 top-0 bottom-0 w-px bg-zinc-200 z-0"></div>

                                    {editForm.steps.map((step, index) => {
                                        let cumulativeHours = 0;
                                        for (let i = 0; i < index; i++) {
                                            if (editForm.steps[i].type === 'delay') {
                                                cumulativeHours += editForm.steps[i].delayHours || 24;
                                            }
                                        }

                                        let timeText = 'Runs Immediately';
                                        if (cumulativeHours > 0) {
                                            if (cumulativeHours % 168 === 0) {
                                                timeText = `Runs ${cumulativeHours / 168} week${cumulativeHours / 168 > 1 ? 's' : ''} after trigger`;
                                            } else if (cumulativeHours % 24 === 0) {
                                                timeText = `Runs ${cumulativeHours / 24} day${cumulativeHours / 24 > 1 ? 's' : ''} after trigger`;
                                            } else {
                                                timeText = `Runs ${cumulativeHours} hour${cumulativeHours > 1 ? 's' : ''} after trigger`;
                                            }
                                        }
                                        if (step.type === 'delay') {
                                            timeText = timeText.replace('Runs ', 'Wait starts ');
                                        }

                                        return (
                                            <div
                                                key={index}
                                                className="relative z-10 flex items-start gap-2 mb-4 group cursor-pointer"
                                                onClick={() => setActiveStepIndex(index)}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData("stepIndex", index.toString());
                                                    e.dataTransfer.effectAllowed = "move";
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.dataTransfer.dropEffect = "move";
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const fromIndex = Number(e.dataTransfer.getData("stepIndex"));
                                                    if (fromIndex === index || isNaN(fromIndex)) return;
                                                    const newSteps = [...editForm.steps];
                                                    const [moved] = newSteps.splice(fromIndex, 1);
                                                    newSteps.splice(index, 0, moved);
                                                    setEditForm({ ...editForm, steps: newSteps });

                                                    // Maintain active selection
                                                    if (activeStepIndex === fromIndex) {
                                                        setActiveStepIndex(index);
                                                    } else if (activeStepIndex !== null) {
                                                        if (fromIndex < activeStepIndex && index >= activeStepIndex) setActiveStepIndex(activeStepIndex - 1);
                                                        else if (fromIndex > activeStepIndex && index <= activeStepIndex) setActiveStepIndex(activeStepIndex + 1);
                                                    }
                                                }}
                                            >
                                                <div className="mt-3 cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Drag to reorder">
                                                    <GripVertical className="h-4 w-4" />
                                                </div>
                                                <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${activeStepIndex === index ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-zinc-200 text-zinc-400 group-hover:border-blue-300'}`}>
                                                    {step.type === 'delay' ? <Clock className="h-4 w-4" /> : step.type === 'resend_list' ? <Users className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                                                </div>
                                                <div className={`flex-1 rounded-lg border p-3 transition-colors ${activeStepIndex === index ? 'bg-blue-50/30 border-blue-300 ring-1 ring-blue-500' : 'bg-white border-zinc-200 group-hover:bg-zinc-50'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-zinc-900">
                                                                {step.type === 'delay' ? 'Time Delay' : step.type === 'resend_list' ? 'Update List' : 'Send Email'}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100">
                                                                {timeText}
                                                            </span>
                                                        </div>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditForm(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) })); if (activeStepIndex === index) setActiveStepIndex(null); }} className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500 line-clamp-2">
                                                        {step.type === 'delay' ? `Wait ${step.duration || step.delayHours || 24} ${step.unit || 'hours'}` : step.type === 'resend_list' ? (step.action === 'add' ? `Add to List: ${step.listId || 'Unspecified'}` : `Remove from List: ${step.listId || 'Unspecified'}`) : (step.subject || '(No subject)')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="relative z-10 flex items-center gap-3 pt-2 pb-4">
                                        <div className="shrink-0 w-8 flex justify-center">
                                            <div className="w-2 h-2 rounded-full bg-zinc-300"></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => { setEditForm(p => ({ ...p, steps: [...p.steps, { type: 'delay', delayHours: 24, duration: 1, unit: 'days' }] })); setActiveStepIndex(editForm.steps.length); }} className="bg-white border border-dashed border-zinc-300 hover:border-zinc-400 text-zinc-600 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 shadow-sm transition-colors">
                                                <Clock className="w-3.5 h-3.5" /> Add Delay
                                            </button>
                                            <button type="button" onClick={() => { setEditForm(p => ({ ...p, steps: [...p.steps, { type: 'email', subject: 'New Email', content: '', channels: ['email'], couponConfig: { enabled: false } }] })); setActiveStepIndex(editForm.steps.length); }} className="bg-white border border-dashed border-zinc-300 hover:border-blue-400 text-blue-600 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 shadow-sm transition-colors">
                                                <Mail className="w-3.5 h-3.5" /> Add Email
                                            </button>
                                            <button type="button" onClick={() => { setEditForm(p => ({ ...p, steps: [...p.steps, { type: 'resend_list', listId: '', action: 'add' }] })); setActiveStepIndex(editForm.steps.length); }} className="bg-white border border-dashed border-zinc-300 hover:border-emerald-400 text-emerald-600 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 shadow-sm transition-colors">
                                                <Users className="w-3.5 h-3.5" /> List Action
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Step Config & Variables */}
                            <div className="flex-1 flex flex-col min-w-0 bg-white">
                                {activeStepIndex === null ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                                        <Sparkles className="h-10 w-10 text-zinc-200 mb-3" />
                                        <h3 className="text-base font-semibold text-zinc-700">Sequence Editor</h3>
                                        <p className="text-sm mt-1 max-w-xs">Select a step from the timeline on the left to configure it, or add a new step.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-1 overflow-hidden min-h-0">
                                        {/* Step config form */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 pb-4 border-b border-zinc-100">
                                                {editForm.steps[activeStepIndex].type === 'delay' ? <Clock className="h-5 w-5 text-amber-500" /> : editForm.steps[activeStepIndex].type === 'resend_list' ? <Users className="h-5 w-5 text-emerald-500" /> : <Mail className="h-5 w-5 text-blue-500" />}
                                                <h3 className="font-semibold text-lg text-zinc-900">
                                                    {editForm.steps[activeStepIndex].type === 'delay' ? 'Configure Delay' : editForm.steps[activeStepIndex].type === 'resend_list' ? 'Configure List Action' : 'Configure Email Content'}
                                                </h3>
                                            </div>

                                            {editForm.steps[activeStepIndex].type === 'delay' && (
                                                <div className="max-w-xs space-y-4">
                                                    <div className="flex gap-3">
                                                        <div className="flex-1">
                                                            <label className="block text-sm font-medium text-zinc-700 mb-1">Wait Time</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={editForm.steps[activeStepIndex].duration || editForm.steps[activeStepIndex].delayHours || 24}
                                                                onChange={e => {
                                                                    const n = [...editForm.steps];
                                                                    const duration = parseInt(e.target.value) || 0;
                                                                    const unit = n[activeStepIndex].unit || 'hours';
                                                                    n[activeStepIndex].duration = duration;
                                                                    n[activeStepIndex].delayHours = unit === 'days' ? duration * 24 : unit === 'weeks' ? duration * 168 : duration;
                                                                    setEditForm({ ...editForm, steps: n });
                                                                }}
                                                                className="w-full border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="block text-sm font-medium text-zinc-700 mb-1">Unit</label>
                                                            <select
                                                                value={editForm.steps[activeStepIndex].unit || 'hours'}
                                                                onChange={e => {
                                                                    const n = [...editForm.steps];
                                                                    const unit = e.target.value;
                                                                    const duration = n[activeStepIndex].duration || n[activeStepIndex].delayHours || 24;
                                                                    n[activeStepIndex].unit = unit;
                                                                    n[activeStepIndex].delayHours = unit === 'days' ? duration * 24 : unit === 'weeks' ? duration * 168 : duration;
                                                                    setEditForm({ ...editForm, steps: n });
                                                                }}
                                                                className="w-full border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                            >
                                                                <option value="hours">Hours</option>
                                                                <option value="days">Days</option>
                                                                <option value="weeks">Weeks</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-500">The automation will pause here before proceeding to the next step.</p>
                                                </div>
                                            )}

                                            {editForm.steps[activeStepIndex].type === 'resend_list' && (
                                                <div className="max-w-md space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Action</label>
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="list_action"
                                                                    value="add"
                                                                    checked={editForm.steps[activeStepIndex].action !== 'remove'}
                                                                    onChange={e => {
                                                                        const n = [...editForm.steps];
                                                                        n[activeStepIndex].action = 'add';
                                                                        setEditForm({ ...editForm, steps: n });
                                                                    }}
                                                                    className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                                <span className="text-sm font-medium text-zinc-800">Add to List</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="list_action"
                                                                    value="remove"
                                                                    checked={editForm.steps[activeStepIndex].action === 'remove'}
                                                                    onChange={e => {
                                                                        const n = [...editForm.steps];
                                                                        n[activeStepIndex].action = 'remove';
                                                                        setEditForm({ ...editForm, steps: n });
                                                                    }}
                                                                    className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                                <span className="text-sm font-medium text-zinc-800">Remove from List</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Resend Audience ID</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.steps[activeStepIndex].listId || ''}
                                                            onChange={e => {
                                                                const n = [...editForm.steps];
                                                                n[activeStepIndex].listId = e.target.value;
                                                                setEditForm({ ...editForm, steps: n });
                                                            }}
                                                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                                            placeholder="e.g. 78241a2e-4321-4d32-9029..."
                                                        />
                                                    </div>
                                                    <p className="text-xs text-zinc-500">Provide the Resend Audience ID you want the student added or removed from. This must be configured in your Resend account.</p>
                                                </div>
                                            )}

                                            {editForm.steps[activeStepIndex].type === 'email' && (
                                                <div className="space-y-5">
                                                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 space-y-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={editForm.steps[activeStepIndex].couponConfig?.enabled || false}
                                                                onChange={e => {
                                                                    const n = [...editForm.steps];
                                                                    if (!n[activeStepIndex].couponConfig) n[activeStepIndex].couponConfig = { type: 'percent', value: 20, validityDays: 7 };
                                                                    n[activeStepIndex].couponConfig.enabled = e.target.checked;
                                                                    setEditForm({ ...editForm, steps: n });
                                                                }}
                                                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                            />
                                                            <span className="text-sm font-medium text-zinc-900">Attach Dynamic Discount Coupon</span>
                                                        </label>

                                                        {editForm.steps[activeStepIndex].couponConfig?.enabled && (
                                                            <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 bg-white p-3 rounded border border-zinc-200">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
                                                                    <select
                                                                        value={editForm.steps[activeStepIndex].couponConfig?.type || 'percent'}
                                                                        onChange={e => {
                                                                            const n = [...editForm.steps];
                                                                            n[activeStepIndex].couponConfig.type = e.target.value;
                                                                            setEditForm({ ...editForm, steps: n });
                                                                        }}
                                                                        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-xs bg-white"
                                                                    >
                                                                        <option value="percent">Percent (%)</option>
                                                                        <option value="amount">Amount ($)</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Value</label>
                                                                    <input
                                                                        type="number"
                                                                        value={editForm.steps[activeStepIndex].couponConfig?.value || 20}
                                                                        onChange={e => {
                                                                            const n = [...editForm.steps];
                                                                            n[activeStepIndex].couponConfig.value = parseInt(e.target.value) || 0;
                                                                            setEditForm({ ...editForm, steps: n });
                                                                        }}
                                                                        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-xs"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Valid Days</label>
                                                                    <input
                                                                        type="number"
                                                                        value={editForm.steps[activeStepIndex].couponConfig?.validityDays || 7}
                                                                        onChange={e => {
                                                                            const n = [...editForm.steps];
                                                                            n[activeStepIndex].couponConfig.validityDays = parseInt(e.target.value) || 7;
                                                                            setEditForm({ ...editForm, steps: n });
                                                                        }}
                                                                        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-xs"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Subject Line</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.steps[activeStepIndex].subject || ''}
                                                            onChange={e => {
                                                                const n = [...editForm.steps];
                                                                n[activeStepIndex].subject = e.target.value;
                                                                setEditForm({ ...editForm, steps: n });
                                                            }}
                                                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="e.g. Welcome to the Studio!"
                                                        />
                                                    </div>
                                                    <div className="flex-1 flex flex-col min-h-[350px]">
                                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Email Body</label>
                                                        <div className="flex-1 w-full flex flex-col relative w-full mt-1">
                                                            <RichTextEditor
                                                                value={editForm.steps[activeStepIndex].content || ''}
                                                                onChange={(html) => {
                                                                    const n = [...editForm.steps];
                                                                    n[activeStepIndex].content = html;
                                                                    setEditForm({ ...editForm, steps: n });
                                                                }}
                                                                placeholder="Write your email content..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right-most Variable Sidebar (Only for Emails) */}
                                        {editForm.steps[activeStepIndex].type === 'email' && (
                                            <div className="w-56 shrink-0 border-l border-zinc-100 bg-zinc-50/50 p-4 overflow-y-auto">
                                                <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-3 flex items-center gap-1.5">
                                                    <Sparkles className="h-3 w-3 text-amber-500" />
                                                    Drag Variables
                                                </h4>
                                                <div className="space-y-2">
                                                    {[
                                                        "{{firstName}}",
                                                        "{{lastName}}",
                                                        "{{email}}",
                                                        "{{studioAddress}}",
                                                        "{{studioName}}"
                                                    ].map(v => (
                                                        <div
                                                            key={v}
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.dataTransfer.setData("text/plain", v);
                                                                e.dataTransfer.effectAllowed = "copy";
                                                            }}
                                                            className="bg-white border border-zinc-200 px-2.5 py-1.5 rounded flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-sm transition-all"
                                                        >
                                                            <span className="font-mono text-[11px] text-zinc-600">{v}</span>
                                                        </div>
                                                    ))}

                                                    {editForm.steps[activeStepIndex].couponConfig?.enabled && (
                                                        <div
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.dataTransfer.setData("text/plain", "{{coupon_code}}");
                                                                e.dataTransfer.effectAllowed = "copy";
                                                            }}
                                                            className="mt-4 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-amber-400 hover:shadow-sm transition-all"
                                                        >
                                                            <span className="font-mono text-[11px] text-amber-700 font-medium">{"{{coupon_code}}"}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 mt-4 shrink-0">
                            <button
                                type="button"
                                onClick={() => setEditingAuto(null)}
                                className="px-5 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Save className="h-4 w-4" />
                                Save Sequence
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, automationId: null })}
                title="Delete Automation"
            >
                <div className="space-y-4">
                    <p className="text-zinc-600">
                        Are you sure you want to delete this automation? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setDeleteModal({ isOpen: false, automationId: null })}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteAutomation}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Forever
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
