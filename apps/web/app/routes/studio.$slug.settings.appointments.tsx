// @ts-ignore
import { useLoaderData, useFetcher, Link, useOutletContext } from "react-router";
// @ts-ignore
import { LoaderFunction, ActionFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Plus, Edit2, Trash2, Clock, DollarSign, Calendar, Save, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

const API_URL = typeof window !== 'undefined' ? (window as any).ENV?.API_URL : '';

interface AppointmentService {
    id: string;
    title: string;
    description?: string;
    durationMinutes: number;
    price: number;
    currency: string;
    isActive: boolean;
}

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const slug = args.params.slug;
    const token = await getToken();

    let services: AppointmentService[] = [];
    try {
        const res: any = await apiRequest("/appointments/services", token, {
            headers: { 'X-Tenant-Slug': slug }
        });
        services = res.services || [];
    } catch (e) {
        console.error("Failed to load services", e);
    }

    return { services, slug, token };
};

export default function AppointmentServicesSettings() {
    const { services: initialServices, slug, token } = useLoaderData<any>();
    const { roles = [] } = useOutletContext<any>() || {};
    const isOwnerOrAdmin = roles.includes('owner') || roles.includes('admin');

    const [services, setServices] = useState<AppointmentService[]>(initialServices);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AppointmentService | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        durationMinutes: 60,
        price: 0,
        currency: 'usd'
    });

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            durationMinutes: 60,
            price: 0,
            currency: 'usd'
        });
        setEditingId(null);
        setShowCreateForm(false);
    };

    const handleCreate = async () => {
        if (!formData.title.trim()) {
            toast.error("Title is required");
            return;
        }

        setSaving(true);
        try {
            const res: any = await apiRequest("/appointments/services", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(formData)
            }, API_URL);

            if (res.id) {
                setServices([...services, { ...formData, id: res.id, isActive: true }]);
                toast.success("Service created!");
                resetForm();
            } else {
                toast.error(res.error || "Failed to create service");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingId || !formData.title.trim()) {
            toast.error("Title is required");
            return;
        }

        setSaving(true);
        try {
            const res: any = await apiRequest(`/appointments/services/${editingId}`, token, {
                method: "PUT",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(formData)
            }, API_URL);

            if (res.success) {
                setServices(services.map(s => s.id === editingId ? { ...s, ...formData } : s));
                toast.success("Service updated!");
                resetForm();
            } else {
                toast.error(res.error || "Failed to update service");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        try {
            const res: any = await apiRequest(`/appointments/services/${deleteTarget.id}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug }
            }, API_URL);

            if (res.success) {
                setServices(services.filter(s => s.id !== deleteTarget.id));
                toast.success("Service deleted!");
            } else {
                toast.error(res.error || "Failed to delete service");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
        setDeleteTarget(null);
    };

    const startEdit = (service: AppointmentService) => {
        setFormData({
            title: service.title,
            description: service.description || '',
            durationMinutes: service.durationMinutes,
            price: service.price,
            currency: service.currency
        });
        setEditingId(service.id);
        setShowCreateForm(false);
    };

    const startCreate = () => {
        resetForm();
        setShowCreateForm(true);
    };

    if (!isOwnerOrAdmin) {
        return (
            <div className="p-8 text-center">
                <p className="text-zinc-500">You don't have permission to manage appointment services.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link to={`/studio/${slug}/appointments`} className="p-2 hover:bg-zinc-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Appointment Services</h1>
                        <p className="text-zinc-500 text-sm">Configure 1:1 bookable sessions for your studio</p>
                    </div>
                </div>
                {!showCreateForm && !editingId && (
                    <button
                        onClick={startCreate}
                        className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition"
                    >
                        <Plus size={16} />
                        Add Service
                    </button>
                )}
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingId) && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 shadow-sm">
                    <h3 className="font-semibold text-lg mb-4">
                        {editingId ? 'Edit Service' : 'Create New Service'}
                    </h3>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Service Name *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Private Yoga Session"
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="What students can expect from this session..."
                                rows={3}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    Duration (minutes)
                                </label>
                                <input
                                    type="number"
                                    value={formData.durationMinutes}
                                    onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                                    min={15}
                                    step={15}
                                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    Price
                                </label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 bg-zinc-100 border border-r-0 border-zinc-200 rounded-l-lg text-zinc-500">
                                        $
                                    </span>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                                        min={0}
                                        className="w-full px-3 py-2 border border-zinc-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                            <button
                                onClick={resetForm}
                                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingId ? handleUpdate : handleCreate}
                                disabled={saving}
                                className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition disabled:opacity-50"
                            >
                                {saving ? (
                                    <span className="animate-pulse">Saving...</span>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {editingId ? 'Update Service' : 'Create Service'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Services List */}
            {services.length === 0 && !showCreateForm && (
                <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center">
                    <Calendar className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-zinc-700 mb-2">No services yet</h3>
                    <p className="text-zinc-500 mb-6">
                        Create your first appointment service to allow students to book 1:1 sessions.
                    </p>
                    <button
                        onClick={startCreate}
                        className="inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition"
                    >
                        <Plus size={18} />
                        Create Your First Service
                    </button>
                </div>
            )}

            {services.length > 0 && (
                <div className="space-y-3">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{service.title}</h3>
                                    {service.description && (
                                        <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{service.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 mt-3 text-sm text-zinc-600">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {service.durationMinutes} min
                                        </div>
                                        <div className="flex items-center gap-1 font-medium">
                                            <DollarSign className="h-4 w-4" />
                                            {service.price === 0 ? 'Free' : `${service.price}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => startEdit(service)}
                                        className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
                                        title="Edit"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(service)}
                                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmationDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Service"
                message={`Are you sure you want to delete "${deleteTarget?.title}"? This will deactivate the service and it will no longer be bookable.`}
                confirmText="Delete"
                isDestructive={true}
            />
        </div>
    );
}
