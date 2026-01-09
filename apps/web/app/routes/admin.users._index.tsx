// @ts-ignore
import { useLoaderData, Link, useSearchParams, Form, useSubmit, useNavigate } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { Modal } from "../components/Modal";
import { ErrorDialog, ConfirmationDialog } from "../components/Dialogs";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const search = url.searchParams.get("search") || "";
    const tenantId = url.searchParams.get("tenantId") || "";
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        // Construct query params
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (tenantId) params.append("tenantId", tenantId);
        const sort = url.searchParams.get("sort");
        if (sort) params.append("sort", sort);

        const [users, tenants] = await Promise.all([
            apiRequest(`/admin/users?${params.toString()}`, token, {}, apiUrl),
            apiRequest(`/admin/tenants`, token, {}, apiUrl)
        ]);

        return { users, tenants: tenants || [], error: null };
    } catch (e: any) {
        return { users: [], tenants: [], error: e.message || "Unauthorized" };
    }
};

export default function AdminUsers() {
    const { users, tenants, error } = useLoaderData<any>();
    const [searchParams, setSearchParams] = useSearchParams();
    const submit = useSubmit();
    const navigate = useNavigate();

    // UI State
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [groupByTenant, setGroupByTenant] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [statusDialog, setStatusDialog] = useState<{ isOpen: boolean, type: 'error' | 'success', message: string }>({ isOpen: false, type: 'success', message: '' });

    // Add User Modal State
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        firstName: "",
        lastName: "",
        email: "",
        isSystemAdmin: false,
        initialTenantId: "",
        initialRole: "student"
    });

    // Computed Data
    const usersList = Array.isArray(users) ? users : [];

    // Group users by tenant if enabled
    const groupedData = useMemo(() => {
        if (!groupByTenant) return null;

        const groups: Record<string, { tenant: any, users: any[] }> = {};

        usersList.forEach((u: any) => {
            if (u.memberships && u.memberships.length > 0) {
                u.memberships.forEach((m: any) => {
                    const tId = m.tenant.id;
                    if (!groups[tId]) {
                        groups[tId] = { tenant: m.tenant, users: [] };
                    }
                    groups[tId].users.push({ ...u, contextRole: m.role });
                });
            } else {
                if (!groups['unassigned']) {
                    groups['unassigned'] = { tenant: { id: 'unassigned', name: 'Unassigned / Global' }, users: [] };
                }
                groups['unassigned'].users.push(u);
            }
        });

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
            setSelectedUsers(new Set(usersList.map((u: any) => u.id)));
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

    const executeBulk = async (action: string, value: any) => {
        if (selectedUsers.size === 0) return;
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/users/bulk", token, {
                method: "PATCH",
                body: JSON.stringify({
                    userIds: Array.from(selectedUsers),
                    action,
                    value
                })
            }) as any;

            if (res.error) throw new Error(res.error);

            setStatusDialog({ isOpen: true, type: 'success', message: `Successfully updated ${selectedUsers.size} users.` });
            setSelectedUsers(new Set());
            // Refresh data
            submit(searchParams);
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: e.message });
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.firstName || !newUser.lastName) return;
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/users", token, {
                method: "POST",
                body: JSON.stringify(newUser)
            }) as any;

            if (res.error) throw new Error(res.error);

            setStatusDialog({ isOpen: true, type: 'success', message: "User created successfully." });
            setIsAddUserOpen(false);
            setNewUser({ firstName: "", lastName: "", email: "", isSystemAdmin: false, initialTenantId: "", initialRole: "student" });
            submit(searchParams); // Refresh list
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: e.message });
        }
    };

    const handleImpersonate = async (userId: string) => {
        if (!confirm("Are you sure you want to sign in as this user?")) return;
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/impersonate", token, {
                method: "POST",
                body: JSON.stringify({ targetUserId: userId })
            }) as any;

            if (res.error) throw new Error(res.error);

            if (res.token) {
                // Set cookie for SSR compatibility
                document.cookie = `__impersonate_token=${res.token}; path=/; max-age=3600; samesite=lax; secure`;

                // Redirect to first available studio or dashboard
                const user = usersList.find((u: any) => u.id === userId);
                if (user && user.memberships && user.memberships.length > 0) {
                    window.location.href = `/studio/${user.memberships[0].tenant.slug}`;
                } else {
                    window.location.href = "/dashboard";
                }
            }
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: e.message });
        }
    };

    const handleDeleteUser = async (user: any) => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete user ${user.email}? This cannot be undone.`)) return;

        try {
            const token = await getToken();
            const res = await apiRequest(`/admin/users/${user.id}`, token, {
                method: "DELETE"
            }) as any;
            if (res.error) throw new Error(res.error);
            submit(searchParams);
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', message: e.message });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Global User Directory</h1>
                    <p className="text-zinc-500">Manage all users across the platform.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAddUserOpen(true)}
                        className="bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 font-medium text-sm flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add User
                    </button>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                <Form onSubmit={handleSearch} className="relative w-full sm:w-96">
                    <input
                        type="search"
                        name="search"
                        defaultValue={searchParams.get("search") || ""}
                        placeholder="Search users..."
                        className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    />
                    <svg className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </Form>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-600 font-medium">
                        <input
                            type="checkbox"
                            checked={groupByTenant}
                            onChange={(e) => setGroupByTenant(e.target.checked)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        />
                        Group by Tenant
                    </label>
                </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedUsers.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6 z-50">
                    <span className="font-medium">{selectedUsers.size} users selected</span>
                    <div className="h-4 w-px bg-zinc-700"></div>
                    <div className="flex gap-2">
                        <button onClick={() => executeBulk('set_system_admin', true)} className="hover:text-zinc-300 text-sm font-medium">Promote to Admin</button>
                        <button onClick={() => executeBulk('set_system_admin', false)} className="hover:text-zinc-300 text-sm font-medium">Demote</button>
                        <div className="w-px h-4 bg-zinc-700 mx-2"></div>
                        <button
                            onClick={() => {
                                if (confirm(`Are you sure you want to PERMANENTLY delete ${selectedUsers.size} users?`)) {
                                    executeBulk('delete', true);
                                }
                            }}
                            className="text-red-400 hover:text-red-300 text-sm font-medium"
                        >
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* User List */}
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500 uppercase tracking-wider items-center">
                    <div className="col-span-1 flex items-center justify-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={selectedUsers.size === usersList.length && usersList.length > 0} className="rounded border-zinc-300" />
                    </div>
                    <div className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-zinc-700" onClick={() => {
                        const current = searchParams.get('sort');
                        const newSort = current === 'name_asc' ? 'name_desc' : 'name_asc';
                        setSearchParams((prev: URLSearchParams) => { prev.set('sort', newSort); return prev; });
                    }}>
                        User {searchParams.get('sort')?.includes('name') && (searchParams.get('sort')?.includes('desc') ? '↓' : '↑')}
                    </div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-700" onClick={() => {
                        const current = searchParams.get('sort');
                        const newSort = current === 'joined_asc' ? 'joined_desc' : 'joined_asc';
                        setSearchParams((prev: URLSearchParams) => { prev.set('sort', newSort); return prev; });
                    }}>
                        Joined {searchParams.get('sort')?.includes('joined') && (searchParams.get('sort')?.includes('desc') ? '↓' : '↑')}
                    </div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {groupByTenant && groupedData ? (
                    Object.entries(groupedData).map(([tId, group]: [string, any]) => (
                        <div key={tId} className="border-b border-zinc-100 last:border-0">
                            <div
                                className="p-3 bg-zinc-50/50 flex items-center gap-2 cursor-pointer hover:bg-zinc-100 transition-colors"
                                onClick={() => toggleGroup(tId)}
                            >
                                <div className="w-4 h-4 flex items-center justify-center text-zinc-400">
                                    {expandedGroups.has(tId) ? '▼' : '▶'}
                                </div>
                                <span className="font-semibold text-zinc-700 text-sm">{group.tenant.name}</span>
                                <span className="text-xs text-zinc-400 bg-white border border-zinc-200 px-1.5 py-0.5 rounded-full">{group.users.length}</span>
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
                                            showCheckbox={false}
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

            {/* Add User Modal */}
            <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="Add New User">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">First Name</label>
                            <input
                                className="w-full border border-zinc-300 rounded-md p-2 text-sm"
                                value={newUser.firstName}
                                onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                placeholder="Jane"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Last Name</label>
                            <input
                                className="w-full border border-zinc-300 rounded-md p-2 text-sm"
                                value={newUser.lastName}
                                onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                placeholder="Doe"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                        <input
                            className="w-full border border-zinc-300 rounded-md p-2 text-sm"
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            placeholder="jane@example.com"
                        />
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                            <input
                                type="checkbox"
                                checked={newUser.isSystemAdmin}
                                onChange={(e) => setNewUser({ ...newUser, isSystemAdmin: e.target.checked })}
                                className="rounded border-zinc-300"
                            />
                            System Administrator (Main Platform Access)
                        </label>
                    </div>

                    <div className="relative pt-4 before:content-['OR'] before:absolute before:top-2 before:left-1/2 before:-translate-x-1/2 before:bg-white before:px-2 before:text-xs before:text-zinc-400 border-t border-zinc-200">
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 mt-2">Assign to Studio (Optional)</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Studio</label>
                                <select
                                    className="w-full border border-zinc-300 rounded-md p-2 text-sm"
                                    value={newUser.initialTenantId}
                                    onChange={(e) => setNewUser({ ...newUser, initialTenantId: e.target.value })}
                                >
                                    <option value="">-- None --</option>
                                    {tenants?.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Role</label>
                                <select
                                    className="w-full border border-zinc-300 rounded-md p-2 text-sm bg-zinc-50"
                                    value={newUser.initialRole}
                                    onChange={(e) => setNewUser({ ...newUser, initialRole: e.target.value })}
                                    disabled={!newUser.initialTenantId}
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                    <option value="owner">Owner</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <button onClick={() => setIsAddUserOpen(false)} className="px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded text-sm">Cancel</button>
                        <button
                            onClick={handleCreateUser}
                            disabled={!newUser.email || !newUser.firstName}
                            className="px-3 py-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-sm disabled:opacity-50"
                        >
                            Create User
                        </button>
                    </div>
                </div>
            </Modal>

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

function UserRow({ user, selected, toggle, showCheckbox, currentUserId, contextRole, onImpersonate, onDelete }: { user: any, selected: boolean, toggle: () => void, showCheckbox: boolean, currentUserId?: string | null, contextRole?: string, onImpersonate?: () => void, onDelete?: () => void }) {
    // Correct display name for specific user as requested
    let displayName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
    if (user.email === 'slichti@gmail.com' && displayName === 'System Admin') {
        displayName = 'Steven Lichti';
    }
    if (!displayName) displayName = user.email;

    return (
        <div className={`grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 items-center hover:bg-zinc-50 transition-colors ${selected ? 'bg-blue-50/50' : ''}`}>
            <div className="col-span-1 flex justify-center">
                {showCheckbox ? (
                    <input
                        type="checkbox"
                        className="rounded border-zinc-300"
                        checked={selected}
                        onChange={toggle}
                    />
                ) : null}
            </div>
            <div className="col-span-3 font-medium text-zinc-900 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 overflow-hidden shrink-0">
                    {user.profile?.portraitUrl ? <img src={user.profile.portraitUrl} alt="" className="w-full h-full object-cover" /> : (displayName[0] || 'U')}
                </div>
                <div className="truncate min-w-0">
                    <div className="truncate">{displayName}</div>
                    {contextRole && <div className="text-xs text-zinc-400 capitalize">{contextRole}</div>}
                </div>
            </div>
            <div className="col-span-3 text-zinc-600 text-sm truncate" title={user.email}>{user.email}</div>
            <div className="col-span-2">
                {user.isSystemAdmin ? (
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">Admin</span>
                ) : (
                    <span className="text-zinc-400 text-xs">User</span>
                )}
            </div>
            <div className="col-span-2 text-zinc-400 text-xs flex flex-col gap-0.5">
                <span>
                    {user.lastActiveAt ? <ClientDate date={user.lastActiveAt} /> : 'Never'}
                </span>
                <span className="text-zinc-300 flex gap-1">
                    Joined <ClientDateOnly date={user.createdAt} />
                </span>
            </div>
            <div className="col-span-1">
                <div className="flex gap-3 justify-end items-center">
                    {onImpersonate && !user.isSystemAdmin && (
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
