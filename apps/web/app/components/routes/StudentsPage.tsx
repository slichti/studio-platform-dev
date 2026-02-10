
import { useParams, Link, useOutletContext } from "react-router";
import { useState } from "react";
import { Search, UserPlus, Filter, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Badge } from "../ui/Badge";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/Table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/DropdownMenu";
import { ConfirmationDialog } from "../Dialogs";
import { useStudents } from "../../hooks/useStudents";
import { ComponentErrorBoundary } from "../ErrorBoundary";
import { apiRequest } from "../../utils/api";
import { cn } from "../../lib/utils";

export default function StudentsPage() {
    const { slug } = useParams();
    const { roles } = useOutletContext<any>();
    const isOwner = roles && roles.includes('owner');
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Member Management State
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingMember, setEditingMember] = useState<any | null>(null);
    const [pendingRoleChange, setPendingRoleChange] = useState<{ memberId: string, newRole: string } | null>(null);

    // FETCH DATA using useStudents hook
    const { data: members = [], isLoading, error } = useStudents(slug || '');

    // Filter Logic
    const filteredMembers = members.filter((m: any) => {
        const q = searchQuery.toLowerCase();
        const name = `${m.profile?.firstName || ''} ${m.profile?.lastName || ''}`.toLowerCase();
        const email = (m.user?.email || '').toLowerCase();
        const matchesSearch = name.includes(q) || email.includes(q);
        const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            const token = await getToken();
            const res = await apiRequest(`/members`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    email: formData.get('email'),
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName')
                })
            }) as any;

            if (res.error) toast.error(res.error);
            else {
                toast.success("Member added");
                setIsAddingMember(false);
                queryClient.invalidateQueries({ queryKey: ['members', slug] });
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmRemoveMember = async () => {
        if (!editingMember) return;
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res = await apiRequest(`/members/${editingMember.id}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            }) as any;

            if (res.error) toast.error(res.error);
            else {
                toast.success("Member removed");
                setEditingMember(null);
                queryClient.invalidateQueries({ queryKey: ['members', slug] });
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmRoleChange = async () => {
        if (!pendingRoleChange) return;
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res = await apiRequest(`/members/${pendingRoleChange.memberId}/role`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ role: pendingRoleChange.newRole })
            }) as any;

            if (res.error) toast.error(res.error);
            else {
                toast.success("Role updated");
                setPendingRoleChange(null);
                queryClient.invalidateQueries({ queryKey: ['members', slug] });
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredMembers.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredMembers.map((m: any) => m.id)));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">People</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage your student base and memberships.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Filter className="h-4 w-4 mr-2" /> Filter
                    </Button>
                    <Button onClick={() => setIsAddingMember(true)}>
                        <UserPlus className="h-4 w-4 mr-2" /> Add Member
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded border border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/20">
                    Failed to load members. Please try again.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Students</CardDescription>
                        <CardTitle className="text-3xl">{members.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Active Memberships</CardDescription>
                        <CardTitle className="text-3xl">
                            {members.filter((m: any) => m.status === 'active').length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>New This Month</CardDescription>
                        <CardTitle className="text-3xl">
                            {members.filter((m: any) => new Date(m.joinedAt) > new Date(new Date().setDate(1))).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search students..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center bg-zinc-100 p-1 rounded-md dark:bg-zinc-800">
                    {['all', 'active', 'inactive'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-sm capitalize transition-all",
                                statusFilter === status
                                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                            )}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            <ComponentErrorBoundary>
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <input type="checkbox"
                                        className="rounded border-zinc-300 dark:border-zinc-700"
                                        checked={filteredMembers.length > 0 && selectedIds.size === filteredMembers.length}
                                        onChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5}>
                                            <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : filteredMembers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center italic">No students found.</TableCell>
                                </TableRow>
                            ) : (
                                filteredMembers.map((member: any) => (
                                    <TableRow key={member.id} className={cn(selectedIds.has(member.id) && "bg-blue-50/50 dark:bg-blue-900/10")}>
                                        <TableCell>
                                            <input type="checkbox"
                                                className="rounded border-zinc-300 dark:border-zinc-700"
                                                checked={selectedIds.has(member.id)}
                                                onChange={() => toggleSelect(member.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Link to={member.id} className="flex items-center gap-3 group">
                                                <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium group-hover:bg-zinc-200 dark:bg-zinc-800">
                                                    {(member.profile?.firstName?.[0] || 'U')}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                                                        {member.profile?.firstName} {member.profile?.lastName}
                                                    </div>
                                                    <div className="text-xs text-zinc-500">{member.user?.email}</div>
                                                </div>
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>
                                                {member.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-zinc-500 dark:text-zinc-400">
                                            {format(new Date(member.joinedAt || new Date()), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                                        Manage Role
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(member.user?.email)}>
                                                        Copy Email
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setEditingMember(member)}>
                                                        Remove Student
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 text-center text-xs text-zinc-500">
                        Showing {filteredMembers.length} member{filteredMembers.length !== 1 && 's'}
                    </div>
                </Card>
            </ComponentErrorBoundary>

            <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Member</DialogTitle>
                        <DialogDescription>Invite a new student to your studio.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddMember} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input name="email" type="email" required placeholder="student@example.com" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">First Name</label>
                                <Input name="firstName" placeholder="Jane" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Last Name</label>
                                <Input name="lastName" placeholder="Doe" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddingMember(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Adding..." : "Add Member"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Member</DialogTitle>
                        <DialogDescription>Managing {editingMember?.user?.email}</DialogDescription>
                    </DialogHeader>
                    {editingMember && (
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role</label>
                                <Select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
                                    value={(Array.isArray(editingMember.roles) ? editingMember.roles : []).find((r: any) => r.role === 'owner' || r.role === 'instructor')?.role || 'student'}
                                    onChange={(e: any) => setPendingRoleChange({ memberId: editingMember.id, newRole: e.target.value })}
                                    disabled={!isOwner}
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                </Select>
                            </div>

                            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-red-900 dark:text-red-200">Danger Zone</p>
                                        <p className="text-xs text-red-700 dark:text-red-300">Remove this student from the studio.</p>
                                    </div>
                                    <Button variant="destructive" size="sm" onClick={confirmRemoveMember} disabled={isSubmitting || !isOwner}>
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                isOpen={!!pendingRoleChange}
                onClose={() => setPendingRoleChange(null)}
                onConfirm={confirmRoleChange}
                title="Change Role"
                message={`Are you sure you want to change this user's role to ${pendingRoleChange?.newRole}?`}
                confirmText="Change Role"
            />
        </div>
    );
}
