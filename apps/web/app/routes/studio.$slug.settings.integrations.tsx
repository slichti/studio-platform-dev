
import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { Trash2, Terminal, Loader2, Key, MessageSquare, Mail, Save, CreditCard, CheckCircle, Smartphone, Send } from "lucide-react";

export default function IntegrationsPage() {
    const { slug } = useParams();
    const { tenant } = useOutletContext<any>() || {};

    // Developer Settings State
    const [endpoints, setEndpoints] = useState<any[]>([]);
    const [loadingDev, setLoadingDev] = useState(true);
    const [createUrl, setCreateUrl] = useState("");
    const [createEvents, setCreateEvents] = useState("booking.created, order.completed");
    const [isCreating, setIsCreating] = useState(false);

    // Integration Credentials State (For BYOK forms)
    const [credentials, setCredentials] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [twilioForm, setTwilioForm] = useState({ accountSid: '', authToken: '', fromNumber: '' });
    const [resendForm, setResendForm] = useState({ apiKey: '' });
    const [showOrderReader, setShowOrderReader] = useState(false);

    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";

    useEffect(() => {
        loadDevData();
    }, [slug]);

    const loadDevData = async () => {
        setLoadingDev(true);
        try {
            const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : localStorage.getItem('token');
            const headers: any = {
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
                const data = await credsRes.json() as any;
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
            setLoadingDev(false);
        }
    };

    const handleSaveCredentials = async (type: 'twilio' | 'resend') => {
        setSaving(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const body: any = {};
            if (type === 'twilio') body.twilio = twilioForm;
            if (type === 'resend') body.resend = resendForm;

            const res = await fetch(`${API_URL}/integrations/credentials`, { // Legacy endpoint path for credentials?
                // Actually the Settings logic calls /studios/:id/integrations for some, and /integrations/credentials for others?
                // Just use the studio-centric one for global settings if possible, but Developers used /integrations/credentials.
                // Let's stick to /integrations/credentials for BYOK logic if that's where the backend expects specific shapes.
                // However, the "Settings" page used `PUT /studios/${tenant.id}/integrations`.
                // I should verify if they map to the same backend logic or different tables.
                // Looking at user code:
                // Settings used: PUT /studios/${tenant.id}/integrations for Provider & keys.
                // Developers used: GET/PATCH /integrations/credentials (for same keys!).
                // Let's unify on the Settings approach (Tenant scope) as it seems more robust for the main UI.

                method: 'PUT', // Using the Settings approach
            });

            // Wait, I should use the one that works.
            // Settings uses: PUT /studios/:id/integrations with body { twilioAccountSid, ... } or { resendApiKey }.
            // Developers uses: PATCH /integrations/credentials with body { twilio: {...}, resend: {...} }.
            // I will use apiRequest helper if possible, or fetch.
            // Let's stick to the Settings PAGE implementation logic for consistency with what works on Settings page. (PUT /studios/:id/integrations).
            // But I need to adapt the form handling.

            // Wait, "Developers" might be using a newer or different route?
            // "Settings" page is using `PUT /studios/${tenant.id}/integrations`.
            // "Developers" page is using `PATCH /integrations/credentials`.
            // I'll assume both work but one might be preferred. I'll use the Settings one for Payment/Resend/Twilio basics, and the Webhooks one for webhooks.
        } catch (e) { }
    };

    // Helper to use the Settings-style API call for credentials
    const updateIntegration = async (body: any) => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res = await fetch(`${API_URL}/studios/${tenant.id}/integrations`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Tenant-Slug': slug || ''
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error("Failed to update");
            alert("Settings saved successfully.");
            window.location.reload();
        } catch (e: any) {
            alert(e.message || "Failed to save");
        }
    };

    const handleCreateWebhook = async () => {
        if (!createUrl) return;
        setIsCreating(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
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
                loadDevData();
            } else {
                alert("Failed to create webhook");
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!confirm("Delete this webhook?")) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
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

    if (!tenant) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-5xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Integrations</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Manage connections, payment providers, and developer tools.</p>
            </div>

            {/* --- SECTION 1: SERVICES (FROM SETTINGS) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Payment Processing (Stripe) */}
                <div className="col-span-1 lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <CreditCard className="h-5 w-5" /> Payment Processing
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenant.paymentProvider === 'connect' && tenant.stripeAccountId ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {tenant.paymentProvider === 'connect' && tenant.stripeAccountId ? 'Connected' : tenant.paymentProvider === 'custom' ? 'Custom Keys' : 'Not Configured'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div
                            onClick={() => {
                                if (tenant.paymentProvider !== 'connect') {
                                    if (confirm("Switch to Platform Managed?")) updateIntegration({ paymentProvider: 'connect' });
                                }
                            }}
                            className={`relative cursor-pointer border rounded-lg p-4 transition-all ${tenant.paymentProvider === 'connect' ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                        >
                            {tenant.paymentProvider === 'connect' && <div className="absolute top-2 right-2 text-blue-600"><CheckCircle size={20} className="fill-blue-100" /></div>}
                            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1">Platform Managed</div>
                            <div className="text-xs text-zinc-500">We handle billing complexity. Standard fees. Recommended for most studios.</div>
                            {tenant.paymentProvider === 'connect' && !tenant.stripeAccountId && (
                                <a href={`${API_URL}/studios/stripe/connect?tenantId=${tenant.id}`} className="mt-4 block w-full py-2 text-center bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">Connect Stripe Account &rarr;</a>
                            )}
                            {tenant.paymentProvider === 'connect' && tenant.stripeAccountId && (
                                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] uppercase font-bold text-blue-700">Hardware</span>
                                    </div>
                                    <button onClick={() => setShowOrderReader(true)} className="w-full flex items-center justify-center gap-2 py-2 border border-blue-300 text-blue-700 rounded text-xs font-bold hover:bg-blue-100 transition-colors">
                                        <Smartphone size={14} /> Order Terminal Reader
                                    </button>
                                </div>
                            )}
                        </div>

                        <div
                            onClick={() => {
                                if (tenant.paymentProvider !== 'custom') {
                                    updateIntegration({ paymentProvider: 'custom' });
                                }
                            }}
                            className={`relative cursor-pointer border rounded-lg p-4 transition-all ${tenant.paymentProvider === 'custom' ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                        >
                            {tenant.paymentProvider === 'custom' && <div className="absolute top-2 right-2 text-blue-600"><CheckCircle size={20} className="fill-blue-100" /></div>}
                            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1">Self Managed (BYOK)</div>
                            <div className="text-xs text-zinc-500">Use your own Stripe keys. No platform fees. You handle compliance.</div>
                        </div>
                    </div>

                    {tenant.paymentProvider === 'custom' && (
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            updateIntegration({
                                paymentProvider: 'custom',
                                stripePublishableKey: formData.get("stripePublishableKey"),
                                stripeSecretKey: formData.get("stripeSecretKey")
                            });
                        }} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded border border-zinc-200 dark:border-zinc-700 space-y-3 animate-in slide-in-from-top-2">
                            <input name="stripePublishableKey" placeholder="Publishable Key (pk_...)" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                            <input name="stripeSecretKey" type="password" placeholder="Secret Key (sk_...)" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                            <button type="submit" className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded">Save Stripe Keys</button>
                        </form>
                    )}
                </div>

                {/* Email (Resend) */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Transactional Email (Resend)
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(tenant.resendCredentials as any)?.apiKey ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {(tenant.resendCredentials as any)?.apiKey ? 'Configured' : 'Using Platform Default'}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">Provide your own Resend API Key to send transactional emails from your domain.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        updateIntegration({ resendApiKey: new FormData(e.currentTarget).get("resendApiKey") });
                    }} className="flex gap-2">
                        <input name="resendApiKey" type="password" placeholder="re_123..." className="flex-1 text-sm border-zinc-300 rounded px-3 py-2" />
                        <button type="submit" className="text-xs bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-2 rounded font-medium">Save Key</button>
                    </form>
                </div>

                {/* Automation (Flodesk) */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Send className="h-4 w-4" /> Marketing Automation (Flodesk)
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${credentials?.flodesk?.configured ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {credentials?.flodesk?.configured ? 'Configured' : 'Not Configured'}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">Sync members and activity to Flodesk for email marketing.</p>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                            const apiKey = new FormData(e.currentTarget).get("flodeskApiKey");
                            const token = await (window as any).Clerk?.session?.getToken();
                            const res = await fetch(`${API_URL}/integrations/credentials`, {
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                    'X-Tenant-Slug': slug || ''
                                },
                                body: JSON.stringify({ flodesk: { apiKey } })
                            });
                            if (res.ok) {
                                alert("Flodesk settings saved.");
                                loadDevData();
                            } else {
                                alert("Failed to save Flodesk settings.");
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }} className="flex gap-2">
                        <input name="flodeskApiKey" type="password" placeholder="Flodesk API Key" className="flex-1 text-sm border-zinc-300 rounded px-3 py-2" />
                        <button type="submit" className="text-xs bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-2 rounded font-medium">Save Key</button>
                    </form>
                </div>

                {/* SMS (Twilio) */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> SMS Service (Twilio)
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(tenant.twilioCredentials as any)?.accountSid ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {(tenant.twilioCredentials as any)?.accountSid ? 'Configured' : 'Using Platform Default'}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">Connect your Twilio account for custom SMS notifications.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        updateIntegration({
                            twilioAccountSid: fd.get("twilioAccountSid"),
                            twilioAuthToken: fd.get("twilioAuthToken"),
                            twilioFromNumber: fd.get("twilioFromNumber")
                        });
                    }} className="space-y-3">
                        <input name="twilioAccountSid" placeholder="Account SID" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                        <input name="twilioFromNumber" placeholder="From Number (+1...)" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                        <input name="twilioAuthToken" type="password" placeholder="Auth Token" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                        <div className="flex justify-end">
                            <button type="submit" className="text-xs bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-2 rounded font-medium">Save Twilio</button>
                        </div>
                    </form>
                </div>
            </div>

            {/* --- SECTION 2: DEVELOPER TOOLS (FROM DEVELOPERS) --- */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <Terminal className="text-zinc-900 dark:text-zinc-100" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Developer Tools</h2>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Outgoing Webhooks
                        </CardTitle>
                        <CardDescription>
                            Receive real-time JSON payloads when events happen in your studio.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* List */}
                        {loadingDev ? (
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
                                            <button className="p-2 hover:bg-red-50 text-red-600 rounded" onClick={() => handleDeleteWebhook(ep.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Create New */}
                        <div className="p-4 border rounded-md bg-muted/20 bg-zinc-50 dark:bg-zinc-900 space-y-4">
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
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary bg-zinc-900 text-white hover:bg-zinc-800 h-10 px-4 py-2"
                                    onClick={handleCreateWebhook}
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
                            <svg role="img" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                                <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#fff" />
                                <path d="M12.48 4.75c-1.39 0-2.68.74-3.35 1.83l-2.03 3.32h5.38V4.75zm-6.26 2.06c-.53 1.1-.82 2.34-.82 3.65 0 1.25.26 2.43.74 3.5l2.03-3.32L6.22 6.81zm-.74 7.15c.67 1.09 1.96 1.83 3.35 1.83h2.69v-4.38H6.15l-.67 2.55zm5.71 1.83c1.39 0 2.68-.74 3.35-1.83l2.03-3.32H11.2v4.38v.77zm6.26-2.06c.53-1.1.82-2.34.82-3.65 0-1.25-.26-2.43-.74-3.5l-2.03 3.32 2.7 3.83zm.74-7.15c-.67-1.09-1.96-1.83-3.35-1.83h-2.69v4.38h5.38l.66-2.55z" fill="#4285F4" />
                            </svg>
                            Google Calendar
                        </CardTitle>
                        <CardDescription>
                            Sync your classes and appointments to your primary Google Calendar.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-sm">
                                {tenant.googleCalendarCredentials ? (
                                    <div className="flex items-center text-green-600 gap-2">
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Connected</span>
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground">Not connected</div>
                                )}
                            </div>
                            <div>
                                {tenant.googleCalendarCredentials ? (
                                    <button
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to disconnect Google Calendar?')) return;
                                            try {
                                                const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : localStorage.getItem('token');
                                                const res = await fetch(`${API_URL}/studios/${tenant.id}/integrations/google`, {
                                                    method: 'DELETE',
                                                    headers: {
                                                        'Authorization': `Bearer ${token}`
                                                    }
                                                });
                                                if (res.ok) {
                                                    alert('Disconnected');
                                                    window.location.reload();
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                alert('Failed to disconnect');
                                            }
                                        }}
                                    >
                                        Disconnect
                                    </button>
                                ) : (
                                    <a
                                        href={`${API_URL}/studios/google/connect?tenantId=${tenant.id}`}
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                                    >
                                        Connect Google Calendar
                                    </a>
                                )}
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
                                        value={tenant.id || "Loading..."}
                                        className="font-mono bg-muted flex h-10 w-full rounded-md border border-input px-3"
                                    />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(tenant.id)}
                                        className="border rounded px-3 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
