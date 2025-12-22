import { Link, useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Modal } from "../components/Modal";
import { ErrorDialog, ConfirmationDialog } from "../components/Dialogs";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const tenants = await apiRequest("/admin/tenants", token);
        return { tenants, error: null };
    } catch (e: any) {
        console.error("Loader failed", e);
        return {
            tenants: [],
            error: e.message || "Unauthorized",
            debug: e.data?.debug
        };
    }
};

export default function AdminTenants() {
    const { tenants: initialTenants } = useLoaderData<any>();
    const [tenants, setTenants] = useState(initialTenants);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Dialog State
    const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: "" });
    const [successDialog, setSuccessDialog] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: "" });

    const { getToken } = useAuth();
    const navigate = useNavigate();

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        ownerEmail: "", // In a real app we'd look up user or create invite
        plan: "basic"
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = await getToken();
            const res = await apiRequest("/admin/tenants", token, {
                method: "POST",
                body: JSON.stringify({
                    name: formData.name,
                    slug: formData.slug,
                    ownerEmail: formData.ownerEmail
                })
            });

            if (res.error) {
                setErrorDialog({ isOpen: true, message: res.error });
            } else {
                setTenants([...tenants, res.tenant]);
                setIsCreateOpen(false);
                setFormData({ name: "", slug: "", ownerEmail: "", plan: "basic" });
                setSuccessDialog({ isOpen: true, message: `Tenant ${res.tenant.name} (${res.tenant.slug}) has been provisioned successfully.` });
            }
        } catch (e: any) {
            console.error(e);
            setErrorDialog({ isOpen: true, message: e.message || "Failed to create tenant. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Dialogs */}
            <ErrorDialog
                isOpen={errorDialog.isOpen}
                onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })}
                title="Error"
                message={errorDialog.message}
            />
            <ConfirmationDialog
                isOpen={successDialog.isOpen}
                onClose={() => setSuccessDialog({ ...successDialog, isOpen: false })}
                onConfirm={() => setSuccessDialog({ ...successDialog, isOpen: false })}
                title="Tenant Provisioned"
                message={successDialog.message}
                confirmText="Done"
                cancelText="Close"
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Tenant Management</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                    <span className="text-lg">+</span> Spin Up Tenant
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                {/* Error Display */}
                {(tenants as any)?.error && (
                    <div className="p-4 bg-red-50 text-red-700 border-b border-red-100 mb-4">
                        <div className="font-bold">Access Denied: {(tenants as any).error}</div>
                        {(tenants as any).debug && (
                            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                                {JSON.stringify((tenants as any).debug, null, 2)}
                            </pre>
                        )}
                        <p className="text-xs mt-2">Try refreshing to re-trigger admin bootstrapping.</p>
                    </div>
                )}

                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tenant</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Slug</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {Array.isArray(tenants) && tenants.map((t: any) => (
                            <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-900">{t.name}</td>
                                <td className="px-6 py-4 text-zinc-600 font-mono text-xs bg-zinc-100 rounded self-start inline-block px-1 mt-1">{t.slug}</td>
                                <td className="px-6 py-4 text-zinc-400 text-xs font-mono">{t.id}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Manage</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(!Array.isArray(tenants) || tenants.length === 0) && (
                    <div className="p-8 text-center text-zinc-500">
                        No tenants found. Create one to get started.
                    </div>
                )}
            </div>

            {/* Create Tenant Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Spin Up New Tenant"
            >
                <div className="mb-6">
                    <p className="text-zinc-500 text-sm">
                        Automated provisioning: This will create a database record, set up initial owner permissions, and allocate resources.
                    </p>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Studio Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Zen Garden Yoga"
                            value={formData.name}
                            onChange={(e) => {
                                setFormData({ ...formData, name: e.target.value });
                                // Auto-generate slug
                                if (!formData.slug) {
                                    setFormData(prev => ({
                                        ...prev,
                                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-')
                                    }));
                                }
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">URL Slug</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 text-zinc-500 text-sm">
                                /studio/
                            </span>
                            <input
                                type="text"
                                required
                                className="flex-1 px-3 py-2 border border-zinc-300 rounded-r-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                placeholder="zen-garden"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Owner Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="owner@example.com"
                            value={formData.ownerEmail}
                            onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                        />
                        <p className="text-xs text-zinc-500 mt-1">We'll link to an existing user or create a placeholder.</p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                        >
                            {loading ? "Provisioning..." : "Launch Studio"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
