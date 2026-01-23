import { useLoaderData, Link, useSearchParams, Form, useSubmit, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

interface Tenant {
    id: string;
    name: string;
    slug?: string;
}

interface Membership {
    tenantId: string;
    role?: string;
    roles?: { role: string }[];
    tenant: Tenant;
}

interface UserProfile {
    firstName?: string;
    lastName?: string;
    portraitUrl?: string;
}

interface User {
    id: string;
    email: string;
    role: string;
    isPlatformAdmin?: boolean;
    createdAt: string;
    lastActiveAt?: string | null;
    profile?: UserProfile;
    memberships?: Membership[];
    contextRole?: string; // For grouped display
    mfaEnabled?: boolean;
}

interface LoaderData {
    users: User[];
    // ... (skip lines)
    <div className = "col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" onClick = { () => {
                        const current = searchParams.get('sort');
                        const newSort = current === 'joined_asc' ? 'joined_desc' : 'joined_asc';
setSearchParams((prev: URLSearchParams) => { prev.set('sort', newSort); return prev; });
                    }}>
    Joined { searchParams.get('sort')?.includes('joined') && (searchParams.get('sort')?.includes('desc') ? '↓' : '↑') }
                    </div >
                    <div className="col-span-1">MFA</div>
                    <div className="col-span-1 text-right">Actions</div>
tenants: Tenant[];
error: string | null;
}

interface ApiError {
    error?: string;
    success?: boolean;
    token?: string; // For impersonation
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const search = url.searchParams.get("search") || "";
    const tenantId = url.searchParams.get("tenantId") || "";
    const context = args.context as { cloudflare?: { env: any }, env?: any };
    const env = context.cloudflare?.env || context.env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        // Construct query params
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (tenantId) params.append("tenantId", tenantId);
        const sort = url.searchParams.get("sort");
        if (sort) params.append("sort", sort);

        const [users, tenants] = await Promise.all([
            apiRequest<User[]>(`/admin/users?${params.toString()}`, token, {}, apiUrl),
            apiRequest<Tenant[]>(`/admin/tenants`, token, {}, apiUrl)
        ]);

        return { users, tenants: tenants || [], error: null };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unauthorized";
        return { users: [], tenants: [], error: message };
    }
};

