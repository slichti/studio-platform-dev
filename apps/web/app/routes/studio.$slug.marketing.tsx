// @ts-ignore
import { useLoaderData, useFetcher } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Send, Mail, CheckCircle, AlertTriangle } from "lucide-react";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    let campaigns = [];
    try {
        const res: any = await apiRequest("/marketing", token, { headers: { 'X-Tenant-Slug': slug } });
        campaigns = res.campaigns || [];
    } catch (e) {
        console.error("Failed to load campaigns", e);
    }

    return { campaigns, token, slug };
};

export default function MarketingPage() {
    const { campaigns: initialCampaigns, token, slug } = useLoaderData<any>();
    const [campaigns, setCampaigns] = useState(initialCampaigns);
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const [filters, setFilters] = useState({
        ageMin: 0,
        ageMax: 100,
        preset: "all"
    });

    async function handleSend(e: React.FormEvent) {
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
                // Refresh list
                const refreshed: any = await apiRequest("/marketing", token, { headers: { 'X-Tenant-Slug': slug } });
                setCampaigns(refreshed.campaigns || []);
            }
        } catch (e: any) {
            alert("Failed to send: " + e.message);
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Compose */}
            <div className="lg:col-span-2 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900">Marketing</h1>
                    <p className="text-zinc-500">Broadcast updates to your community.</p>
                </div>

                <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
                    <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-600" />
                        New Broadcast
                    </h2>
                    <form onSubmit={handleSend} className="space-y-4">
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
                            <p className="text-xs text-zinc-400 mt-1">Plain text only for MVP.</p>
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
    );
}
