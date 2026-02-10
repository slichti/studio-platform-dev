
import { useParams, useOutletContext, useNavigate, Link } from "react-router";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { format } from "date-fns";
import {
    User, Mail, Calendar, CreditCard, FileText,
    MoreHorizontal, Check, X, Plus, Pencil, Trash2, Camera
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select } from "../ui/select";
import { Badge } from "../ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";

import { useMember, useMemberNotes, useMemberCoupons } from "../../hooks/useMember";
import { usePacks } from "../../hooks/usePacks";
import { apiRequest, API_URL } from "../../utils/api";
import { ComponentErrorBoundary } from "../ErrorBoundary";

export default function StudentProfilePageComponent() {
    const { slug, id: memberId } = useParams();
    const { isStudentView, tenant } = useOutletContext<any>() as any;
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    if (!memberId) return <div>Invalid Member ID</div>;

    const { data: member, isLoading: loadingMember } = useMember(slug || '', memberId);
    const { data: notes, isLoading: loadingNotes } = useMemberNotes(slug || '', memberId);
    const { data: coupons, isLoading: loadingCoupons } = useMemberCoupons(slug || '', memberId);
    const { data: availablePacks } = usePacks(slug || '');

    const [activeTab, setActiveTab] = useState("overview");
    const [isAssigningPack, setIsAssigningPack] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [selectedPackId, setSelectedPackId] = useState("");
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    const userProfile = member?.user?.profile || {};
    const fullName = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(" ") || member?.user?.email || "Unknown";
    const rolesStr = member?.roles?.map((r: any) => r.role).join(", ") || "Student";
    const totalCredits = (member?.purchasedPacks || []).reduce((acc: number, p: any) => acc + p.remainingCredits, 0);
    const hasActiveMembership = member?.memberships?.some((m: any) => m.status === 'active');
    const membershipStatus = hasActiveMembership ? 'Active' : 'Inactive';

    const customFieldsDef = tenant?.customFieldDefinitions || {};
    const memberCustomFields = member?.customFields || {};

    const noShows = member?.bookings?.filter((b: any) => {
        if (b.status !== 'confirmed') return false;
        const isPast = new Date(b.class?.startTime || b.createdAt) < new Date();
        const notCheckedIn = !b.checkedInAt;
        return isPast && notCheckedIn;
    }).length || 0;

    const addNoteMutation = useMutation({
        mutationFn: async (note: string) => {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}/notes`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ note })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['member-notes', slug, memberId] });
            setNewNote("");
            toast.success("Note added");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const deleteNoteMutation = useMutation({
        mutationFn: async (noteId: string) => {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}/notes/${noteId}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['member-notes', slug, memberId] });
            setNoteToDelete(null);
            toast.success("Note deleted");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const assignPackMutation = useMutation({
        mutationFn: async (packId: string) => {
            const token = await getToken();
            const res = await apiRequest(`/commerce/purchase`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ memberId, packId })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['member', slug, memberId] });
            setIsAssigningPack(false);
            toast.success("Pack assigned");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (updates: any) => {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}`, token, {
                method: "PUT",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(updates)
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['member', slug, memberId] });
            setIsEditingProfile(false);
            toast.success("Profile updated");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const sendEmailMutation = useMutation({
        mutationFn: async ({ subject, body }: { subject: string, body: string }) => {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}/email`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ subject, body })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            setIsSendingEmail(false);
            setEmailSubject("");
            setEmailBody("");
            toast.success("Email sent");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}/status`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ status })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: (_, status) => {
            queryClient.invalidateQueries({ queryKey: ['member', slug, memberId] });
            setIsDeactivating(false);
            toast.success(`Member ${status === 'inactive' ? 'deactivated' : 'activated'}`);
        },
        onError: (e: any) => toast.error(e.message)
    });

    const reactivateCouponMutation = useMutation({
        mutationFn: async (couponId: string) => {
            const token = await getToken();
            const res = await apiRequest(`/commerce/coupons/${couponId}/reactivate`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ days: 7 })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['member-coupons', slug, memberId] });
            toast.success("Coupon reactivated for 7 days");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingPhoto(true);
            const token = await getToken();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('memberId', memberId);
            const response = await fetch(`${API_URL}/uploads/portrait`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Slug': tenant.slug
                },
                body: formData
            });
            const result = await response.json() as any;
            if (result.error) throw new Error(result.error);
            queryClient.invalidateQueries({ queryKey: ['member', slug, memberId] });
            toast.success("Photo uploaded");
        } catch (err: any) {
            toast.error(err.message || 'Failed to upload photo');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    if (loadingMember) return <div className="p-12 text-center text-zinc-500">Loading student profile...</div>;
    if (!member) return <div className="p-12 text-center text-red-500">Student not found</div>;

    return (
        <ComponentErrorBoundary>
            <div className="max-w-5xl mx-auto pb-10">
                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <label className="relative h-20 w-20 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200 overflow-hidden cursor-pointer group">
                            {userProfile.portraitUrl ? (
                                <img src={userProfile.portraitUrl} alt={fullName} className="h-full w-full object-cover" />
                            ) : (
                                <User className="h-8 w-8 text-zinc-400" />
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {isUploadingPhoto ? <span className="text-white text-xs">...</span> : <Camera className="h-6 w-6 text-white" />}
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                        </label>

                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{fullName}</h1>
                                <Badge variant={hasActiveMembership ? 'success' : 'secondary'}>{membershipStatus}</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-zinc-500 text-sm">
                                <Mail className="h-4 w-4" />
                                <span>{member.user?.email}</span>
                                <span className="mx-1">•</span>
                                <Badge variant="outline" className="capitalize">{rolesStr}</Badge>
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">
                                Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 relative">
                        <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
                            Edit Profile
                        </Button>
                        <div className="relative">
                            <Button variant="default" onClick={() => setShowActions(!showActions)}>
                                Actions <MoreHorizontal className="ml-2 h-4 w-4" />
                            </Button>
                            {showActions && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-md shadow-lg z-10 py-1">
                                    <button
                                        onClick={() => { setShowActions(false); setIsSendingEmail(true); }}
                                        className="block w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                    >
                                        Send Email
                                    </button>
                                    <div className="border-t border-zinc-100 my-1"></div>
                                    <button
                                        onClick={() => { setShowActions(false); setIsDeactivating(true); }}
                                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        {member.status === 'active' ? 'Deactivate Member' : 'Activate Member'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex border-b border-zinc-200 mb-6 overflow-x-auto">
                    {[
                        { id: "overview", label: "Overview" },
                        { id: "memberships", label: "Memberships & Credits" },
                        { id: "coupons", label: "Generated Coupons" },
                        { id: "attendance", label: "Attendance" },
                        { id: "notes", label: "Staff Notes" },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {activeTab === "overview" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                <Card>
                                    <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="p-4 bg-zinc-50 rounded border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                                                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{member.bookings?.length || 0}</div>
                                                <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Classes Taken</div>
                                            </div>
                                            <div className="p-4 bg-zinc-50 rounded border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                                                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalCredits}</div>
                                                <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Available Credits</div>
                                            </div>
                                            <div className="p-4 bg-zinc-50 rounded border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                                                <div className="text-2xl font-bold text-red-600">{noShows}</div>
                                                <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">No Shows</div>
                                            </div>
                                            <div className="p-4 bg-zinc-50 rounded border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                                                <div className={`text-2xl font-bold ${hasActiveMembership ? 'text-green-600' : 'text-zinc-400'}`}>
                                                    {membershipStatus}
                                                </div>
                                                <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Membership Status</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div>
                                <Card>
                                    <CardHeader><CardTitle className="text-sm uppercase text-zinc-500 tracking-wider">Contact Info</CardTitle></CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div>
                                            <label className="block text-xs text-zinc-400">Email</label>
                                            <div className="text-zinc-800 dark:text-zinc-200">{member.user?.email}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-400">Phone</label>
                                            <div className="text-zinc-800 dark:text-zinc-200">{userProfile.phone || "Not provided"}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {Object.keys(customFieldsDef).length > 0 && (
                                    <Card className="mt-6">
                                        <CardHeader><CardTitle className="text-sm uppercase text-zinc-500 tracking-wider">Additional Info</CardTitle></CardHeader>
                                        <CardContent className="space-y-4 text-sm">
                                            {Object.entries(customFieldsDef).map(([key, def]: [string, any]) => (
                                                <div key={key}>
                                                    <label className="block text-xs text-zinc-400">{def.label}</label>
                                                    <div className="text-zinc-800 dark:text-zinc-200">
                                                        {def.fieldType === 'boolean'
                                                            ? (memberCustomFields[key] ? 'Yes' : 'No')
                                                            : (memberCustomFields[key]?.toString() || "—")
                                                        }
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "memberships" && (
                        <div className="space-y-6">
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsAssigningPack(!isAssigningPack)}>
                                    <Plus className="h-4 w-4 mr-2" /> Assign Pack
                                </Button>
                                <Button variant="outline" size="sm" disabled>
                                    <Plus className="h-4 w-4 mr-2" /> Add Plan
                                </Button>
                            </div>

                            {isAssigningPack && (
                                <Card className="bg-zinc-50 dark:bg-zinc-800/50">
                                    <CardContent className="pt-6">
                                        <h4 className="font-semibold text-sm mb-3">Assign Class Pack (Internal / POS)</h4>
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-zinc-500 mb-1">Select Pack</label>
                                                <Select value={selectedPackId} onChange={(e) => setSelectedPackId(e.target.value)}>
                                                    <option value="">Select a pack...</option>
                                                    {(availablePacks || []).map((p: any) => (
                                                        <option key={p.id} value={p.id}>{p.name} ({p.credits} credits) - ${(p.price / 100).toFixed(2)}</option>
                                                    ))}
                                                </Select>
                                            </div>
                                            <Button
                                                onClick={() => { if (selectedPackId) assignPackMutation.mutate(selectedPackId) }}
                                                disabled={!selectedPackId || assignPackMutation.isPending}
                                            >
                                                {assignPackMutation.isPending ? 'Charging...' : 'Assign & Charge'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Active Memberships</h3>
                                {member.memberships?.length > 0 ? (
                                    <div className="space-y-3">
                                        {member.memberships.map((m: any) => (
                                            <Card key={m.id} className="p-4 flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold">{m.plan?.name || "Unknown Plan"}</h3>
                                                    <div className="text-sm text-zinc-500 mt-1">
                                                        Status: <span className="capitalize font-medium text-zinc-700 dark:text-zinc-300">{m.status}</span>
                                                        <span className="mx-2">•</span>
                                                        Started {format(new Date(m.startDate), "MMM d, yyyy")}
                                                    </div>
                                                </div>
                                                <Badge variant={m.status === 'active' ? 'success' : 'secondary'}>{m.status}</Badge>
                                            </Card>
                                        ))}
                                    </div>
                                ) : <div className="text-sm text-zinc-500 italic">No active memberships.</div>}
                            </div>

                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Class Packs & Credits</h3>
                                {member.purchasedPacks?.length > 0 ? (
                                    <div className="space-y-3">
                                        {member.purchasedPacks.map((pack: any) => (
                                            <Card key={pack.id} className="p-4 flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold">{pack.definition?.name || "Unknown Pack"}</h3>
                                                    <div className="text-sm text-zinc-500 mt-1 flex items-center gap-3">
                                                        <span>Purchased {format(new Date(), "MMM d, yyyy")}</span>
                                                        {pack.expiresAt && (
                                                            <>
                                                                <span>•</span>
                                                                <span className={new Date(pack.expiresAt) < new Date() ? "text-red-600" : ""}>
                                                                    Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold">{pack.remainingCredits} / {pack.initialCredits}</div>
                                                    <div className="text-xs text-zinc-500 uppercase">Credits Left</div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                ) : <div className="text-sm text-zinc-500 italic">No packs purchased.</div>}
                            </div>
                        </div>
                    )}

                    {activeTab === "coupons" && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 dark:bg-blue-900/20 dark:border-blue-800">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    These are coupons automatically generated for this student by marketing automations.
                                </p>
                            </div>
                            {loadingCoupons ? <div>Loading coupons...</div> : coupons && coupons.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {coupons.map((coupon: any) => {
                                        const isExpired = new Date(coupon.expiresAt) < new Date();
                                        const canReactivate = !coupon.active || isExpired;
                                        return (
                                            <Card key={coupon.id} className="relative">
                                                <CardContent className="pt-6">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="font-mono text-lg font-bold bg-zinc-100 px-2 py-1 rounded dark:bg-zinc-800">
                                                            {coupon.code}
                                                        </div>
                                                        <Badge variant={!coupon.active ? 'secondary' : isExpired ? 'destructive' : 'success'}>
                                                            {!coupon.active ? 'Inactive' : isExpired ? 'Expired' : 'Active'}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                                        {coupon.type === 'percent' ? `${coupon.value}% Off` : `$${coupon.value} Off`}
                                                        <div className="text-xs text-zinc-400 mt-1">
                                                            Expires: {format(new Date(coupon.expiresAt), "MMM d, yyyy")}
                                                        </div>
                                                    </div>
                                                    {canReactivate && (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full"
                                                            onClick={() => reactivateCouponMutation.mutate(coupon.id)}
                                                            disabled={reactivateCouponMutation.isPending}
                                                        >
                                                            Reactivate (7 Days)
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            ) : <div className="text-center py-10 text-zinc-500">No coupons found.</div>}
                        </div>
                    )}

                    {activeTab === "attendance" && (
                        <Card className="overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-zinc-500">Date</th>
                                        <th className="px-4 py-3 font-medium text-zinc-500">Class</th>
                                        <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {member.bookings?.length === 0 ? (
                                        <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-400">No attendance history</td></tr>
                                    ) : (
                                        member.bookings?.map((booking: any) => (
                                            <tr key={booking.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                                                    {format(new Date(booking.class?.startTime || booking.createdAt), "MMM d, h:mm a")}
                                                </td>
                                                <td className="px-4 py-3 font-medium">
                                                    {booking.class?.title || "Unknown Class"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={booking.status === 'confirmed' ? 'success' : 'secondary'}>{booking.status}</Badge>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </Card>
                    )}

                    {activeTab === "notes" && (
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Add a note about this student..."
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && newNote) addNoteMutation.mutate(newNote) }}
                                />
                                <Button onClick={() => addNoteMutation.mutate(newNote)} disabled={!newNote || addNoteMutation.isPending}>Add Note</Button>
                            </div>

                            {loadingNotes ? <div>Loading notes...</div> : (
                                <div className="space-y-4">
                                    {(notes || []).map((note: any) => (
                                        <Card key={note.id} className="p-4">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{note.note}</p>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-red-600" onClick={() => setNoteToDelete(note.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                                                <User className="h-3 w-3" />
                                                <span>{note.author?.user?.profile?.firstName || note.author?.user?.email || "Unknown Staff"}</span>
                                                <span>•</span>
                                                <span>{format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}</span>
                                            </div>
                                        </Card>
                                    ))}
                                    {notes?.length === 0 && <div className="text-center py-8 text-zinc-400">No notes yet.</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Profile</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const updates: any = {
                                firstName: formData.get("firstName"),
                                lastName: formData.get("lastName"),
                                phone: formData.get("phone"),
                                customFields: {}
                            };

                            Object.keys(customFieldsDef).forEach(key => {
                                const val = formData.get(`custom_${key}`);
                                if (customFieldsDef[key].fieldType === 'boolean') {
                                    updates.customFields[key] = (e.currentTarget.elements.namedItem(`custom_${key}`) as HTMLInputElement).checked;
                                } else {
                                    updates.customFields[key] = val;
                                }
                            });

                            updateProfileMutation.mutate(updates);
                        }} className="space-y-4 py-4 mt-2 max-h-[70vh] overflow-y-auto px-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">First Name</label>
                                    <Input name="firstName" defaultValue={userProfile.firstName} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Last Name</label>
                                    <Input name="lastName" defaultValue={userProfile.lastName} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Phone</label>
                                <Input name="phone" defaultValue={userProfile.phone} />
                            </div>

                            {Object.keys(customFieldsDef).length > 0 && (
                                <div className="space-y-4 border-t border-zinc-100 pt-4 mt-4">
                                    <h4 className="font-medium text-sm text-zinc-900">Additional Information</h4>
                                    {Object.entries(customFieldsDef).map(([key, def]: [string, any]) => (
                                        <div key={key} className="space-y-2">
                                            <label className="text-sm font-medium">{def.label} {def.isRequired && "*"}</label>
                                            {def.fieldType === 'select' ? (
                                                <Select name={`custom_${key}`} defaultValue={memberCustomFields[key] || ""}>
                                                    <option value="">Select...</option>
                                                    {def.options?.map((opt: string) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </Select>
                                            ) : def.fieldType === 'boolean' ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        name={`custom_${key}`}
                                                        defaultChecked={!!memberCustomFields[key]}
                                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-zinc-600">{def.label}</span>
                                                </div>
                                            ) : (
                                                <Input
                                                    type={def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'}
                                                    name={`custom_${key}`}
                                                    defaultValue={memberCustomFields[key] || ""}
                                                    required={def.isRequired}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <DialogFooter className="mt-4">
                                <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                                <Button type="submit" disabled={updateProfileMutation.isPending}>Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isSendingEmail} onOpenChange={setIsSendingEmail}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Send Email</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Subject</label>
                                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject line..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Message</label>
                                <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Message body..." rows={5} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsSendingEmail(false)}>Cancel</Button>
                            <Button onClick={() => sendEmailMutation.mutate({ subject: emailSubject, body: emailBody })} disabled={!emailSubject || !emailBody || sendEmailMutation.isPending}>
                                Send Email
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <ConfirmDialog
                    open={!!noteToDelete}
                    onOpenChange={(open) => !open && setNoteToDelete(null)}
                    onConfirm={() => { if (noteToDelete) deleteNoteMutation.mutate(noteToDelete); }}
                    title="Delete Note"
                    description="Are you sure you want to delete this note? This cannot be undone."
                    confirmText="Delete"
                />

                <ConfirmDialog
                    open={isDeactivating}
                    onOpenChange={(open) => setIsDeactivating(open)}
                    onConfirm={() => {
                        updateStatusMutation.mutate(member.status === 'active' ? 'inactive' : 'active')
                    }}
                    title={member.status === 'active' ? 'Deactivate Member' : 'Activate Member'}
                    description={member.status === 'active' ? "This will prevent the member from booking classes. History preserved." : "This will restore access for this member."}
                    confirmText={member.status === 'active' ? "Deactivate" : "Activate"}
                />
            </div>
        </ComponentErrorBoundary>
    );
}