export default function AdminUsers() {
    const { users, tenants } = useLoaderData<LoaderData>();
    const [searchParams, setSearchParams] = useSearchParams();
    const submit = useSubmit();

    // UI State
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [groupByTenant, setGroupByTenant] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Status Dialog State
    const [statusDialog, setStatusDialog] = useState<{ isOpen: boolean, type: 'error' | 'success', message: string, title?: string }>({
        isOpen: false,
        type: 'success',
        message: ''
    });

    // Add User Modal State (Controlled via local state + Dialog)
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        firstName: "",
        lastName: "",
        email: "",
        isPlatformAdmin: false,
        initialTenantId: "",
        initialRole: "student"
    });

    const [impersonateTargetId, setImpersonateTargetId] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    // Computed Data
    const usersList = Array.isArray(users) ? users : [];

    // Group users by tenant if enabled
    const groupedData = useMemo(() => {
        if (!groupByTenant) return null;

        const groups: Record<string, { tenant: Tenant, users: User[] }> = {};

        // Initialize Platform Admins group
        groups['platform_admins'] = { tenant: { id: 'platform_admins', name: 'Platform Administrators' }, users: [] };

        usersList.forEach((u) => {
            if (u.isPlatformAdmin) {
                groups['platform_admins'].users.push(u);
                // Continue to add to tenant groups if applicable
            }

            if (u.memberships && u.memberships.length > 0) {
                u.memberships.forEach((m) => {
                    const tId = m.tenant.id;
                    if (!groups[tId]) {
                        groups[tId] = { tenant: m.tenant, users: [] };
                    }
                    const userRole = m.roles?.[0]?.role || m.role || 'member';
                    groups[tId].users.push({ ...u, contextRole: userRole });
                });
            } else {
                if (!groups['unassigned']) {
                    groups['unassigned'] = { tenant: { id: 'unassigned', name: 'Unassigned / Global' }, users: [] };
                }
                groups['unassigned'].users.push(u);
            }
        });

        // Remove empty admin group if no admins (optional, but cleaner to keep if that's the point)
        if (groups['platform_admins'].users.length === 0) {
            delete groups['platform_admins'];
        }

        return groups;
    }, [usersList, groupByTenant]);

    // Handlers
    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const q = formData.get("search") as string;
        setSearchParams((prev: URLSearchParams) => {
            if (q) prev.set("search", q);
            else prev.delete("search");
            return prev;
        });
    };

    const toggleSelectAll = () => {
        if (selectedUsers.size === usersList.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(usersList.map((u) => u.id)));
        }
    };

    const toggleUser = (id: string) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedUsers(newSet);
    };

    const toggleGroup = (tenantId: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(tenantId)) newSet.delete(tenantId);
        else newSet.add(tenantId);
        setExpandedGroups(newSet);
    };


    // Auth hook for client-side API calls
    const { getToken, userId } = useAuth();

    const executeBulk = async (action: string, value: string | boolean) => {
        if (selectedUsers.size === 0) return;
        try {
            const token = await getToken();
            const res = await apiRequest<ApiError>("/admin/users/bulk", token, {
                method: "PATCH",
                body: JSON.stringify({
                    userIds: Array.from(selectedUsers),
                    action,
                    value
                })
            });

            if (res.error) throw new Error(res.error);

            setStatusDialog({ isOpen: true, type: 'success', title: 'Start Execution', message: `Successfully updated ${selectedUsers.size} users.` });
            setSelectedUsers(new Set());
            // Refresh data
            submit(searchParams);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "An error occurred";
            setStatusDialog({ isOpen: true, type: 'error', title: 'Error', message });
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.firstName || !newUser.lastName) return;
        try {
            const token = await getToken();
            const res = await apiRequest<ApiError>("/admin/users", token, {
                method: "POST",
                body: JSON.stringify(newUser)
            });

            if (res.error) throw new Error(res.error);

            setStatusDialog({ isOpen: true, type: 'success', title: 'User Created', message: "User created successfully." });
            setIsAddUserOpen(false);
            setNewUser({ firstName: "", lastName: "", email: "", isPlatformAdmin: false, initialTenantId: "", initialRole: "student" });
            submit(searchParams); // Refresh list
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "An error occurred";
            setStatusDialog({ isOpen: true, type: 'error', title: 'Creation Failed', message });
        }
    };

    const handleConfirmImpersonate = async () => {
        if (!impersonateTargetId) return;

        try {
            const token = await getToken();
            const res = await apiRequest<ApiError>("/admin/impersonate", token, {
                method: "POST",
                body: JSON.stringify({ targetUserId: impersonateTargetId })
            });

            if (res.error) throw new Error(res.error);

            if (res.token) {
                // Set cookie for SSR compatibility
                document.cookie = `__impersonate_token=${res.token}; path=/; max-age=3600; samesite=lax; secure`;

                // Redirect to first available studio or dashboard
                const user = usersList.find((u) => u.id === impersonateTargetId);
                if (user && user.memberships && user.memberships.length > 0) {
                    window.location.href = `/studio/${user.memberships[0].tenant.slug}`;
                } else {
                    window.location.href = "/dashboard";
                }
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "An error occurred";
            setStatusDialog({ isOpen: true, type: 'error', title: 'Impersonation Failed', message });
        } finally {
            setImpersonateTargetId(null);
        }
    };

    const handleImpersonate = (userId: string) => {
        setImpersonateTargetId(userId);
    };


    const handleDeleteUser = (user: User) => {
        setUserToDelete(user);
    };

    const handleConfirmDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            const token = await getToken();
            const res = await apiRequest<ApiError>(`/admin/users/${userToDelete.id}`, token, {
                method: "DELETE"
            });
            if (res.error) throw new Error(res.error);
            submit(searchParams);
            setStatusDialog({ isOpen: true, type: 'success', title: 'User Deleted', message: `User ${userToDelete.email} has been deleted.` });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "An error occurred";
            setStatusDialog({ isOpen: true, type: 'error', title: 'Deletion Failed', message });
        } finally {
            setUserToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Global User Directory</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage all users across the platform.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setIsAddUserOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add User
                    </Button>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <Form onSubmit={handleSearch} className="relative w-full sm:w-96">
                    <Input
                        type="search"
                        name="search"
                        defaultValue={searchParams.get("search") || ""}
                        placeholder="Search users..."
                        className="pl-10"
                    />
                    <svg className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </Form>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 font-medium cursor-pointer">
                        <input
                            type="checkbox"
                            checked={groupByTenant}
                            onChange={(e) => setGroupByTenant(e.target.checked)}
                            className="rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-zinc-900 dark:bg-zinc-700 h-4 w-4"
                        />
                        Group by Tenant
                    </label>
                </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedUsers.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4">
                    <span className="font-medium">{selectedUsers.size} users selected</span>
                    <div className="h-4 w-px bg-zinc-700"></div>
                    <div className="flex gap-2">
                        <button onClick={() => executeBulk('set_role', 'owner')} className="hover:text-zinc-300 text-sm font-medium transition-colors">Make Owner</button>
                        <button onClick={() => executeBulk('set_role', 'admin')} className="hover:text-zinc-300 text-sm font-medium transition-colors">Make Admin</button>
                        <button onClick={() => executeBulk('set_role', 'user')} className="hover:text-zinc-300 text-sm font-medium transition-colors">Demote</button>
                        <div className="w-px h-4 bg-zinc-700 mx-2"></div>
                        <button
                            onClick={() => setShowBulkDeleteConfirm(true)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                        >
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* User List */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider items-center">
                    <div className="col-span-1 flex items-center justify-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={selectedUsers.size === usersList.length && usersList.length > 0} className="rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 h-4 w-4" />
                    </div>
                    <div className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" onClick={() => {
                        const current = searchParams.get('sort');
                        const newSort = current === 'name_asc' ? 'name_desc' : 'name_asc';
                        setSearchParams((prev: URLSearchParams) => { prev.set('sort', newSort); return prev; });
                    }}>
                        User {searchParams.get('sort')?.includes('name') && (searchParams.get('sort')?.includes('desc') ? '↓' : '↑')}
                    </div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" onClick={() => {
                        const current = searchParams.get('sort');
                        const newSort = current === 'joined_asc' ? 'joined_desc' : 'joined_asc';
                        setSearchParams((prev: URLSearchParams) => { prev.set('sort', newSort); return prev; });
                    }}>
                        Joined {searchParams.get('sort')?.includes('joined') && (searchParams.get('sort')?.includes('desc') ? '↓' : '↑')}
                    </div>
                    <div className="col-span-1">MFA</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {groupByTenant && groupedData ? (
                    Object.entries(groupedData).map(([tId, group]: [string, any]) => (
                        <div key={tId} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <div
                                className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center gap-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                onClick={() => toggleGroup(tId)}
                            >
                                <div className="w-4 h-4 flex items-center justify-center text-zinc-400">
                                    {expandedGroups.has(tId) ? '▼' : '▶'}
                                </div>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">{group.tenant.name}</span>
                                <span className="text-xs text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-full">{group.users.length}</span>
                            </div>

                            {expandedGroups.has(tId) && (
                                <div>
                                    {group.users.map((u: any) => (
                                        <UserRow
                                            key={`${u.id}-${tId}`}
                                            user={u}
                                            selected={selectedUsers.has(u.id)}
                                            toggle={() => toggleUser(u.id)}
                                            contextRole={u.contextRole}
                                            currentUserId={userId}
                                            showCheckbox={true}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    usersList.map((user: any) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            selected={selectedUsers.has(user.id)}
                            toggle={() => toggleUser(user.id)}
                            showCheckbox={true}
                            currentUserId={userId}
                            onImpersonate={() => handleImpersonate(user.id)}
                            onDelete={() => handleDeleteUser(user)}
                        />
                    ))
                )}

                {usersList.length === 0 && (
                    <div className="p-8 text-center text-zinc-500">No users found matching your search.</div>
                )}
            </div>

            {/* Add User Dialog */}
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a new user profile manually.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>First Name</Label>
                                <Input
                                    value={newUser.firstName}
                                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                    placeholder="Jane"
                                />
                            </div>
                            <div>
                                <Label>Last Name</Label>
                                <Input
                                    value={newUser.lastName}
                                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                    placeholder="Doe"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Email Address</Label>
                            <Input
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                placeholder="jane@example.com"
                            />
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newUser.isPlatformAdmin}
                                    onChange={(e) => setNewUser({ ...newUser, isPlatformAdmin: e.target.checked })}
                                    className="rounded border-zinc-300"
                                />
                                Platform Administrator (Main Platform Access)
                            </label>
                        </div>

                        <div className="relative pt-4 before:content-['OR'] before:absolute before:top-2 before:left-1/2 before:-translate-x-1/2 before:bg-white dark:before:bg-zinc-900 before:px-2 before:text-xs before:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 mt-2">Assign to Studio (Optional)</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <Label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Studio</Label>
                                    <Select
                                        value={newUser.initialTenantId}
                                        onChange={(e) => setNewUser({ ...newUser, initialTenantId: e.target.value })}
                                    >
                                        <option value="">-- None --</option>
                                        {tenants?.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Role</Label>
                                    <Select
                                        value={newUser.initialRole}
                                        onChange={(e) => setNewUser({ ...newUser, initialRole: e.target.value })}
                                        disabled={!newUser.initialTenantId}
                                    >
                                        <option value="student">Student</option>
                                        <option value="instructor">Instructor</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreateUser}
                            disabled={!newUser.email || !newUser.firstName}
                        >
                            Create User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Status Dialog (Reusing Dialog logic) */}
            <Dialog open={statusDialog.isOpen} onOpenChange={(open) => setStatusDialog({ ...statusDialog, isOpen: open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className={statusDialog.type === 'error' ? 'text-red-500' : 'text-green-500'}>
                            {statusDialog.title || (statusDialog.type === 'error' ? 'Error' : 'Success')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-zinc-600 dark:text-zinc-300">
                        {statusDialog.message}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setStatusDialog({ ...statusDialog, isOpen: false })}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!userToDelete}
                onOpenChange={(open) => !open && setUserToDelete(null)}
                onConfirm={handleConfirmDeleteUser}
                title="Delete User"
                description={<>Are you sure you want to PERMANENTLY delete user <strong>{userToDelete?.email}</strong>? This cannot be undone.</>}
                confirmText="Delete"
                variant="destructive"
            />

            <ConfirmDialog
                open={showBulkDeleteConfirm}
                onOpenChange={setShowBulkDeleteConfirm}
                onConfirm={() => {
                    executeBulk('delete', true);
                    setShowBulkDeleteConfirm(false);
                }}
                title="Delete Multiple Users"
                description={`Are you sure you want to PERMANENTLY delete ${selectedUsers.size} users? This action cannot be undone.`}
                confirmText="Delete Users"
                variant="destructive"
            />

            {/* Impersonation Confirmation Dialog */}
            <Dialog open={!!impersonateTargetId} onOpenChange={(open) => !open && setImpersonateTargetId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Impersonation</DialogTitle>
                        <DialogDescription>
                            You are about to sign in as another user. This action will be logged.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 text-zinc-600 dark:text-zinc-300">
                        <p>Are you sure you want to sign in as <strong>{usersList.find(u => u.id === impersonateTargetId)?.email}</strong>?</p>
                        <p className="mt-2 text-xs text-zinc-500">You will need to log out to return to your admin account.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImpersonateTargetId(null)}>Cancel</Button>
                        <Button onClick={handleConfirmImpersonate}>Sign In as User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ClientDate({ date }: { date: string | Date | null }) {
    const [formatted, setFormatted] = useState<string | null>(null);

    useEffect(() => {
        if (!date) {
            setFormatted('Never');
            return;
        }
        setFormatted(new Date(date).toLocaleString());
    }, [date]);

    // Initial render / server render: show generic fallback or nothing to avoid mismatch
    if (!formatted) return <span className="text-zinc-300 animate-pulse">...</span>;

    return <span>{formatted}</span>;
}

function ClientDateOnly({ date }: { date: string | Date }) {
    const [formatted, setFormatted] = useState<string | null>(null);

    useEffect(() => {
        setFormatted(new Date(date).toLocaleDateString());
    }, [date]);

    if (!formatted) return <span className="text-zinc-300">...</span>;
    return <span>{formatted}</span>;
}

function UserRow({ user, selected, toggle, showCheckbox, currentUserId, contextRole, onImpersonate, onDelete }: { user: User, selected: boolean, toggle: () => void, showCheckbox: boolean, currentUserId?: string | null, contextRole?: string, onImpersonate?: () => void, onDelete?: () => void }) {
    // Correct display name for specific user as requested
    let displayName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
    if (user.email === 'slichti@gmail.com' && displayName === 'System Admin') {
        displayName = 'Steven Lichti';
    }
    if (!displayName) displayName = user.email;

    return (
        <div className={`grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${selected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
            <div className="col-span-1 flex justify-center">
                {showCheckbox ? (
                    <input
                        type="checkbox"
                        className="rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 h-4 w-4"
                        checked={selected}
                        onChange={toggle}
                    />
                ) : null}
            </div>
            <div className="col-span-3 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300 overflow-hidden shrink-0">
                    {user.profile?.portraitUrl ? <img src={user.profile.portraitUrl} alt="" className="w-full h-full object-cover" /> : (displayName[0] || 'U')}
                </div>
                <div className="truncate min-w-0">
                    <div className="truncate">{displayName}</div>
                    {contextRole && <div className="text-xs text-zinc-400 capitalize">{contextRole}</div>}
                </div>
            </div>
            <div className="col-span-3 text-zinc-600 dark:text-zinc-400 text-sm truncate" title={user.email}>{user.email}</div>
            <div className="col-span-2">
                {user.role === 'owner' ? (
                    <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-xs font-bold border border-amber-200 dark:border-amber-800">Owner</span>
                ) : (user.role === 'admin' || user.isPlatformAdmin === true) ? (
                    <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-bold">Admin</span>
                ) : (
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs">User</span>
                )}
            </div>
            <div className="col-span-2 text-zinc-400 dark:text-zinc-500 text-xs flex flex-col gap-0.5">
                <span>
                    {user.lastActiveAt ? <ClientDate date={user.lastActiveAt} /> : 'Never'}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 flex gap-1">
                    Joined <ClientDateOnly date={user.createdAt} />
                </span>
            </div>
            <div className="col-span-1 flex items-center">
                {user.mfaEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20" title="MFA Enabled">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                        </svg>
                        MFA
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10 dark:bg-zinc-400/10 dark:text-zinc-400 dark:ring-zinc-400/20 opacity-50">
                        None
                    </span>
                )}
            </div>
            <div className="col-span-1">
                <div className="flex gap-3 justify-end items-center">
                    {onImpersonate && !user.isPlatformAdmin && (
                        <button onClick={onImpersonate} className="text-zinc-500 hover:text-zinc-900 text-sm font-medium flex items-center gap-1" title="Login As">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>

                        </button>
                    )}
                    {onDelete && user.id !== currentUserId && (
                        <button onClick={onDelete} className="text-red-400 hover:text-red-700 text-sm font-medium flex items-center gap-1" title="Delete User">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    )}
                    <Link to={`/admin/users/${user.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</Link>
                </div>
            </div>
        </div >
    );
}
