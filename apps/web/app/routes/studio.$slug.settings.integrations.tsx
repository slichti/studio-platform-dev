
import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { apiRequest } from "~/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { Trash2, Loader2, Key, MessageSquare, Mail, Save, CreditCard, CheckCircle, Smartphone, Send, Shield, Layers } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

export default function IntegrationsPage() {
    const { slug } = useParams();
    const { tenant, features } = useOutletContext<any>() || {};

    // Integration Credentials State (For BYOK forms)
    const [credentials, setCredentials] = useState<any>(null);
    const [twilioForm, setTwilioForm] = useState({ accountSid: '', authToken: '', fromNumber: '' });
    const [resendForm, setResendForm] = useState({ apiKey: '' });

    // Confirmation States
    const [disconnectGoogle, setDisconnectGoogle] = useState(false);
    const [chatToggle, setChatToggle] = useState<boolean | null>(null);
    const [pendingPaymentProvider, setPendingPaymentProvider] = useState<string | null>(null);

    // Helper to use the Settings-style API call for credentials
    const updateIntegration = async (body: any) => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                method: 'PUT',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify(body)
            });
            toast.success("Settings saved successfully.");
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save");
        }
    };

    // Feature Toggle Helper
    const toggleFeature = async (featureKey: string, enabled: boolean) => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/features`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify({ featureKey, enabled })
            });
            toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${featureKey}`);
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message || "Failed to update feature");
        }
    };

    useEffect(() => {
        loadDevData();
    }, [slug]);

    const loadDevData = async () => {
        try {
            const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : localStorage.getItem('token');
            // apiRequest handles token if passed

            const credsData = await apiRequest("/integrations/credentials", token, { headers: { 'X-Tenant-Slug': slug || '' } });

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

                    <div className="mt-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            <Shield className="h-4 w-4" /> Financial Privacy & Security
                        </h4>
                        <div className="text-xs text-blue-800 dark:text-blue-200 space-y-2">
                            <p>
                                <strong>Your Money, Your Account:</strong> You retain full legal ownership of your Stripe account and funds. We cannot access your bank account or withdraw funds without your permission.
                            </p>
                            <p>
                                <strong>Limited Visibility:</strong> We only track transactions processed through this platform (e.g., class bookings). We do not access unrelated financial data from your Stripe account.
                            </p>
                            <p>
                                <strong>Bank-Grade Security:</strong> Sensitive financial data is stored securely by Stripe. We do not store credit card numbers or bank account details.
                            </p>
                        </div>
                    </div>
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
                            toast.success("Flodesk settings saved.");
                            loadDevData();
                        } catch (e: any) {
                            console.error(e);
                            toast.error("Failed to save Flodesk settings: " + e.message);
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

                {/* Chat Widget */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> Customer Support Chat
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenant.settings?.chatEnabled !== false ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {tenant.settings?.chatEnabled !== false ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">Allow students to chat with you directly from your website and portal.</p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                const isEnabled = tenant.settings?.chatEnabled !== false;
                                setChatToggle(!isEnabled);
                            }}
                            className={`px-3 py-2 text-xs font-medium rounded border ${tenant.settings?.chatEnabled !== false ? 'bg-zinc-50 border-zinc-300 text-zinc-700' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {tenant.settings?.chatEnabled !== false ? 'Disable Chat' : 'Enable Chat'}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- SECTION 2: CLASS AGGREGATORS --- */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Class Aggregators</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Connect with external booking platforms to fill your classes.</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ClassPass */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Layers className="h-4 w-4" /> ClassPass
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${features?.has('classpass') ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {features?.has('classpass') ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-4">Allow ClassPass users to book your classes. We'll sync your schedule automatically.</p>
                        <button
                            onClick={() => toggleFeature('classpass', !features?.has('classpass'))}
                            className={`px-3 py-2 text-xs font-medium rounded border ${features?.has('classpass') ? 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {features?.has('classpass') ? 'Disable ClassPass' : 'Enable ClassPass'}
                        </button>
                    </div>

                    {/* Gympass */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Layers className="h-4 w-4" /> Gympass (Wellhub)
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${features?.has('gympass') ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {features?.has('gympass') ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-4">Connect with corporate wellness programs through Gympass.</p>
                        <button
                            onClick={() => toggleFeature('gympass', !features?.has('gympass'))}
                            className={`px-3 py-2 text-xs font-medium rounded border ${features?.has('gympass') ? 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {features?.has('gympass') ? 'Disable Gympass' : 'Enable Gympass'}
                        </button>
                    </div>
                </div>
            </div>
            {/* --- SECTION 3: PROGRESS TRACKING --- */}
            <div className="mb-8">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Progress Tracking</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Enable visual progress metrics for your members. Configure which metrics are visible based on your studio type.</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Feature Toggle */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Layers className="h-4 w-4" /> Advanced Progress Tracking
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${features?.has('progress_tracking') ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {features?.has('progress_tracking') ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-4">Show members their attendance streaks, class counts, and personal achievements. Metrics adapt based on your studio type.</p>
                        <button
                            onClick={() => toggleFeature('progress_tracking', !features?.has('progress_tracking'))}
                            className={`px-3 py-2 text-xs font-medium rounded border ${features?.has('progress_tracking') ? 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:bg-zinc-100' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {features?.has('progress_tracking') ? 'Disable Progress Tracking' : 'Enable Progress Tracking'}
                        </button>
                    </div>

                    {/* Studio Type Configuration */}
                    {features?.has('progress_tracking') && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> Studio Type
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-500 mb-3">Select your studio type to show relevant metrics. Yoga studios see mindfulness metrics. Gyms see strength/cardio metrics.</p>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const studioType = new FormData(e.currentTarget).get("studioType") as string;
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest(`/progress/settings`, token, {
                                        method: 'PUT',
                                        headers: { 'X-Tenant-Slug': slug || '' },
                                        body: JSON.stringify({ studioType })
                                    });
                                    await apiRequest(`/progress/seed-defaults`, token, {
                                        method: 'POST',
                                        headers: { 'X-Tenant-Slug': slug || '' },
                                        body: JSON.stringify({ studioType })
                                    });
                                    toast.success("Studio type saved and metrics configured.");
                                    window.location.reload();
                                } catch (err: any) {
                                    toast.error(err.message || "Failed to save");
                                }
                            }} className="space-y-3">
                                <select name="studioType" defaultValue={tenant.settings?.progressTracking?.studioType || 'yoga'} className="w-full text-sm border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 rounded px-3 py-2">
                                    <option value="yoga">Yoga / Mindfulness Studio</option>
                                    <option value="gym">Gym / Fitness Center</option>
                                    <option value="hybrid">Hybrid (Show All Metrics)</option>
                                </select>
                                <button type="submit" className="text-xs bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 px-3 py-2 rounded font-medium">Save Studio Type</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialogs */}
            <ConfirmationDialog
                isOpen={disconnectGoogle}
                onClose={() => setDisconnectGoogle(false)}
                onConfirm={async () => {
                    try {
                        const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : localStorage.getItem('token');
                        await apiRequest(`/studios/${tenant.id}/integrations/google`, token, {
                            method: 'DELETE'
                        });
                        toast.success('Disconnected');
                        window.location.reload();
                    } catch (e) {
                        console.error(e);
                        toast.error('Failed to disconnect');
                    } finally {
                        setDisconnectGoogle(false);
                    }
                }}
                title="Disconnect Google Calendar"
                message="Are you sure you want to disconnect Google Calendar? Classes will no longer sync."
                isDestructive={true}
                confirmText="Disconnect"
            />

            <ConfirmationDialog
                isOpen={chatToggle !== null}
                onClose={() => setChatToggle(null)}
                onConfirm={() => {
                    if (chatToggle !== null) {
                        updateIntegration({ chatEnabled: chatToggle });
                        setChatToggle(null);
                    }
                }}
                title={chatToggle ? "Enable Chat Widget" : "Disable Chat Widget"}
                message={chatToggle ? "Enable chat widget for your studio? This will verify connectivity to your configured support channels." : "Disable chat widget for your studio?"}
                confirmText={chatToggle ? "Enable" : "Disable"}
            />

            <ConfirmationDialog
                isOpen={!!pendingPaymentProvider}
                onClose={() => setPendingPaymentProvider(null)}
                onConfirm={() => {
                    if (pendingPaymentProvider) {
                        updateIntegration({ paymentProvider: pendingPaymentProvider });
                        setPendingPaymentProvider(null);
                    }
                }}
                title="Switch Payment Provider"
                message={`Switch to ${pendingPaymentProvider === 'connect' ? 'Platform Managed' : 'Self Managed'} payments?`}
                confirmText="Switch"
            />
        </div>
    );
}

