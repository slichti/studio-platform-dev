import { useState, useEffect } from "react";
// @ts-ignore
import { useOutletContext, useLoaderData, Form, useNavigation, useSubmit, Link } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router"; // Add types
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/ssr.server";
import { Plus, Trash2, MapPin, CreditCard, FileText, Tag } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const res: any = await apiRequest(`/locations`, token, {
        headers: { 'X-Tenant-Slug': params.slug! }
    });

    return { locations: res.locations || [] };
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create_location") {
        const name = formData.get("name");
        const address = formData.get("address");

        await apiRequest(`/locations`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ name, address })
        });
        return { success: true };
    }

    if (intent === "delete_location") {
        const id = formData.get("id");
        await apiRequest(`/locations/${id}`, token, {
            method: "DELETE",
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { success: true };
    }

    return null;
}

export default function StudioSettings() {
    const { tenant } = useOutletContext<any>();
    const { locations } = useLoaderData<{ locations: any[] }>();
    const navigation = useNavigation();

    // Studio Name State
    const [name, setName] = useState(tenant.name || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Location State
    const [isAddingLocation, setIsAddingLocation] = useState(false);

    const handleSaveName = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Client side fetch
            const token = await (window as any).Clerk?.session?.getToken();

            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ name })
            });
            setSuccess("Settings saved successfully.");
        } catch (e: any) {
            setError(e.message || "Failed to save settings.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Studio Settings</h1>
            </div>

            {/* General Settings */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">General Information</h2>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSaveName} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                            Studio Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Enter studio name"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-zinc-900 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-zinc-800 disabled:opacity-70"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
            {/* Registration Controls */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Registration</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Control how new students sign up for your studio.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">Public Student Registration</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {tenant.settings?.enableStudentRegistration
                                ? "Students can create accounts on your public site."
                                : "Only you can add students manually."}
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tenant.settings?.enableStudentRegistration || false}
                            onChange={async (e) => {
                                const checked = e.target.checked;
                                // Optimistic or reloading? For settings, reloading via router is safer to sync everything
                                // But let's do a quick fetch
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest(`/tenant/settings`, token, {
                                        method: "PATCH",
                                        headers: { 'X-Tenant-Slug': tenant.slug },
                                        body: JSON.stringify({ settings: { enableStudentRegistration: checked } })
                                    });
                                    // Refresh page to update context
                                    window.location.reload();
                                } catch (err) {
                                    alert("Failed to update setting");
                                }
                            }}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            {/* Notification & Automation Preferences */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Notifications & Automation</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage email alerts and studio automation settings.</p>
                </div>
                <div className="space-y-6">
                    {/* Admin Email Configuration */}
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Admin Notification Email</label>
                        <input
                            type="email"
                            className="w-full border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 bg-white dark:bg-zinc-800"
                            placeholder="admin@studio.com"
                            defaultValue={tenant.settings?.notifications?.adminEmail || ''}
                            onBlur={async (e) => {
                                const val = e.target.value;
                                const token = await (window as any).Clerk?.session?.getToken();
                                await apiRequest(`/tenant/settings`, token, {
                                    method: "PATCH",
                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                    body: JSON.stringify({ settings: { notifications: { ...tenant.settings?.notifications, adminEmail: val } } })
                                });
                            }}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Where should we send system alerts?</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">New Student Alerts</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Email on registration.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.notifications?.newStudentAlert || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ settings: { notifications: { ...tenant.settings?.notifications, newStudentAlert: checked } } })
                                        });
                                        window.location.reload();
                                    }}
                                />
                                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">BCC on User Emails</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Copy of booking emails.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.notifications?.enableBcc || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ settings: { notifications: { ...tenant.settings?.notifications, enableBcc: checked } } })
                                        });
                                        window.location.reload();
                                    }}
                                />
                                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Enable No-Show Fee Automation</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Automatically charge fees for missed classes.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.noShowFeeEnabled || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        try {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { noShowFeeEnabled: checked } })
                                            });
                                            window.location.reload();
                                        } catch (err) { alert("Failed to save"); }
                                    }}
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {tenant.settings?.noShowFeeEnabled && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Fee Amount (cents)</label>
                                <input
                                    type="number"
                                    className="w-full border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 bg-white dark:bg-zinc-800"
                                    placeholder="1000 ($10.00)"
                                    defaultValue={tenant.settings?.noShowFeeAmount || 1000}
                                    onBlur={async (e) => {
                                        const val = parseInt(e.target.value);
                                        if (val > 0) {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { noShowFeeAmount: val } })
                                            });
                                        }
                                    }}
                                />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Fee will be charged automatically when marking "No Show". ($10.00 = 1000)</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Auto-Mark No Shows</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Automatically mark expected students as No Show.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.noShowAutoMarkEnabled || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        try {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { noShowAutoMarkEnabled: checked } })
                                            });
                                            window.location.reload();
                                        } catch (err) { alert("Failed to save"); }
                                    }}
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {tenant.settings?.noShowAutoMarkEnabled && (
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">When to Mark?</label>
                                <select
                                    className="w-full border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 bg-white dark:bg-zinc-800"
                                    defaultValue={tenant.settings?.noShowAutoMarkTime || 'end_of_class'}
                                    onChange={async (e) => {
                                        const val = e.target.value;
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ settings: { noShowAutoMarkTime: val } })
                                        });
                                    }}
                                >
                                    <option value="start_of_class">Start of Class</option>
                                    <option value="15_mins_after_start">15 Minutes After Start</option>
                                    <option value="end_of_class">End of Class</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Integrations Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Integrations & Connections</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Connect third-party services to power your studio.</p>
                </div>

                <div className="space-y-8 divide-y divide-zinc-100 dark:divide-zinc-800">

                    {/* 1. Payment Processing (Stripe) */}
                    <div className="pt-4 first:pt-0">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <CreditCard className="h-4 w-4" /> Payment Processing
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenant.paymentProvider === 'connect' && tenant.stripeAccountId ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {tenant.paymentProvider === 'connect' && tenant.stripeAccountId ? 'Connected' : tenant.paymentProvider === 'custom' ? 'Custom Keys' : 'Not Configured'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div
                                onClick={async () => {
                                    if (tenant.paymentProvider !== 'connect') {
                                        if (confirm("Switch to Platform Managed?")) {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                                                method: 'PUT',
                                                body: JSON.stringify({ paymentProvider: 'connect' })
                                            });
                                            window.location.reload();
                                        }
                                    }
                                }}
                                className={`cursor-pointer border rounded-lg p-4 transition-all ${tenant.paymentProvider === 'connect' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                            >
                                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Platform Managed</div>
                                <div className="text-xs text-zinc-500 mt-1">We handle billing complexity. Standard fees.</div>
                                {tenant.paymentProvider === 'connect' && !tenant.stripeAccountId && (
                                    <a href={`https://studio-platform-api.studio-platform.workers.dev/studios/stripe/connect?tenantId=${tenant.id}`} className="mt-2 inline-block text-xs text-blue-600 hover:underline">Connect Stripe Account &rarr;</a>
                                )}
                            </div>

                            <div
                                onClick={async () => {
                                    if (tenant.paymentProvider !== 'custom') {
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                                            method: 'PUT',
                                            body: JSON.stringify({ paymentProvider: 'custom' })
                                        });
                                        window.location.reload();
                                    }
                                }}
                                className={`cursor-pointer border rounded-lg p-4 transition-all ${tenant.paymentProvider === 'custom' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                            >
                                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Self Managed (BYOK)</div>
                                <div className="text-xs text-zinc-500 mt-1">Use your own Stripe keys. No platform fees.</div>
                            </div>
                        </div>

                        {tenant.paymentProvider === 'custom' && (
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const stripePublishableKey = formData.get("stripePublishableKey");
                                const stripeSecretKey = formData.get("stripeSecretKey");
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                                        method: 'PUT',
                                        body: JSON.stringify({ paymentProvider: 'custom', stripePublishableKey, stripeSecretKey })
                                    });
                                    alert("Stripe keys saved.");
                                } catch (err: any) { alert(err.message); }
                            }} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded border border-zinc-200 dark:border-zinc-700 space-y-3">
                                <input name="stripePublishableKey" placeholder="Publishable Key (pk_...)" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                                <input name="stripeSecretKey" type="password" placeholder="Secret Key (sk_...)" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                                <button type="submit" className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded">Save Stripe Keys</button>
                            </form>
                        )}
                    </div>

                    {/* 2. Email (Resend) */}
                    <div className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Mail className="h-4 w-4" /> Email Service (Resend)
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(tenant.resendCredentials as any)?.apiKey ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {(tenant.resendCredentials as any)?.apiKey ? 'Configured' : 'Using Platform Default'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">Provide your own Resend API Key to send emails from your own domain.</p>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const resendApiKey = formData.get("resendApiKey");
                            try {
                                const token = await (window as any).Clerk?.session?.getToken();
                                await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                                    method: 'PUT',
                                    body: JSON.stringify({ resendApiKey })
                                });
                                alert("Email configuration saved.");
                                window.location.reload();
                            } catch (err: any) { alert(err.message); }
                        }} className="flex gap-2">
                            <input name="resendApiKey" type="password" placeholder="re_123..." className="flex-1 text-sm border-zinc-300 rounded px-3 py-2" />
                            <button type="submit" className="text-xs bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-2 rounded font-medium">Save Key</button>
                        </form>
                    </div>

                    {/* 3. SMS (Twilio) */}
                    <div className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> SMS Service (Twilio)
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(tenant.twilioCredentials as any)?.accountSid ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {(tenant.twilioCredentials as any)?.accountSid ? 'Configured' : 'Using Platform Default'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">Connect your Twilio account for custom SMS notifications.</p>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const twilioAccountSid = formData.get("twilioAccountSid");
                            const twilioAuthToken = formData.get("twilioAuthToken");
                            const twilioFromNumber = formData.get("twilioFromNumber");
                            try {
                                const token = await (window as any).Clerk?.session?.getToken();
                                await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                                    method: 'PUT',
                                    body: JSON.stringify({ twilioAccountSid, twilioAuthToken, twilioFromNumber })
                                });
                                alert("SMS configuration saved.");
                                window.location.reload();
                            } catch (err: any) { alert(err.message); }
                        }} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input name="twilioAccountSid" placeholder="Account SID" className="text-sm border-zinc-300 rounded px-3 py-2" defaultValue={(tenant.twilioCredentials as any)?.accountSid || ''} />
                            <input name="twilioAuthToken" type="password" placeholder="Auth Token" className="text-sm border-zinc-300 rounded px-3 py-2" />
                            <input name="twilioFromNumber" placeholder="From Number (+1...)" className="text-sm border-zinc-300 rounded px-3 py-2" defaultValue={(tenant.twilioCredentials as any)?.fromNumber || ''} />
                            <div className="md:col-span-3">
                                <button type="submit" className="text-xs bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-2 rounded font-medium">Save Twilio Config</button>
                            </div>
                        </form>
                    </div>

                    {/* 4. Video (Zoom) */}
                    <div className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Video className="h-4 w-4" /> Video Conferencing (Zoom)
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(tenant.zoomCredentials as any)?.accountId ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                {(tenant.zoomCredentials as any)?.accountId ? 'Configured' : 'Not Configured'}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">Server-to-Server OAuth credentials for creating meetings.</p>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const zoomAccountId = formData.get("zoomAccountId");
                            const zoomClientId = formData.get("zoomClientId");
                            const zoomClientSecret = formData.get("zoomClientSecret");
                            try {
                                const token = await (window as any).Clerk?.session?.getToken();
                                // Using unified endpoint now
                                await apiRequest(`/studios/${tenant.id}/integrations`, token, {
                                    method: 'PUT',
                                    body: JSON.stringify({ zoomAccountId, zoomClientId, zoomClientSecret })
                                });
                                alert("Zoom configuration saved.");
                                window.location.reload();
                            } catch (err: any) { alert(err.message); }
                        }} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input name="zoomAccountId" placeholder="Account ID" className="text-sm border-zinc-300 rounded px-3 py-2" defaultValue={(tenant.zoomCredentials as any)?.accountId || ''} />
                            <input name="zoomClientId" placeholder="Client ID" className="text-sm border-zinc-300 rounded px-3 py-2" defaultValue={(tenant.zoomCredentials as any)?.clientId || ''} />
                            <input name="zoomClientSecret" type="password" placeholder="Client Secret" className="text-sm border-zinc-300 rounded px-3 py-2" />
                            <div className="md:col-span-3">
                                <button type="submit" className="text-xs bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-2 rounded font-medium">Save Zoom Config</button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>

            {/* Billing & Subscription */}
            <Link to={`/studio/${tenant.slug}/settings/billing`} className="block bg-white border border-zinc-200 rounded-lg p-6 shadow-sm mb-8 hover:border-blue-300 transition-colors group">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">Billing & Subscription</h2>
                        <p className="text-sm text-zinc-500">Manage your plan, payment methods, and view usage.</p>
                    </div>
                    <div className="bg-zinc-100 p-2 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <CreditCard className="h-5 w-5" />
                    </div>
                </div>
            </Link>

            {/* Locations */}
            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Locations</h2>
                    <button
                        onClick={() => setIsAddingLocation(true)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                        <Plus className="h-4 w-4" />
                        Add Location
                    </button>
                </div>

                {isAddingLocation && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded p-4 mb-6">
                        <h3 className="text-sm font-semibold mb-3">New Location</h3>
                        <Form method="post" onSubmit={() => setIsAddingLocation(false)}>
                            <input type="hidden" name="intent" value="create_location" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Name</label>
                                    <input name="name" required placeholder="e.g. Main Studio" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Address (Optional)</label>
                                    <input name="address" placeholder="123 Yoga St" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingLocation(false)}
                                    className="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Save Location
                                </button>
                            </div>
                        </Form>
                    </div>
                )}

                <div className="space-y-3">
                    {locations.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 text-sm italic">
                            No locations added yet.
                        </div>
                    ) : (
                        locations.map((loc: any) => (
                            <div key={loc.id} className="flex items-center justify-between p-4 border border-zinc-100 rounded hover:bg-zinc-50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-zinc-900">{loc.name}</div>
                                        {loc.address && <div className="text-sm text-zinc-500">{loc.address}</div>}
                                    </div>
                                </div>
                                <Form method="post" onSubmit={(e: React.FormEvent) => {
                                    if (!confirm("Delete this location?")) e.preventDefault();
                                }}>
                                    <input type="hidden" name="intent" value="delete_location" />
                                    <input type="hidden" name="id" value={loc.id} />
                                    <button className="text-zinc-400 hover:text-red-600 p-2 rounded hover:bg-zinc-100">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </Form>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Data Import */}
            <Link to={`/studio/${tenant.slug}/settings/import`} className="block bg-white border border-zinc-200 rounded-lg p-6 shadow-sm mb-8 hover:border-blue-300 transition-colors group">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">Data Import</h2>
                        <p className="text-sm text-zinc-500">Migrate users and memberships from CSV.</p>
                    </div>
                    <div className="bg-zinc-100 p-2 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <FileText className="h-5 w-5" />
                    </div>
                </div>
            </Link>

            {/* Discounts */}
            <Link to={`/studio/${tenant.slug}/settings/discounts`} className="block bg-white border border-zinc-200 rounded-lg p-6 shadow-sm mb-8 hover:border-blue-300 transition-colors group">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">Discounts & Promo Codes</h2>
                        <p className="text-sm text-zinc-500">Create and manage coupon codes for your classes.</p>
                    </div>
                    <div className="bg-zinc-100 p-2 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Tag className="h-5 w-5" />
                    </div>
                </div>
            </Link>

        </div >
    );
}
