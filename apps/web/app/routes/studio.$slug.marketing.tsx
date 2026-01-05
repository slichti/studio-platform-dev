// @ts-ignore
import { useLoaderData, useFetcher } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Send, Mail, CheckCircle, AlertTriangle, Sparkles, Pencil, X, Zap } from "lucide-react";
import { Modal } from "~/components/Modal";

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

    return { campaigns, automations, token, slug };
};

export default function MarketingPage() {
    const { campaigns: initialCampaigns, automations: initialAutomations, token, slug } = useLoaderData<any>();
    const [tab, setTab] = useState<'broadcast' | 'automation'>('broadcast');

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
    const [editForm, setEditForm] = useState({ subject: "", content: "", isEnabled: false });
    const [testEmail, setTestEmail] = useState("");

    async function handleSendBroadcast(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        try {
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
                alert(res.error);
            } else {
                alert(`Campaign Sent to ${res.count} recipients!`);
                setSubject("");
                setContent("");
                const refreshed: any = await apiRequest("/marketing", token, { headers: { 'X-Tenant-Slug': slug } });
                setCampaigns(refreshed.campaigns || []);
            }
        } catch (e: any) {
            alert("Failed to send: " + e.message);
        } finally {
            setSending(false);
        }
    }

    async function handleUpdateAutomation(e: React.FormEvent) {
        e.preventDefault();
        if (!editingAuto) return;
        try {
            const res: any = await apiRequest(`/marketing/automations/${editingAuto.id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(editForm)
            });

            // Update local state
            setAutomations(automations.map((a: any) => a.id === editingAuto.id ? res : a));
            setEditingAuto(null);
        } catch (e: any) {
            alert("Failed to update: " + e.message);
        }
    }

    async function handleSendTest(id: string) {
        const email = prompt("Enter email to send test to:", testEmail);
        if (email) {
            setTestEmail(email);
            try {
                await apiRequest(`/marketing/automations/${id}/test`, token, {
                    method: "POST",
                    headers: { 'X-Tenant-Slug': slug },
                    body: JSON.stringify({ email })
                });
                alert("Test email sent!");
            } catch (e: any) {
                alert("Failed to test: " + e.message);
            }
        }
    }

    const triggerLabels: any = {
        'new_student': 'New Student Welcome',
        'birthday': 'Birthday Greeting',
        'absent_30_days': 'Win-back (Absent 30+ Days)'
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
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
                                    <textarea
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        className="w-full border border-zinc-300 rounded-lg px-3 py-2 h-48 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Write your message..."
                                        required
                                    ></textarea>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-xs text-zinc-400">Plain text only for MVP.</p>
                                        <div className="text-xs text-zinc-500">
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
                        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <Zap className="h-5 w-5 text-amber-500" />
                            Active Automations
                        </h2>
                        <p className="text-sm text-zinc-500 mb-6">
                            These emails are sent automatically based on student activity.
                        </p>

                        <div className="grid gap-4">
                            {automations.map((auto: any) => (
                                <div key={auto.id} className="group border border-zinc-200 rounded-lg p-4 flex items-center justify-between hover:border-blue-300 transition-colors bg-white">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-full ${auto.isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-medium text-zinc-900">{triggerLabels[auto.triggerType] || auto.triggerType}</h3>
                                                {auto.isEnabled ? (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
                                                ) : (
                                                    <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase">Disabled</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-500 line-clamp-1 relative top-[-2px]">
                                                Subject: {auto.subject}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleSendTest(auto.id)}
                                            className="text-xs text-zinc-500 hover:text-zinc-800 px-3 py-1.5 border border-zinc-200 rounded hover:bg-zinc-50"
                                        >
                                            Send Test
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingAuto(auto);
                                                setEditForm({
                                                    subject: auto.subject,
                                                    content: auto.content,
                                                    isEnabled: auto.isEnabled
                                                });
                                            }}
                                            className="text-xs bg-white text-zinc-700 border border-zinc-300 px-3 py-1.5 rounded hover:bg-zinc-50 flex items-center gap-1.5"
                                        >
                                            <Pencil className="h-3 w-3" />
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Automation Modal */}
            <Modal
                isOpen={!!editingAuto}
                onClose={() => setEditingAuto(null)}
                title={`Edit: ${editingAuto ? triggerLabels[editingAuto.triggerType] : ''}`}
            >
                {editingAuto && (
                    <form onSubmit={handleUpdateAutomation} className="space-y-4">
                        <div>
                            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editForm.isEnabled}
                                    onChange={e => setEditForm({ ...editForm, isEnabled: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-zinc-900">Enable this automation</span>
                            </label>

                            <label className="block text-sm font-medium text-zinc-700 mb-1">Subject Line</label>
                            <input
                                type="text"
                                value={editForm.subject}
                                onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                                className="w-full border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Content</label>
                            <textarea
                                value={editForm.content}
                                onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                className="w-full border border-zinc-300 rounded-lg px-3 py-2 h-40 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            ></textarea>
                            <div className="flex gap-2 mt-2 text-xs text-zinc-500">
                                <span>Variables:</span>
                                <code className="bg-zinc-100 px-1 rounded">{"{{firstName}}"}</code>
                                <code className="bg-zinc-100 px-1 rounded">{"{{studioName}}"}</code>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditingAuto(null)}
                                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
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
