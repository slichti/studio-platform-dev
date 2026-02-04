import { ActionFunction, LoaderFunction } from "react-router";

import { useLoaderData, useFetcher } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { FamilyManager } from "~/components/FamilyManager";
import { AvailabilityManager } from "~/components/AvailabilityManager";
import { toast } from "sonner";
import { BillingHistory } from "~/components/billing-history";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    // We can rely on the client-side fetch in FamilyManager, or prefetch here.
    // For simplicity, we just pass the token or let the client handle it?
    // Actually, passing token to client component is risky if SSR? 
    // Usually we use useFetcher which handles auth via cookies or headers if setup.
    // But our API expects Bearer token. 

    // Let's just return the user profile for now.
    const user = await apiRequest("/users/me", token);
    return { user, token, slug };
};

export const action: ActionFunction = async (args: any) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "add_child") {
        const firstName = formData.get("firstName");
        const lastName = formData.get("lastName");
        const dob = formData.get("dob");

        try {
            // Include X-Tenant-Slug header or rely on context
            // Our apiRequest util might handle tenant header if configured?
            // checking apiRequest... assume it needs help or we rely on backend extracting from somewhere?
            // The backend /me/family requires tenant context. 
            // We usually pass tenant ID or Slug in header.

            // Refactored to use apiRequest
            const data = await apiRequest('/users/me/family', token, {
                method: 'POST',
                headers: {
                    'X-Tenant-Slug': params.slug!
                },
                body: JSON.stringify({ firstName, lastName, dob })
            });

            return data;
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return null;
}

function NotificationSettings({ token, slug }: { token: string, slug: string }) {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState<string | null>(null);

    // Fetch on mount
    useEffect(() => {
        apiRequest('/users/me/settings/notifications', token, { headers: { 'X-Tenant-Slug': slug } })
            .then(res => {
                if (res.settings) {
                    setSettings(res.settings);
                }
            })
            .catch(console.error);
    }, [token, slug]);

    async function toggleSetting(type: 'substitutions', channel: 'email' | 'sms' | 'push') {
        if (!settings) return;
        setLoading(`${type}-${channel}`);

        const currentState = settings.notifications?.[type]?.[channel] ?? (channel === 'email'); // Default Email=True, SMS/Push=False
        const newState = !currentState;

        try {
            const res = await apiRequest('/users/me/settings/notifications', token, {
                method: 'PUT',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    notifications: {
                        [type]: {
                            [channel]: newState
                        }
                    }
                })
            });
            if (res.settings) {
                setSettings(res.settings);
            } else {
                toast.success("Settings saved");
                // Manually update state if response doesn't return full object in expected format, 
                // but API should return 'settings'.
                setSettings((prev: any) => ({
                    ...prev,
                    notifications: {
                        ...prev.notifications,
                        [type]: {
                            ...prev.notifications?.[type],
                            [channel]: newState
                        }
                    }
                }));
            }
        } catch (e) {
            toast.error("Failed to update settings");
        } finally {
            setLoading(null);
        }
    }

    if (!settings) return null;

    const subEmail = settings.notifications?.substitutions?.email !== false; // Default True
    const subSms = settings.notifications?.substitutions?.sms === true; // Default False
    const subPush = settings.notifications?.substitutions?.push === true; // Default False

    return (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>

            <div className="space-y-6">
                <div>
                    <h4 className="text-sm font-medium text-zinc-900 mb-2">Substitute Alerts</h4>
                    <p className="text-sm text-zinc-500 mb-4">Choose how you want to be notified when coverage is needed or found.</p>

                    <div className="flex flex-col gap-3">
                        {/* Email Toggle */}
                        <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-md">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${subEmail ? 'bg-blue-100 text-blue-600' : 'bg-zinc-200 text-zinc-400'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">Email Alerts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting('substitutions', 'email')}
                                disabled={loading !== null}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${subEmail ? 'bg-blue-600' : 'bg-zinc-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Push Toggle */}
                        <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-md">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${subPush ? 'bg-purple-100 text-purple-600' : 'bg-zinc-200 text-zinc-400'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">Push Notifications (App)</p>
                                    <p className="text-xs text-zinc-500">Requires mobile app installation.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting('substitutions', 'push')}
                                disabled={loading !== null}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${subPush ? 'bg-purple-600' : 'bg-zinc-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subPush ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* SMS Toggle */}
                        <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-md">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${subSms ? 'bg-green-100 text-green-600' : 'bg-zinc-200 text-zinc-400'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">SMS Alerts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting('substitutions', 'sms')}
                                disabled={loading !== null}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${subSms ? 'bg-green-600' : 'bg-zinc-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subSms ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function StudioProfilePage() {
    const { user, token, slug } = useLoaderData<{ user: any, token: string, slug: string }>();

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">Your Profile</h1>
            <p className="text-zinc-500 mb-8">Manage your information and family members.</p>

            <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Personal Info</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase">First Name</label>
                        <p className="text-zinc-900">{user.profile?.firstName}</p>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Last Name</label>
                        <p className="text-zinc-900">{user.profile?.lastName}</p>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Email</label>
                        <p className="text-zinc-900">{user.email}</p>
                    </div>
                </div>
            </div>

            <NotificationSettings token={token} slug={slug} />

            <div className="mb-6">
                <BillingHistory token={token} tenantSlug={slug} />
            </div>

            <AvailabilityManager token={token} tenantSlug={slug} />

            <FamilyManager token={token} />
        </div >
    );
}
