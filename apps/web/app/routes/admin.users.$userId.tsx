// @ts-ignore
import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Modal } from "../components/Modal";
import { ErrorDialog, ConfirmationDialog } from "../components/Dialogs";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const userId = args.params.userId;
    const apiUrl = (args.context.env as any).VITE_API_URL;
    try {
        const [user, tenants] = await Promise.all([
            apiRequest(`/admin/users/${userId}`, token, {}, apiUrl),
            apiRequest(`/admin/tenants`, token, {}, apiUrl)
        ]);
        return { user, tenants };
    } catch (e) {
        throw new Response("User Not Found", { status: 404 });
    }
};

export default function EditUser() {
    const { user, tenants } = useLoaderData<any>();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [isSystemAdmin, setIsSystemAdmin] = useState(user.isSystemAdmin);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Membership State
    const [memberships, setMemberships] = useState<any[]>(user.memberships || []);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newMembership, setNewMembership] = useState({ tenantId: "", role: "student" });
    const [statusDialog, setStatusDialog] = useState<{ isOpen: boolean, type: 'error' | 'success', message: string }>({ isOpen: false, type: 'success', message: '' });

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const token = await getToken();
            await apiRequest(`/admin/users/${user.id}`, token, {
                method: 'PUT',
                body: JSON.stringify({ isSystemAdmin })
            });
            navigate("/admin/users");
        } catch (e: any) {
            setError(e.message || "Failed to update user");
        } finally {
            setSaving(false);
        }
    };

    const handleAddMembership = async () => {
        if (!newMembership.tenantId) return;
        try {
            const token = await getToken();
            await apiRequest(`/admin/users/${user.id}/memberships`, token, {
                method: 'POST',
                body: JSON.stringify(newMembership)
            });

            // Optimistic update using tenants list to find name
            const tenant = tenants.find((t: any) => t.id === newMembership.tenantId);
            setMemberships([...memberships, { id: 'temp', tenant, role: newMembership.role }]);

            setIsAddModalOpen(false);
            setNewMembership({ tenantId: "", role: "student" });
            setStatusDialog({ isOpen: true, type: 'success', message: "Access granted successfully." });
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: e.message });
        }
    };

    const removeMembership = async (tenantId: string) => {
        if (!confirm("Are you sure you want to remove this user from the studio?")) return;

        try {
            const token = await getToken();
            await apiRequest(`/admin/users/${user.id}/memberships`, token, {
                method: 'DELETE',
                body: JSON.stringify({ tenantId })
            });

            setMemberships(memberships.filter((m: any) => m.tenant.id !== tenantId));
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: e.message });
        }
    };

    const handleImpersonate = async () => {
        if (!confirm(`You are about to sign in as ${user.email}. This will assume their identity.`)) return;
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/impersonate", token, {
                method: "POST",
                body: JSON.stringify({ targetUserId: user.id })
            });

            if (res.token) {
                // Determine redirect URL
                // We need to look up a slug from their memberships.
                // If they are membership of multiple, pick first one or let them choose.
                // For now, assume first membership or default dashboard.
                // Or maybe redirect to a specific tenant if we can.

                // Store token in localStorage (or cookie, but our app uses Authorization header)
                // Wait, frontend usually relies on Clerk. 
                // Our `apiRequest` checks for `impersonation_token`.
                // So we set it and reload.

                localStorage.setItem("impersonation_token", res.token);

                // Redirect logic:
                // If they have membership, go to that studio.
                if (memberships.length > 0) {
                    const slug = memberships[0].tenant.slug;
                    // Impersonation relies on client side token override.
                    // We need to navigate to a page where this user has access.
                    // Let's go to `/studio/${slug}`.
                    window.location.href = `/studio/${slug}`;
                } else {
                    alert("User has no studio memberships to access.");
                }
            }
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: `Impersonation failed: ${e.message}` });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate("/admin/users")}
                        className="text-sm text-zinc-500 hover:text-zinc-900 mb-2 flex items-center gap-1"
                    >
                        ← Back to Directory
                    </button>
                    <h2 className="text-2xl font-bold">Edit User</h2>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleImpersonate}
                        className="px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        Impersonate
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Basic Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-500 overflow-hidden">
                                {user.profile?.portraitUrl ? <img src={user.profile.portraitUrl} className="w-full h-full object-cover" /> : (user.profile?.firstName?.[0] || 'U')}
                            </div>
                            <div>
                                <div className="font-semibold text-xl">
                                    {(user.email === 'slichti@gmail.com' && user.profile?.firstName === 'System' && user.profile?.lastName === 'Admin')
                                        ? 'Steven Lichti'
                                        : `${user.profile?.firstName} ${user.profile?.lastName}`}
                                </div>
                                <div className="text-zinc-500">{user.email}</div>
                                <div className="text-zinc-400 font-mono text-xs mt-1">{user.id}</div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-100">
                            <h3 className="text-sm font-medium text-zinc-900 mb-4">Platform Roles</h3>
                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={isSystemAdmin}
                                    onChange={(e) => setIsSystemAdmin(e.target.checked)}
                                    className="mt-1 w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                    <div className="font-medium text-zinc-900">System Administrator</div>
                                    <div className="text-sm text-zinc-500 mt-1">Grants full access to modify all tenants, users, and system settings.</div>
                                </div>
                            </label>
                        </div>

                        {/* Save Button for Basic Info */}
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Update Profile"}
                            </button>
                        </div>
                        {error && <div className="mt-4 text-red-600 text-sm text-center">{error}</div>}
                    </div>
                </div>

                {/* Right Column: Tenant Access */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">Studio Access</h3>
                            <button onClick={() => setIsAddModalOpen(true)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-medium">+ Add</button>
                        </div>

                        {memberships.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                                This user does not belong to any studios.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {memberships.map((m: any) => (
                                    <div key={m.tenant.id} className="p-3 border border-zinc-200 rounded-lg bg-zinc-50/50 flex justify-between items-center group">
                                        <div>
                                            <div className="font-medium text-sm text-zinc-900">{m.tenant.name}</div>
                                            <div className="text-xs text-zinc-500 capitalize">
                                                {m.role || m.roles?.map((r: any) => r.role).join(', ') || 'No Role'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeMembership(m.tenant.id)}
                                            className="text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1"
                                            title="Remove access"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 text-xs text-zinc-400 leading-relaxed">
                            Users can have different roles (Owner, Instructor, Student) in different studios.
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Membership Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Grant Studio Access">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Select Studio</label>
                        <select
                            className="w-full border border-zinc-300 rounded-md p-2 text-sm"
                            value={newMembership.tenantId}
                            onChange={(e) => setNewMembership({ ...newMembership, tenantId: e.target.value })}
                        >
                            <option value="">-- Select a Studio --</option>
                            {tenants.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
                        <select
                            className="w-full border border-zinc-300 rounded-md p-2 text-sm"
                            value={newMembership.role}
                            onChange={(e) => setNewMembership({ ...newMembership, role: e.target.value })}
                        >
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="owner">Owner</option>
                        </select>
                        <div className="mt-2 text-xs text-zinc-500 bg-zinc-50 p-2 rounded border border-zinc-200 leading-relaxed">
                            <strong>Note:</strong> Owners generally function as Instructors and Students as well. Instructors often participate as Students.
                            <br /><br />
                            This system treats roles independently, so you may assign multiple roles to a user for a single studio if needed.
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <button onClick={() => setIsAddModalOpen(false)} className="px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded text-sm">Cancel</button>
                        <button
                            onClick={handleAddMembership}
                            disabled={!newMembership.tenantId}
                            className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                        >
                            Grant Access
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Status Dialogs */}
            <ConfirmationDialog
                isOpen={statusDialog.isOpen && statusDialog.type === 'success'}
                onClose={() => setStatusDialog({ ...statusDialog, isOpen: false })}
                onConfirm={() => setStatusDialog({ ...statusDialog, isOpen: false })}
                title="Success"
                message={statusDialog.message}
                confirmText="OK"
                cancelText="Close"
            />
            <ErrorDialog
                isOpen={statusDialog.isOpen && statusDialog.type === 'error'}
                onClose={() => setStatusDialog({ ...statusDialog, isOpen: false })}
                title="Error"
                message={statusDialog.message}
            />
        </div>
    );
}
