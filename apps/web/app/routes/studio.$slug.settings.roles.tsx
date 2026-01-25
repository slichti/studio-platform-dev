
import { useState, useEffect } from "react";
import { useOutletContext, useParams } from "react-router";
import { Plus, Shield, Check, Trash2, Edit2, Info } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "~/utils/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "~/components/ui/dialog"; // Assuming standard Shadcn/UI components exist, if not I will build modals manually or use Radix defaults if available.
// Actually, looking at other files, I saw `ConfirmationDialog` import but not standard Shadcn.
// I will build a simple Modal overlay if needed or reuse existing patterns.
// `studio.$slug.settings._index.tsx` Step 5951 used `ConfirmationDialog` from `~/components/Dialogs`.
// I will just use standard HTML/Tailwind overlays to be safe and self-contained, or check `~/components/Dialogs`.

const PERMISSION_GROUPS = [
    {
        name: "Financials",
        permissions: [
            { key: 'view_financials', label: 'View Financials & Reports' },
            { key: 'manage_financials', label: 'Manage Payroll & Payouts' }
        ]
    },
    {
        name: "Members",
        permissions: [
            { key: 'view_members', label: 'View Member Profiles' },
            { key: 'manage_members', label: 'Edit Member Details & Notes' },
            { key: 'export_data', label: 'Export Data (CSV)' }
        ]
    },
    {
        name: "Schedule",
        permissions: [
            { key: 'view_schedule', label: 'View Schedule' },
            { key: 'manage_schedule', label: 'Create/Edit Classes' },
            { key: 'manage_bookings', label: 'Manage Bookings & Check-ins' }
        ]
    },
    {
        name: "Operations",
        permissions: [
            { key: 'manage_waivers', label: 'Manage Waivers' },
            { key: 'manage_staff', label: 'Manage Staff & Availability' },
            { key: 'manage_roles', label: 'Manage Roles & Permissions' }
        ]
    },
    {
        name: "Marketing",
        permissions: [
            { key: 'view_marketing', label: 'View Campaigns' },
            { key: 'manage_marketing', label: 'Create Campaigns & Automations' }
        ]
    },
    {
        name: "Settings",
        permissions: [
            { key: 'manage_settings', label: 'Manage Studio Settings' }
        ]
    }
];

export default function RolesSettings() {
    const { tenant } = useOutletContext<any>();
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<any | null>(null);

    // Form State
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());

    const fetchRoles = async () => {
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res = await apiRequest(`/tenant/roles`, token, {
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            setRoles(res || []);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load roles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const openCreate = () => {
        setFormName("");
        setFormDesc("");
        setFormPermissions(new Set());
        setEditingRole(null);
        setIsCreateOpen(true);
    };

    const openEdit = (role: any) => {
        setFormName(role.name);
        setFormDesc(role.description || "");
        setFormPermissions(new Set(role.permissions || []));
        setEditingRole(role);
        setIsCreateOpen(true);
    };

    const handleSave = async () => {
        if (!formName) return toast.error("Role name is required");

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const body = {
                name: formName,
                description: formDesc,
                permissions: Array.from(formPermissions)
            };

            if (editingRole) {
                await apiRequest(`/tenant/roles/${editingRole.id}`, token, {
                    method: 'PUT',
                    headers: { 'X-Tenant-Slug': tenant.slug },
                    body: JSON.stringify(body)
                });
                toast.success("Role updated");
            } else {
                await apiRequest(`/tenant/roles`, token, {
                    method: 'POST',
                    headers: { 'X-Tenant-Slug': tenant.slug },
                    body: JSON.stringify(body)
                });
                toast.success("Role created");
            }
            setIsCreateOpen(false);
            fetchRoles();
        } catch (e: any) {
            toast.error(e.message || "Failed to save role");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will remove this role from all members.")) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/roles/${id}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            toast.success("Role deleted");
            fetchRoles();
        } catch (e) {
            toast.error("Failed to delete role");
        }
    };

    const togglePerm = (key: string) => {
        const next = new Set(formPermissions);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setFormPermissions(next);
    };

    return (
        <div className="max-w-5xl mx-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Roles & Permissions</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Create custom roles to grant specific access to your team.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-medium hover:opacity-90 transition"
                >
                    <Plus size={18} />
                    Create Role
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-zinc-500">Loading roles...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* System Roles Info Card */}
                    <div className="border border-blue-100 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="text-blue-600 dark:text-blue-400 h-6 w-6" />
                            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">System Roles</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="font-medium text-blue-800 dark:text-blue-200">Owner</div>
                                <div className="text-sm text-blue-600 dark:text-blue-300">Full access to everything. Cannot be restricted.</div>
                            </div>
                            <div>
                                <div className="font-medium text-blue-800 dark:text-blue-200">Instructor</div>
                                <div className="text-sm text-blue-600 dark:text-blue-300">Can manage their own classes, schedule, and view roster.</div>
                            </div>
                        </div>
                    </div>

                    {/* Custom Roles List */}
                    {roles.map(role => (
                        <div key={role.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:border-zinc-300 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{role.name}</h3>
                                    {role.description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{role.description}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEdit(role)}
                                        className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(role.id)}
                                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(role.permissions || []).slice(0, 5).map((p: string) => (
                                    <span key={p} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs rounded border border-zinc-200 dark:border-zinc-700">
                                        {p.replace(/_/g, ' ')}
                                    </span>
                                ))}
                                {(role.permissions?.length || 0) > 5 && (
                                    <span className="px-2 py-1 bg-zinc-50 text-zinc-400 text-xs rounded border border-zinc-100">
                                        +{role.permissions.length - 5} more
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal Overlay */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingRole ? 'Edit Role' : 'Create Custom Role'}</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                                <span className="sr-only">Close</span>
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Role Name</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        placeholder="e.g. Front Desk"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                                        placeholder="Optional description"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                {PERMISSION_GROUPS.map(group => (
                                    <div key={group.name} className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                        <h3 className="font-semibold text-sm text-zinc-500 uppercase tracking-wider mb-3">{group.name}</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {group.permissions.map(perm => (
                                                <label key={perm.key} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                                        checked={formPermissions.has(perm.key)}
                                                        onChange={() => togglePerm(perm.key)}
                                                    />
                                                    <span className="text-sm font-medium">{perm.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl">
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="px-4 py-2 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold rounded-lg hover:opacity-90 transition shadow-sm"
                            >
                                Save Role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
