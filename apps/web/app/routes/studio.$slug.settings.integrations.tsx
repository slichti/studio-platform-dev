
import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { apiRequest } from "~/utils/api";
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

    // Removed local API_URL definition to use apiRequest utility

    useEffect(() => {
        loadDevData();
    }, [slug]);

    const loadDevData = async () => {
        setLoadingDev(true);
        try {
            const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : localStorage.getItem('token');
            // apiRequest handles token if passed
            
            const [webhooksData, credsData] = await Promise.all([
                apiRequest("/integrations/webhooks", token, { headers: { 'X-Tenant-Slug': slug || '' } }),
                apiRequest("/integrations/credentials", token, { headers: { 'X-Tenant-Slug': slug || '' } })
            ]);

            setEndpoints((webhooksData as any).endpoints || []);
            setCredentials(credsData);
            
            // Pre-fill forms (only public parts)
            setTwilioForm({
                accountSid: (credsData as any).twilio?.accountSid || '',
                authToken: '', // Never return auth token
                fromNumber: (credsData as any).twilio?.fromNumber || ''
            });
            setResendForm({
                apiKey: (credsData as any).resend?.apiKey || ''
            });
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
            
            // Using logic discussed: Developers page was using PATCH /integrations/credentials
            // Since we are refactoring, we'll stick to that if it works, or switch to the one that `updateIntegration` uses.
            // The previous code had a comment block about confusion. 
            // Let's assume `updateIntegration` (PUT /studios/:id/integrations) is the robust one for Settings page.
            // But this specific function `handleSaveCredentials` was unused? 
            // Looking at the JSX... `handleSaveCredentials` is NOT called in the JSX forms below!
            // The Twilio form calls `updateIntegration`. The Resend form calls `updateIntegration`.
            // So `handleSaveCredentials` is dead code?
            // Actually, let's verify.
            // Twilio form: `onSubmit={(e) => { ... updateIntegration({...}) }}`
            // Resend form: `onSubmit={(e) => { ... updateIntegration({...}) }}`
            // So `handleSaveCredentials` is indeed dead code or legacy.
            // I will remove it to clean up.
        } catch (e) { }
    };

    // Helper to use the Settings-style API call for credentials
    const updateIntegration = async (body: any) => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                method: 'PUT',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify(body)
            });
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
            await apiRequest("/integrations/webhooks", token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify({
                    url: createUrl,
                    events: createEvents.split(',').map(s => s.trim()),
                    description: "Manual created"
                })
            });

            setCreateUrl("");
            loadDevData();
        } catch (e: any) {
            console.error(e);
            alert("Failed to create webhook: " + e.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!confirm("Delete this webhook?")) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/integrations/webhooks/${id}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug || '' }
            });
            setEndpoints(endpoints.filter(e => e.id !== id));
        } catch (e: any) {
            console.error(e);
            alert("Failed to delete webhook: " + e.message);
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
                                <a href={`${import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev"}/studios/stripe/connect?tenantId=${tenant.id}`} className="mt-4 block w-full py-2 text-center bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">Connect Stripe Account &rarr;</a>
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
                            await apiRequest("/integrations/credentials", token, {
                                method: 'PATCH',
                                headers: { 'X-Tenant-Slug': slug || '' },
                                body: JSON.stringify({ flodesk: { apiKey } })
                            });
                            alert("Flodesk settings saved.");
                            loadDevData();
                        } catch (e: any) {
                            console.error(e);
                            alert("Failed to save Flodesk settings: " + e.message);
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
                                                await apiRequest(`/studios/${tenant.id}/integrations/google`, token, {
                                                    method: 'DELETE'
                                                });
                                                alert('Disconnected');
                                                window.location.reload();
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
                                        href={`${import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev"}/studios/google/connect?tenantId=${tenant.id}`}
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
