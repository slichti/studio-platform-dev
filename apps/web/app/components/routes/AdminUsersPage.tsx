
import { useLoaderData, Link, useSearchParams, Form, useSubmit } from "react-router";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { apiRequest } from "../../utils/api";

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
    contextRole?: string;
    mfaEnabled?: boolean;
}

interface LoaderData {
    users: User[];
    tenants: Tenant[];
    error: string | null;
}

interface ApiError {
    error?: string;
    success?: boolean;
    token?: string;
}

export default function AdminUsersPageComponent() {
    const { users, tenants } = useLoaderData<LoaderData>();
    const [searchParams, setSearchParams] = useSearchParams();
    const submit = useSubmit();
    const { getToken, userId } = useAuth();

    // UI State
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [groupByTenant, setGroupByTenant] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const [statusDialog, setStatusDialog] = useState<{ isOpen: boolean, type: 'error' | 'success', message: string, title?: string }>({
        isOpen: false,
        type: 'success',
        message: ''
    });

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

    const usersList = Array.isArray(users) ? users : [];

    const groupedData = useMemo(() => {
        if (!groupByTenant) return null;
        const groups: Record<string, { tenant: Tenant, users: User[] }> = {};
        groups['platform_admins'] = { tenant: { id: 'platform_admins', name: 'Platform Administrators' }, users: [] };
        usersList.forEach((u) => {
            if (u.isPlatformAdmin) groups['platform_admins'].users.push(u);
            if (u.memberships && u.memberships.length > 0) {
                u.memberships.forEach((m) => {
                    const tId = m.tenant.id;
                    if (!groups[tId]) groups[tId] = { tenant: m.tenant, users: [] };
                    const userRole = m.roles?.[0]?.role || m.role || 'member';
                    groups[tId].users.push({ ...u, contextRole: userRole });
                });
            } else {
                if (!groups['unassigned']) groups['unassigned'] = { tenant: { id: 'unassigned', name: 'Unassigned / Global' }, users: [] };
                groups['unassigned'].users.push(u);
            }
        });
        if (groups['platform_admins'].users.length === 0) delete groups['platform_admins'];
        return groups;
    }, [usersList, groupByTenant]);

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
        if (selectedUsers.size === usersList.length) setSelectedUsers(new Set());
        else setSelectedUsers(new Set(usersList.map((u) => u.id)));
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

    const executeBulk = async (action: string, value: string | boolean) => {
        if (selectedUsers.size === 0) return;
        try {
            const token = await getToken();
            const res = await apiRequest<ApiError>("/admin/users/bulk", token, {
                method: "PATCH",
                body: JSON.stringify({ userIds: Array.from(selectedUsers), action, value })
            });
            if (res.error) throw new Error(res.error);
            setStatusDialog({ isOpen: true, type: 'success', title: 'Execution Complete', message: `Successfully updated ${selectedUsers.size} users.` });
            setSelectedUsers(new Set());
            submit(searchParams);
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', title: 'Error', message: e.message });
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
            submit(searchParams);
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', title: 'Creation Failed', message: e.message });
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
                localStorage.setItem("impersonation_token", res.token);
                const user = usersList.find((u) => u.id === impersonateTargetId);
                if (user) {
                    localStorage.setItem("impersonation_target_email", user.email);
                }
                document.cookie = `__impersonate_token=${res.token}; path=/; max-age=3600; samesite=lax; secure`;

                if (user && user.memberships && user.memberships.length > 0) {
                    window.location.href = `/studio/${user.memberships[0].tenant.slug}`;
                } else {
                    window.location.href = "/dashboard";
                }
            }
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', title: 'Impersonation Failed', message: e.message });
        } finally {
            setImpersonateTargetId(null);
        }
    };

    const handleConfirmDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            const token = await getToken();
            const res = await apiRequest<ApiError>(`/admin/users/${userToDelete.id}`, token, { method: "DELETE" });
            if (res.error) throw new Error(res.error);
            submit(searchParams);
            setStatusDialog({ isOpen: true, type: 'success', title: 'User Deleted', message: `User ${userToDelete.email} has been deleted.` });
        } catch (e: any) {
            setStatusDialog({ isOpen: true, type: 'error', title: 'Deletion Failed', message: e.message });
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
                <Button onClick={() => setIsAddUserOpen(true)} className="flex items-center gap-2">
                    <PlusIcon /> Add User
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <Form onSubmit={handleSearch} className="relative w-full sm:w-96">
                    <Input name="search" defaultValue={searchParams.get("search") || ""} placeholder="Search users..." className="pl-10" />
                    <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                </Form>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 font-medium cursor-pointer">
                        <input type="checkbox" checked={groupByTenant} onChange={(e) => setGroupByTenant(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-zinc-900 dark:bg-zinc-700 h-4 w-4" />
                        Group by Tenant
                    </label>
                </div>
            </div>

            {selectedUsers.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4">
                    <span className="font-medium">{selectedUsers.size} users selected</span>
                    <div className="h-4 w-px bg-zinc-700"></div>
                    <div className="flex gap-2">
                        <button onClick={() => executeBulk('set_role', 'owner')} className="hover:text-zinc-300 text-sm font-medium">Make Owner</button>
                        <button onClick={() => executeBulk('set_role', 'admin')} className="hover:text-zinc-300 text-sm font-medium">Make Admin</button>
                        <button onClick={() => executeBulk('set_role', 'user')} className="hover:text-zinc-300 text-sm font-medium">Demote</button>
                        <div className="w-px h-4 bg-zinc-700 mx-2"></div>
                        <button onClick={() => setShowBulkDeleteConfirm(true)} className="text-red-400 hover:text-red-300 text-sm font-medium">Delete Selected</button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase items-center">
                    <div className="col-span-1 flex items-center justify-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={selectedUsers.size === usersList.length && usersList.length > 0} className="rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 h-4 w-4" />
                    </div>
                    <div className="col-span-3">User</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-2">Joined</div>
                    <div className="col-span-1">MFA</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {groupByTenant && groupedData ? (
                    Object.entries(groupedData).map(([tId, group]: [string, any]) => (
                        <div key={tId} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center gap-2 cursor-pointer" onClick={() => toggleGroup(tId)}>
                                <span className="text-zinc-400">{expandedGroups.has(tId) ? '▼' : '▶'}</span>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">{group.tenant.name}</span>
                                <span className="text-xs text-zinc-400 bg-white dark:bg-zinc-800 border px-1.5 py-0.5 rounded-full">{group.users.length}</span>
                            </div>
                            {expandedGroups.has(tId) && (
                                group.users.map((u: any) => (
                                    <UserRow key={`${u.id}-${tId}`} user={u} selected={selectedUsers.has(u.id)} toggle={() => toggleUser(u.id)} currentUserId={userId} contextRole={u.contextRole} onImpersonate={() => setImpersonateTargetId(u.id)} onDelete={() => setUserToDelete(u)} />
                                ))
                            )}
                        </div>
                    ))
                ) : (
                    usersList.map((user: any) => (
                        <UserRow key={user.id} user={user} selected={selectedUsers.has(user.id)} toggle={() => toggleUser(user.id)} currentUserId={userId} onImpersonate={() => setImpersonateTargetId(user.id)} onDelete={() => setUserToDelete(user)} />
                    ))
                )}
            </div>

            {/* Modals */}
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a new user profile manually.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>First Name</Label><Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="Jane" /></div>
                            <div><Label>Last Name</Label><Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Doe" /></div>
                        </div>
                        <div><Label>Email Address</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jane@example.com" /></div>
                        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={newUser.isPlatformAdmin} onChange={(e) => setNewUser({ ...newUser, isPlatformAdmin: e.target.checked })} className="rounded border-zinc-300" />
                            Platform Administrator
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateUser} disabled={!newUser.email || !newUser.firstName}>Create User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={statusDialog.isOpen} onOpenChange={(open) => setStatusDialog({ ...statusDialog, isOpen: open })}>
                <DialogContent>
                    <DialogHeader><DialogTitle className={statusDialog.type === 'error' ? 'text-red-500' : 'text-green-500'}>{statusDialog.title || 'Status'}</DialogTitle></DialogHeader>
                    <div className="py-4 text-zinc-600 dark:text-zinc-300">{statusDialog.message}</div>
                    <DialogFooter><Button onClick={() => setStatusDialog({ ...statusDialog, isOpen: false })}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)} onConfirm={handleConfirmDeleteUser} title="Delete User" description={<>Are you sure you want to delete <strong>{userToDelete?.email}</strong>?</>} confirmText="Delete" variant="destructive" />
            <ConfirmDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm} onConfirm={() => executeBulk('delete', true)} title="Delete Multiple Users" description={`Delete ${selectedUsers.size} users?`} confirmText="Delete Users" variant="destructive" />

            <Dialog open={!!impersonateTargetId} onOpenChange={(open) => !open && setImpersonateTargetId(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Confirm Impersonation</DialogTitle></DialogHeader>
                    <div className="py-4 text-zinc-600 dark:text-zinc-300">
                        <p>Sign in as <strong>{usersList.find(u => u.id === impersonateTargetId)?.email}</strong>?</p>
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

function UserRow({ user, selected, toggle, currentUserId, contextRole, onImpersonate, onDelete }: any) {
    let displayName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.email;
    return (
        <div className={`grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${selected ? 'bg-blue-50/50' : ''}`}>
            <div className="col-span-1 flex justify-center">
                <input type="checkbox" className="rounded border-zinc-300" checked={selected} onChange={toggle} />
            </div>
            <div className="col-span-3 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                    {user.profile?.portraitUrl ? <img src={user.profile.portraitUrl} alt="" className="w-full h-full object-cover" /> : (displayName[0] || 'U')}
                </div>
                <div className="truncate">
                    <div className="truncate">{displayName}</div>
                    {contextRole && <div className="text-xs text-zinc-400 capitalize">{contextRole}</div>}
                </div>
            </div>
            <div className="col-span-3 text-zinc-600 dark:text-zinc-400 text-sm truncate">{user.email}</div>
            <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${user.role === 'owner' ? 'bg-amber-100 text-amber-800' : (user.role === 'admin' || user.isPlatformAdmin) ? 'bg-purple-100 text-purple-800' : 'text-zinc-400'}`}>
                    {user.role || 'User'}
                </span>
            </div>
            <div className="col-span-2 text-zinc-400 text-xs"><ClientDate date={user.createdAt} /></div>
            <div className="col-span-1">
                {user.mfaEnabled && <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-medium">MFA</span>}
            </div>
            <div className="col-span-1">
                <div className="flex gap-3 justify-end items-center">
                    {onImpersonate && !user.isPlatformAdmin && <button onClick={onImpersonate} className="text-zinc-500"><UserIcon /></button>}
                    {onDelete && user.id !== currentUserId && <button onClick={onDelete} className="text-red-400"><TrashIcon /></button>}
                    <Link to={`/admin/users/${user.id}`} className="text-blue-600 font-medium text-sm">Edit</Link>
                </div>
            </div>
        </div>
    );
}

function ClientDate({ date }: { date: string | Date | null }) {
    const [formatted, setFormatted] = useState<string | null>(null);
    useEffect(() => { setFormatted(date ? new Date(date).toLocaleDateString() : 'Never'); }, [date]);
    return <span>{formatted || '...'}</span>;
}

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const SearchIcon = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
