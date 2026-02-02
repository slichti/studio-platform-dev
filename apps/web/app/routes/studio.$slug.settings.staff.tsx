import { useParams, Link, useOutletContext } from "react-router";
import { useState } from "react";
import { Plus, User, Shield, Mail, MoreHorizontal, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/Badge";
import { Select } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/Table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/DropdownMenu";
import { ConfirmationDialog } from "~/components/Dialogs";
import { useStaff } from "~/hooks/useStaff";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { apiRequest } from "~/utils/api";
import { Input } from "~/components/ui/input";

export default function StaffSettings() {
    const { slug } = useParams();
    const { roles } = useOutletContext<any>();
    const isOwner = roles && roles.includes('owner');
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const { staff, isLoading, error } = useStaff(slug || '');

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingMember, setEditingMember] = useState<any | null>(null);
    const [pendingRoleChange, setPendingRoleChange] = useState<{ memberId: string, newRole: string } | null>(null);

    const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            const token = await getToken();
            const res = await apiRequest(`/members/invite`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    email: formData.get('email'),
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    role: formData.get('role')
                })
            }) as any;

            if (res.error) toast.error(res.error);
            else {
                toast.success("Invitation sent");
                setIsInviteOpen(false);
                queryClient.invalidateQueries({ queryKey: ['members', slug] });
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to invite staff");
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
                setEditingMember(null);
                queryClient.invalidateQueries({ queryKey: ['members', slug] });
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveStaff = async () => {
        if (!editingMember) return;
        // Removing staff usually implies downgrading to student or removing entirely?
        // Let's assume removing entirely for now, or maybe just removing the role?
        // The previous Students page logic was DELETE member.
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res = await apiRequest(`/members/${editingMember.id}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            }) as any;

            if (res.error) toast.error(res.error);
            else {
                toast.success("Staff member removed");
                setEditingMember(null);
                queryClient.invalidateQueries({ queryKey: ['members', slug] });
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Team Management</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage instructors, admins, and studio staff.</p>
                </div>
                {isOwner && (
                    <Button onClick={() => setIsInviteOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Invite Staff
                    </Button>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded border border-red-100">
                    Failed to load staff. Please try again.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Staff</CardDescription>
                        <CardTitle className="text-3xl">{staff?.length || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Instructors</CardDescription>
                        <CardTitle className="text-3xl">
                            {staff?.filter(m => m.roles?.some((r: any) => r.role === 'instructor')).length || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Admins</CardDescription>
                        <CardTitle className="text-3xl">
                            {staff?.filter(m => m.roles?.some((r: any) => ['admin', 'owner'].includes(r.role))).length || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <ComponentErrorBoundary>
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-5 w-32 bg-zinc-100 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-5 w-20 bg-zinc-100 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-5 w-40 bg-zinc-100 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-5 w-16 bg-zinc-100 rounded animate-pulse" /></TableCell>
                                        <TableCell />
                                    </TableRow>
                                ))
                            ) : staff?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                        No staff members found. Invite someone to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                staff.map((member: any) => {
                                    const primaryRole = member.roles?.find((r: any) => ['owner', 'admin'].includes(r.role))?.role || 'instructor';
                                    return (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium dark:bg-zinc-800 uppercase">
                                                        {(member.profile?.firstName?.[0] || 'U')}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-zinc-900 dark:text-zinc-50">
                                                            {member.profile?.firstName} {member.profile?.lastName}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={primaryRole === 'owner' ? 'default' : primaryRole === 'admin' ? 'secondary' : 'outline'} className="capitalize">
                                                    {primaryRole}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-zinc-500">{member.user?.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>
                                                    {member.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isOwner && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger as={Button} variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                                                <Shield className="mr-2 h-4 w-4" /> Change Role
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => setEditingMember(member)} className="text-red-600 focus:text-red-600">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Remove Team Member
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </ComponentErrorBoundary>

            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>Send an invitation to join your studio team.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">First Name</label>
                                <Input name="firstName" placeholder="First Name" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Last Name</label>
                                <Input name="lastName" placeholder="Last Name" required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email Address</label>
                            <Input name="email" type="email" placeholder="colleague@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <Select name="role" defaultValue="instructor">
                                <option value="instructor">Instructor</option>
                                <option value="admin">Admin</option>
                            </Select>
                            <p className="text-xs text-zinc-500">
                                Instructors can manage classes. Admins have full access except billing.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Sending..." : "Send Invitation"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Access</DialogTitle>
                        <DialogDescription>
                            {editingMember?.profile?.firstName} {editingMember?.profile?.lastName}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Shield className="h-4 w-4" /> Change Role
                            </h4>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPendingRoleChange({ memberId: editingMember.id, newRole: 'instructor' })}
                                >
                                    Make Instructor
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPendingRoleChange({ memberId: editingMember.id, newRole: 'admin' })}
                                >
                                    Make Admin
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPendingRoleChange({ memberId: editingMember.id, newRole: 'student' })}
                                >
                                    Demote to Student
                                </Button>
                            </div>
                        </div>

                        <div className="bg-red-50 p-4 rounded-lg border border-red-100 dark:bg-red-900/10 dark:border-red-900/20">
                            <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4" /> Remove from Team
                            </h4>
                            <p className="text-xs text-red-600 dark:text-red-300 mb-4">
                                This will remove them from the studio entirely. They will lose access immediately.
                            </p>
                            <Button variant="destructive" size="sm" onClick={handleRemoveStaff} disabled={isSubmitting}>
                                <Trash2 className="h-4 w-4 mr-2" /> Remove Member
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                isOpen={!!pendingRoleChange}
                onClose={() => setPendingRoleChange(null)}
                onConfirm={confirmRoleChange}
                title="Confirm Role Change"
                message={`Are you sure you want to change this user's role to ${pendingRoleChange?.newRole}?`}
                confirmText="Update Role"
            />
        </div>
    );
}
