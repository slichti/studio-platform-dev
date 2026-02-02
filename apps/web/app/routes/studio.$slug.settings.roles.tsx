import { useState } from "react";
import { useParams } from "react-router";
import { Plus, Shield, Check, Trash2, Edit2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { Label } from "~/components/ui/label";

import { useRoles, type Role } from "~/hooks/useRoles";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

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
    const { slug } = useParams();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    // Data
    const { data: roles = [], isLoading } = useRoles(slug!);

    // State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handlers
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['roles', slug] });

    const openCreate = () => {
        setEditingRole(null);
        setIsCreateOpen(true);
    };

    const openEdit = (role: Role) => {
        setEditingRole(role);
        setIsCreateOpen(true);
    };

    const handleDelete = async () => {
        if (!roleToDelete) return;
        try {
            const token = await getToken();
            await apiRequest(`/tenant/roles/${roleToDelete}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug! }
            });
            toast.success("Role deleted");
            refresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete role");
        } finally {
            setRoleToDelete(null);
        }
    };

    const handleSave = async (data: any, roleId?: string) => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const url = roleId ? `/tenant/roles/${roleId}` : "/tenant/roles";
            const method = roleId ? 'PUT' : 'POST';

            await apiRequest(url, token, {
                method,
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });

            toast.success(roleId ? "Role updated" : "Role created");
            refresh();
            setIsCreateOpen(false);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to save role");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Roles & Permissions</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Create custom roles to grant specific access to your team.</p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Create Role
                    </Button>
                </div>
            </header>

            <ComponentErrorBoundary>
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2, 3].map(i => (
                                <Card key={i} className="opacity-50">
                                    <div className="h-40 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl m-4" />
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* System Roles Info Card */}
                            <Card className="border-blue-100 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                            <Shield size={20} />
                                        </div>
                                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">System Roles</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="font-medium text-blue-800 dark:text-blue-200">Owner</div>
                                            <div className="text-sm text-blue-600 dark:text-blue-300/80">Full access to everything. Cannot be restricted.</div>
                                        </div>
                                        <div>
                                            <div className="font-medium text-blue-800 dark:text-blue-200">Instructor</div>
                                            <div className="text-sm text-blue-600 dark:text-blue-300/80">Can manage their own classes, schedule, and view roster.</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Custom Roles List */}
                            {roles.map(role => (
                                <Card key={role.id} className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{role.name}</h3>
                                                {role.description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{role.description}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                                                    <Edit2 size={16} className="text-zinc-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {(role.permissions || []).slice(0, 5).map((p: string) => (
                                                <Badge key={p} variant="secondary" className="font-normal text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
                                                    {p.replace(/_/g, ' ')}
                                                </Badge>
                                            ))}
                                            {(role.permissions?.length || 0) > 5 && (
                                                <Badge variant="outline" className="text-xs text-zinc-400">
                                                    +{role.permissions.length - 5} more
                                                </Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </ComponentErrorBoundary>

            {/* Create/Edit Modal */}
            <RoleModal
                isOpen={isCreateOpen}
                role={editingRole}
                onClose={() => setIsCreateOpen(false)}
                onSave={handleSave}
                isSubmitting={isSubmitting}
            />

            <ConfirmationDialog
                isOpen={!!roleToDelete}
                onClose={() => setRoleToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Role"
                message="Are you sure you want to delete this role? This will remove this role from all members."
                confirmText="Delete Role"
                isDestructive
            />
        </div>
    );
}

function RoleModal({ isOpen, role, onClose, onSave, isSubmitting }: { isOpen: boolean; role: Role | null; onClose: () => void; onSave: (data: any, id?: string) => void; isSubmitting: boolean }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [permissions, setPermissions] = useState<Set<string>>(new Set());

    // Init
    useState(() => {
        if (isOpen) {
            setName(role?.name || "");
            setDescription(role?.description || "");
            setPermissions(new Set(role?.permissions || []));
        }
    });

    const togglePerm = (key: string) => {
        const next = new Set(permissions);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setPermissions(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            description,
            permissions: Array.from(permissions)
        }, role?.id);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{role ? 'Edit Role' : 'Create Custom Role'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Role Name</Label>
                            <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Front Desk" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
                        </div>
                    </div>

                    <div className="space-y-6">
                        {PERMISSION_GROUPS.map(group => (
                            <div key={group.name} className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                <h3 className="font-semibold text-xs text-zinc-500 uppercase tracking-wider mb-3">{group.name}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {group.permissions.map(perm => {
                                        const isChecked = permissions.has(perm.key);
                                        return (
                                            <label
                                                key={perm.key}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                    isChecked
                                                        ? "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800"
                                                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                                    checked={isChecked}
                                                    onChange={() => togglePerm(perm.key)}
                                                />
                                                <span className={cn("text-sm font-medium", isChecked ? "text-blue-900 dark:text-blue-100" : "text-zinc-700 dark:text-zinc-300")}>{perm.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Role
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
