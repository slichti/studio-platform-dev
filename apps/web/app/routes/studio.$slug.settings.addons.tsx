// @ts-ignore
import { useLoaderData } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { MessageSquare, Check, X } from "lucide-react";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    // Fetch features
    // admin.features.ts mounts at /admin/tenants/:id/features? No, via `app.route('/admin', adminFeatureRoutes)` where routes are `/tenants/:id/features`
    // Wait, let's check index.ts routing for /admin.
    // Assuming simple endpoint or we reuse the tenant fetch which might return features?
    // Let's use the explicit admin features endpoint if possible, or filtered list.
    // For now, let's fetch current tenant details which often includes features or use the features endpoint.

    // Easier: GET /admin/tenants/me/features (if exists) or just GET /admin/tenants/:slug (if we have permissions). 
    // Actually `admin.features.ts` has `GET /tenants/:id/features`. We need tenant ID.
    // Let's get tenant ID first from slug? Or assume we have it in context?
    // Loader usually gets tenant info.

    // Let's rely on `apiRequest` to /admin/features (if we build a "me" route) or just list them.
    // To make it robust: `GET /admin/tenants/:id/features` requires ID.
    // We can get ID from `GET /tenants/lookup?slug=x` or similar.
    // Optimization: Just assume we can toggle via a known endpoint.

    // Let's try to fetch /admin/tenants/current/features if we implemented 'current' alias, or just fetch tenant first.
    let features: any[] = [];
    let tenantId = "";
    try {
        const tenantRes = await apiRequest(`/tenants/${slug}`, token);
        tenantId = tenantRes.id;

        if (tenantId) {
            const featuresRes = await apiRequest(`/admin/tenants/${tenantId}/features`, token);
            features = featuresRes || [];
        }
    } catch (e) {
        console.error("Failed to load addons", e);
    }

    return { features, tenantId, token, slug };
};

export default function AddonsPage() {
    const { features: initialFeatures, tenantId, token, slug } = useLoaderData<any>();
    const [features, setFeatures] = useState(initialFeatures || []);
    const [loading, setLoading] = useState<string | null>(null);

    const smsEnabled = features.find((f: any) => f.featureKey === 'sms' && f.enabled);

    async function toggleSMS() {
        if (!tenantId) return;
        setLoading('sms');
        const newState = !smsEnabled;

        try {
            await apiRequest(`/admin/tenants/${tenantId}/features`, token, {
                method: "POST", // Upsert
                body: JSON.stringify({
                    featureKey: 'sms',
                    enabled: newState,
                    source: 'manual' // logic would be 'subscription' in real stripe integ
                })
            });
            // Refresh
            const res = await apiRequest(`/admin/tenants/${tenantId}/features`, token);
            setFeatures(res);
        } catch (e) {
            alert("Failed to update add-on");
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900">Add-ons</h1>
                <p className="text-zinc-500">Enable power features for your studio.</p>
            </div>

            <div className="grid gap-6">
                {/* SMS Add-on Card */}
                <div className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm">
                    <div className="flex gap-4">
                        <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                            <MessageSquare className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-zinc-900">SMS Notifications</h3>
                            <p className="text-zinc-600 max-w-md mt-1">
                                Send automated text reminders for classes, waitlist alerts, and announcements to your students.
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                                <span className="font-medium text-zinc-900">$10.00/mo</span>
                                <span>+ $0.01 per message</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 md:mt-0 flex gap-3 items-center">
                        {smsEnabled ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
                                <Check className="h-4 w-4" /> Active
                            </span>
                        ) : (
                            <span className="text-zinc-400 text-sm">Inactive</span>
                        )}

                        <button
                            onClick={toggleSMS}
                            disabled={!!loading}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${smsEnabled
                                    ? "border-red-200 text-red-700 hover:bg-red-50"
                                    : "bg-blue-600 text-white border-transparent hover:bg-blue-700"
                                }`}
                        >
                            {loading === 'sms' ? "Updating..." : (smsEnabled ? "Disable" : "Enable Add-on")}
                        </button>
                    </div>
                </div>

                {/* Placeholder for others */}
                <div className="bg-zinc-50 border border-zinc-200 border-dashed rounded-xl p-6 text-center text-zinc-500">
                    More add-ons coming soon (Payroll, Branded App, etc.)
                </div>
            </div>
        </div>
    );
}
