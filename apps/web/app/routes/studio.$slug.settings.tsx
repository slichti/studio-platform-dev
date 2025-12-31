import { useState, useEffect } from "react";
// @ts-ignore
import { useOutletContext, useLoaderData, Form, useNavigation, useSubmit, Link } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router"; // Add types
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/ssr.server";
import { Plus, Trash2, MapPin, CreditCard } from "lucide-react";

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
                <h1 className="text-2xl font-bold text-zinc-900">Studio Settings</h1>
            </div>

            {/* General Settings */}
            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-4">General Information</h2>

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
        </div>
    );
}
