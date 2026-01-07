// @ts-ignore
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useSubmit, Form, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { MapPin, Plus, Edit, Trash2, Check, X, Star, Clock, Phone, Building } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const locationsData = await apiRequest('/locations', token, { headers: { 'X-Tenant-Slug': slug } }) as any;
        return { locations: locationsData || [] };
    } catch (e) {
        console.error("Locations Loader Error", e);
        return { locations: [] };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'create' || intent === 'update') {
        const id = formData.get("id");
        const payload = {
            name: formData.get("name"),
            address: formData.get("address"),
            timezone: formData.get("timezone"),
            isPrimary: formData.get("isPrimary") === "true",
            isActive: formData.get("isActive") !== "false",
            settings: {
                phone: formData.get("phone"),
                hours: formData.get("hours")
            }
        };

        await apiRequest(id ? `/locations/${id}` : '/locations', token, {
            method: id ? 'PATCH' : 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify(payload)
        });
    }

    if (intent === 'delete') {
        const id = formData.get("id");
        await apiRequest(`/locations/${id}`, token, {
            method: 'DELETE',
            headers: { 'X-Tenant-Slug': slug }
        });
    }

    if (intent === 'set-primary') {
        const id = formData.get("id");
        await apiRequest(`/locations/${id}/set-primary`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug }
        });
    }

    return { success: true };
};

export default function LocationsSettings() {
    const { locations } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const [isEditing, setIsEditing] = useState<any | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this location?")) {
            submit({ intent: 'delete', id }, { method: 'post' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-lg text-white"><MapPin size={20} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Locations</h1>
                            <p className="text-sm text-zinc-500">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Location
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {locations.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500">
                        <Building size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No locations configured</p>
                        <button onClick={() => setIsCreating(true)} className="mt-4 text-sm text-zinc-900 underline">Add your first location</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {locations.map((location: any) => (
                            <div key={location.id} className={`bg-white rounded-xl border ${location.isPrimary ? 'border-amber-300 ring-2 ring-amber-100' : 'border-zinc-200'} p-5`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl ${location.isPrimary ? 'bg-amber-100' : 'bg-zinc-100'}`}>
                                            <MapPin size={24} className={location.isPrimary ? 'text-amber-600' : 'text-zinc-500'} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-zinc-900">{location.name}</h3>
                                                {location.isPrimary && (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                                                        <Star size={10} /> Primary
                                                    </span>
                                                )}
                                                {!location.isActive && (
                                                    <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-xs font-medium">Inactive</span>
                                                )}
                                            </div>
                                            {location.address && <p className="text-sm text-zinc-500 mt-1">{location.address}</p>}
                                            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                                                {location.timezone && <span className="flex items-center gap-1"><Clock size={12} /> {location.timezone}</span>}
                                                {location.settings?.phone && <span className="flex items-center gap-1"><Phone size={12} /> {location.settings.phone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!location.isPrimary && (
                                            <Form method="post">
                                                <input type="hidden" name="intent" value="set-primary" />
                                                <input type="hidden" name="id" value={location.id} />
                                                <button type="submit" className="p-2 hover:bg-amber-50 rounded-lg text-amber-600" title="Set as primary">
                                                    <Star size={16} />
                                                </button>
                                            </Form>
                                        )}
                                        <button onClick={() => setIsEditing(location)} className="p-2 hover:bg-zinc-100 rounded-lg"><Edit size={16} /></button>
                                        <button onClick={() => handleDelete(location.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            {(isEditing || isCreating) && (
                <LocationModal
                    location={isEditing}
                    onClose={() => { setIsEditing(null); setIsCreating(false); }}
                    onSave={(data: any) => {
                        const formData = new FormData();
                        formData.append("intent", isEditing ? "update" : "create");
                        if (isEditing) formData.append("id", isEditing.id);
                        Object.entries(data).forEach(([key, value]) => {
                            formData.append(key, String(value));
                        });
                        submit(formData, { method: "post" });
                        setIsEditing(null);
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
}

function LocationModal({ location, onClose, onSave }: { location?: any; onClose: () => void; onSave: (data: any) => void }) {
    const [name, setName] = useState(location?.name || "");
    const [address, setAddress] = useState(location?.address || "");
    const [timezone, setTimezone] = useState(location?.timezone || "UTC");
    const [phone, setPhone] = useState(location?.settings?.phone || "");
    const [hours, setHours] = useState(location?.settings?.hours || "");
    const [isPrimary, setIsPrimary] = useState(location?.isPrimary || false);
    const [isActive, setIsActive] = useState(location?.isActive !== false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, address, timezone, phone, hours, isPrimary, isActive });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">{location ? "Edit Location" : "New Location"}</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Name *</label>
                        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="Main Studio" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Address</label>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" placeholder="123 Main St, City, State" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Timezone</label>
                            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg">
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">Eastern</option>
                                <option value="America/Chicago">Central</option>
                                <option value="America/Denver">Mountain</option>
                                <option value="America/Los_Angeles">Pacific</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="w-4 h-4" />
                            Primary location
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
                            Active
                        </label>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
