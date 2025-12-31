// @ts-ignore
import { ActionFunction, LoaderFunction } from "react-router";
// @ts-ignore
import { useLoaderData, useFetcher } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { FamilyManager } from "~/components/FamilyManager";
import { AvailabilityManager } from "~/components/AvailabilityManager";

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

            // NOTE: apiRequest helper usually handles base URL. We need to pass headers.
            const res = await fetch(`${process.env.API_URL || 'https://api.studio-platform-dev.pages.dev'}/users/me/family`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Tenant-Slug': params.slug!
                },
                body: JSON.stringify({ firstName, lastName, dob })
            });

            const data = await res.json();
            return data;
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return null;
}

function NotificationSettings({ token, slug }: { token: string, slug: string }) {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Fetch on mount
    useEffect(() => {
        apiRequest('/members/me', token, { headers: { 'X-Tenant-Slug': slug } })
            .then(res => {
                if (res.member) {
                    setSettings(res.member.settings || {});
                }
            })
            .catch(console.error); // Silently fail if not member
    }, [token, slug]);

    async function toggleSMS() {
        if (!settings) return;
        setLoading(true);

        const currentParams = settings.notifications || {};
        const newState = !currentParams.sms;

        try {
            const res = await apiRequest('/members/me/settings', token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    notifications: {
                        sms: newState
                    }
                })
            });
            if (res.settings) {
                setSettings(res.settings);
            }
        } catch (e) {
            alert("Failed to update settings");
        } finally {
            setLoading(false);
        }
    }

    if (!settings) return null; // Don't show if not loaded

    const smsActive = settings.notifications?.sms === true;

    return (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Notifications</h3>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-zinc-900">SMS Notifications</p>
                    <p className="text-sm text-zinc-500">Receive class reminders and updates via text.</p>
                </div>
                <button
                    onClick={toggleSMS}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsActive ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smsActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
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

            <AvailabilityManager token={token} tenantSlug={slug} />

            <FamilyManager token={token} />
        </div >
    );
}
