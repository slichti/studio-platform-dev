
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { Trash2, Terminal, Loader2, Key, MessageSquare, Mail, Save } from "lucide-react";

export default function DevelopersSettings() {
    const { slug } = useParams();
    const [endpoints, setEndpoints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createUrl, setCreateUrl] = useState("");
    const [createEvents, setCreateEvents] = useState("booking.created, order.completed");
    const [isCreating, setIsCreating] = useState(false);

    const [credentials, setCredentials] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [twilioForm, setTwilioForm] = useState({ accountSid: '', authToken: '', fromNumber: '' });
    const [resendForm, setResendForm] = useState({ apiKey: '' });

    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";

    useEffect(() => {
        loadData();
    }, [slug]);

    const loadData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Slug': slug || ''
            };

            const [webhooksRes, credsRes] = await Promise.all([
                fetch(`${API_URL}/integrations/webhooks`, { headers }),
                fetch(`${API_URL}/integrations/credentials`, { headers })
            ]);

            if (webhooksRes.ok) {
                const data = await webhooksRes.json() as { endpoints: any[] };
                setEndpoints(data.endpoints);
            }
            if (credsRes.ok) {
                const data = await credsRes.json();
                setCredentials(data);
                // Pre-fill forms (only public parts)
                setTwilioForm({
                    accountSid: data.twilio?.accountSid || '',
                    authToken: '', // Never return auth token
                    fromNumber: data.twilio?.fromNumber || ''
                });
                setResendForm({
                    apiKey: data.resend?.apiKey || ''
                });
            }
        } catch (e: any) {
            console.error("Failed to load data", e);
        } finally {
            setLoading(false);
        }
    };

    // Alias for compatibility if needed, but we use loadData now locally
    const fetchEndpoints = loadData;

    const handleSaveCredentials = async (type: 'twilio' | 'resend') => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const body: any = {};
            if (type === 'twilio') body.twilio = twilioForm;
            if (type === 'resend') body.resend = resendForm;

            const res = await fetch(`${API_URL}/integrations/credentials`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Slug': slug || ''
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert("Credentials saved.");
                loadData();
            } else {
                alert("Failed to save credentials.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if (!createUrl) return;
        setIsCreating(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/integrations/webhooks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Slug': slug || ''
                },
                body: JSON.stringify({
                    url: createUrl,
                    events: createEvents.split(',').map(s => s.trim()),
                    description: "Manual created"
                })
            });

            if (res.ok) {
                setCreateUrl("");
                fetchEndpoints();
            } else {
                alert("Failed to create webhook");
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this webhook?")) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/integrations/webhooks/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Slug': slug || ''
                }
            });
            if (res.ok) {
                setEndpoints(endpoints.filter(e => e.id !== id));
            }
        } catch (e: any) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Developers & Integrations</h1>
                <p className="text-muted-foreground mt-2">
                    Manage API keys and Webhooks to connect with external tools like Zapier.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        Outgoing Webhooks
                    </CardTitle>
                    <CardDescription>
                        Receive real-time JSON payloads when events happen in your studio.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* List */}
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="border rounded-md divide-y">
                            {endpoints.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    No webhooks configured.
                                </div>
                            )}
                            {endpoints.map(ep => (
                                <div key={ep.id} className="p-4 flex items-center justify-between">
                                    <div className="grid gap-1">
                                        <div className="font-mono text-sm font-medium">{ep.url}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {Array.isArray(ep.events) ? ep.events.join(', ') : ep.events}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <code className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground hidden sm:inline-block">
                                            {ep.secret.slice(0, 8)}...
                                        </code>
                                        <button className="p-2 hover:bg-red-50 text-red-600 rounded" onClick={() => handleDelete(ep.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create New */}
                    <div className="p-4 border rounded-md bg-muted/20 space-y-4">
                        <h4 className="font-medium text-sm">Add New Endpoint</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Endpoint URL</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="https://hooks.zapier.com/..."
                                    value={createUrl}
                                    onChange={e => setCreateUrl(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Events (comma separated)</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={createEvents}
                                    onChange={e => setCreateEvents(e.target.value)}
                                />
                                <div className="text-[10px] text-muted-foreground">
                                    Available: booking.created, order.completed, student.created
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                onClick={handleCreate}
                                disabled={!createUrl || isCreating}
                            >
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Webhook
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>



            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Integrations (BYOK)
                    </CardTitle>
                    <CardDescription>
                        Bring Your Own Keys to bypass platform limits and use your own accounts.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Twilio */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-blue-500" />
                                <div>
                                    <h4 className="font-medium">Twilio (SMS)</h4>
                                    <p className="text-xs text-muted-foreground">Required for custom SMS notifications.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${credentials?.twilio?.configured ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                    {credentials?.twilio?.configured ? 'Active' : 'Not Configured'}
                                </span>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-md bg-zinc-50/50">
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase text-zinc-500">Account SID</label>
                                <input className="w-full border rounded px-3 py-2 text-sm"
                                    placeholder="AC..."
                                    value={twilioForm.accountSid}
                                    onChange={e => setTwilioForm({ ...twilioForm, accountSid: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase text-zinc-500">From Number</label>
                                <input className="w-full border rounded px-3 py-2 text-sm"
                                    placeholder="+15550000000"
                                    value={twilioForm.fromNumber}
                                    onChange={e => setTwilioForm({ ...twilioForm, fromNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-medium uppercase text-zinc-500">Auth Token</label>
                                <input className="w-full border rounded px-3 py-2 text-sm"
                                    type="password"
                                    placeholder={credentials?.twilio?.configured ? "• • • • • • (Unchanged)" : "Enter Auth Token"}
                                    value={twilioForm.authToken}
                                    onChange={e => setTwilioForm({ ...twilioForm, authToken: e.target.value })}
                                />
                                <p className="text-[10px] text-zinc-400">Hidden after saving.</p>
                            </div>
                            <div className="md:col-span-2 flex justify-end">
                                <button
                                    onClick={() => handleSaveCredentials('twilio')}
                                    disabled={saving}
                                    className="text-xs bg-zinc-900 text-white px-3 py-2 rounded hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save Twilio
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-zinc-100"></div>

                    {/* Resend */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-indigo-500" />
                                <div>
                                    <h4 className="font-medium">Resend (Email)</h4>
                                    <p className="text-xs text-muted-foreground">For high-volume or custom domain emails.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${credentials?.resend?.configured ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                    {credentials?.resend?.configured ? 'Active' : 'Not Configured'}
                                </span>
                            </div>
                        </div>

                        <div className="grid gap-4 p-4 border rounded-md bg-zinc-50/50">
                            <div className="space-y-2">
                                <label className="text-xs font-medium uppercase text-zinc-500">API Key</label>
                                <input className="w-full border rounded px-3 py-2 text-sm font-mono"
                                    type="password"
                                    placeholder={credentials?.resend?.configured ? "re_... (Unchanged)" : "re_123..."}
                                    value={resendForm.apiKey}
                                    onChange={e => setResendForm({ ...resendForm, apiKey: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => handleSaveCredentials('resend')}
                                    disabled={saving}
                                    className="text-xs bg-zinc-900 text-white px-3 py-2 rounded hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save Resend
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Studio API Credentials</CardTitle>
                    <CardDescription>
                        Use these credentials to authenticate API requests.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Studio ID (Tenant ID)</label>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={endpoints[0]?.tenant_id || "Loading..."} // Keep tenant_id as it comes from API
                                    className="font-mono bg-muted flex h-10 w-full rounded-md border border-input px-3"
                                />
                                <button className="border rounded px-3 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">Copy</button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
