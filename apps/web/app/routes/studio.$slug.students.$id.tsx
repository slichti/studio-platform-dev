// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Form, useNavigation, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest, API_URL } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { format } from "date-fns";
import {
    User, Mail, Calendar, CreditCard, FileText,
    MoreHorizontal, Check, X, Plus, Pencil, Trash2, Camera
} from "lucide-react";

type Member = {
    id: string;
    joinedAt: string;
    user: {
        id: string;
        email: string;
        profile?: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            portraitUrl?: string; // Added portraitUrl
        };
    };
    roles: { role: string }[];
    bookings: {
        id: string;
        status: string;
        createdAt: string;
        checkedInAt: string | null;
        class?: {
            title: string;
            startTime: string;
        }
    }[];
    waiverSignatures: {
        id: string;
        signedAt: string;
        template: {
            title: string;
        };
    }[];
    memberships: {
        id: string;
        status: string;
        startDate: string;
        plan: {
            name: string;
        };
    }[];
    purchasedPacks: {
        id: string;
        remainingCredits: number;
        initialCredits: number;
        expiresAt: string | null;
        definition: {
            name: string;
        };
    }[];
};

type PackDefinition = {
    id: string;
    name: string;
    credits: number;
    price: number;
};

type Note = {
    id: string;
    note: string;
    createdAt: string;
    author: {
        user: {
            email: string;
            profile?: { firstName?: string; lastName?: string; };
        } | null;
    } | null;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const memberId = params.id;

    if (!memberId) throw new Error("Member ID is required");

    try {
        const [memberRes, notesRes, packsRes] = await Promise.all([
            apiRequest(`/members/${memberId}`, token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }),
            apiRequest(`/members/${memberId}/notes`, token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }),
            apiRequest(`/commerce/packs`, token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }),
            apiRequest(`/members/${memberId}/coupons`, token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            })
        ]) as [any, any, any, any];

        if (memberRes.error) throw new Error(memberRes.error);

        return {
            member: memberRes.member as Member,
            notes: (notesRes.notes || []) as Note[],
            availablePacks: (packsRes.packs || []) as PackDefinition[],
            coupons: (args[3]?.coupons || []) as any[] // result is at index 3
        };
    } catch (e: any) {
        console.error("Failed to load student", e);
        throw e;
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { params, request } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const memberId = params.id;

    if (!memberId) return null;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "add_note") {
        const note = formData.get("note") as string;
        if (!note) return { error: "Note cannot be empty" };

        try {
            const res: any = await apiRequest(`/members/${memberId}/notes`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ note })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "delete_note") {
        const noteId = formData.get("noteId") as string;
        try {
            const res: any = await apiRequest(`/members/${memberId}/notes/${noteId}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': params.slug! }
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "edit_note") {
        const noteId = formData.get("noteId") as string;
        const note = formData.get("note") as string;
        try {
            const res: any = await apiRequest(`/members/${memberId}/notes/${noteId}`, token, {
                method: "PUT",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ note })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "assign_pack") {
        const packId = formData.get("packId") as string;
        try {
            const res: any = await apiRequest(`/commerce/purchase`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ memberId, packId })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "update_profile") {
        const firstName = formData.get("firstName") as string;
        const lastName = formData.get("lastName") as string;
        const phone = formData.get("phone") as string;

        try {
            // Update Member Profile (Studio Specific, if we had that, but here we likely update Global User or Member specific overrides)
            // For now assuming we update the member endpoint which handles profile updates
            const res: any = await apiRequest(`/members/${memberId}`, token, {
                method: "PUT",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ firstName, lastName, phone })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "send_email") {
        const subject = formData.get("subject") as string;
        const body = formData.get("body") as string;

        try {
            const res: any = await apiRequest(`/members/${memberId}/email`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ subject, body })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "update_status") {
        const status = formData.get("status") as string;

        try {
            const res: any = await apiRequest(`/members/${memberId}/status`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ status })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    if (intent === "reactivate_coupon") {
        const couponId = formData.get("couponId") as string;
        try {
            const res: any = await apiRequest(`/commerce/coupons/${couponId}/reactivate`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ days: 7 })
            });
            if (res.error) return { error: res.error };
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    return null;
};

export default function StudentProfile() {
    const { member, notes, availablePacks, coupons } = useLoaderData() as any as { member: Member, notes: Note[], availablePacks: PackDefinition[], coupons: any[] };
    const { tenant } = useOutletContext<any>();
    const navigation = useNavigation();
    const userProfile = member.user.profile || {};
    const [activeTab, setActiveTab] = useState("overview");
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [isAssigningPack, setIsAssigningPack] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const fullName = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(" ") || member.user.email;
    const rolesStr = member.roles.map(r => r.role).join(", ") || "Student";

    // Calculate Credits
    const totalCredits = (member.purchasedPacks || []).reduce((acc, p) => acc + p.remainingCredits, 0);

    // Calculate No Shows
    const noShows = member.bookings.filter(b => {
        if (b.status !== 'confirmed') return false;
        // Past class
        const isPast = new Date(b.class?.startTime || b.createdAt) < new Date();
        // Not checked in
        const notCheckedIn = !b.checkedInAt;
        return isPast && notCheckedIn;
    }).length;

    // Membership Status
    const hasActiveMembership = member.memberships.some(m => m.status === 'active');
    const membershipStatus = hasActiveMembership ? 'Active' : 'Inactive';

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingPhoto(true);
            const token = await (window as any).Clerk?.session?.getToken();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('memberId', member.id);
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
            window.location.reload();
        } catch (err: any) {
            alert(err.message || 'Failed to upload photo');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    {/* Clickable Avatar with Photo Upload */}
                    <label className="relative h-20 w-20 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200 overflow-hidden cursor-pointer group">
                        {userProfile.portraitUrl ? (
                            <img src={userProfile.portraitUrl} alt={fullName} className="h-full w-full object-cover" />
                        ) : (
                            <User className="h-8 w-8 text-zinc-400" />
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            {isUploadingPhoto ? (
                                <span className="text-white text-xs">Uploading...</span>
                            ) : (
                                <Camera className="h-6 w-6 text-white" />
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                            disabled={isUploadingPhoto}
                        />
                    </label>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-zinc-900">{fullName}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${hasActiveMembership ? 'bg-green-100 text-green-800 border-green-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                                {membershipStatus}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-zinc-500 text-sm">
                            <Mail className="h-4 w-4" />
                            <span>{member.user.email}</span>
                            <span className="mx-1">•</span>
                            <span className="capitalize px-2 py-0.5 bg-zinc-100 rounded-full text-xs font-medium border border-zinc-200">
                                {rolesStr}
                            </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                            Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 relative">
                    <button
                        onClick={() => setIsEditingProfile(true)}
                        className="px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium hover:bg-zinc-50"
                    >
                        Edit Profile
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="px-3 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800 flex items-center gap-2"
                        >
                            Actions
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
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
                                    Deactivate Member
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Email Modal */}
            {isSendingEmail && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
                        <h2 className="text-lg font-bold mb-4">Send Email to {fullName}</h2>
                        <Form method="post" onSubmit={() => setIsSendingEmail(false)}>
                            <input type="hidden" name="intent" value="send_email" />
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Subject</label>
                                    <input
                                        type="text"
                                        name="subject"
                                        required
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                                        placeholder="e.g. Important Update regarding your membership"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Message</label>
                                    <textarea
                                        name="body"
                                        rows={6}
                                        required
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                                        placeholder="Write your message here..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsSendingEmail(false)}
                                    className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <Mail className="h-4 w-4" />
                                    Send
                                </button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}

            {/* Deactivation Confirm Modal */}
            {isDeactivating && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-lg font-bold text-red-600 mb-2">Deactivate Member?</h2>
                        <p className="text-sm text-zinc-600 mb-6">
                            This will prevent the member from booking classes or accessing studio content.
                            Their history will be preserved. You can reactivate them later.
                        </p>
                        <Form method="post" onSubmit={() => setIsDeactivating(false)}>
                            <input type="hidden" name="intent" value="update_status" />
                            <input type="hidden" name="status" value="inactive" />
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDeactivating(false)}
                                    className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                                >
                                    Deactivate
                                </button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {isEditingProfile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-lg font-bold mb-4">Edit Profile</h2>
                        <Form method="post" onSubmit={() => setIsEditingProfile(false)}>
                            <input type="hidden" name="intent" value="update_profile" />
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">First Name</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            defaultValue={userProfile.firstName}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            defaultValue={userProfile.lastName}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        defaultValue={userProfile.phone}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingProfile(false)}
                                    className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 mb-6">
                {[
                    { id: "overview", label: "Overview" },
                    { id: "memberships", label: "Memberships & Credits" },
                    { id: "coupons", label: "Generated Coupons" },
                    { id: "attendance", label: "Attendance" },
                    { id: "documents", label: "Documents" },
                    { id: "notes", label: "Staff Notes" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 text-zinc-600 hover:text-zinc-900 ${activeTab === tab.id
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === "overview" && (
                    <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-6">
                            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
                                <h3 className="font-semibold text-lg mb-4">Quick Stats</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-zinc-50 rounded border border-zinc-100">
                                        <div className="text-2xl font-bold text-zinc-900">{member.bookings.length}</div>
                                        <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Classes Taken</div>
                                    </div>
                                    <div className="p-4 bg-zinc-50 rounded border border-zinc-100">
                                        <div className="text-2xl font-bold text-zinc-900">{totalCredits}</div>
                                        <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Available Credits</div>
                                    </div>
                                    <div className="p-4 bg-zinc-50 rounded border border-zinc-100">
                                        <div className="text-2xl font-bold text-red-600">{noShows}</div>
                                        <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">No Shows</div>
                                    </div>
                                    <div className="p-4 bg-zinc-50 rounded border border-zinc-100">
                                        <div className={`text-2xl font-bold ${hasActiveMembership ? 'text-green-600' : 'text-zinc-400'}`}>
                                            {membershipStatus}
                                        </div>
                                        <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Membership Status</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
                                <h3 className="font-semibold text-sm mb-4 uppercase text-zinc-500 tracking-wider">Contact Info</h3>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <label className="block text-xs text-zinc-400">Email</label>
                                        <div className="text-zinc-800">{member.user.email}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-400">Phone</label>
                                        <div className="text-zinc-800">{userProfile.phone || "Not provided"}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "memberships" && (
                    <div className="space-y-6">
                        {/* Action Bar */}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsAssigningPack(!isAssigningPack)}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium hover:bg-zinc-50"
                            >
                                <Plus className="h-4 w-4" />
                                Assign Pack
                            </button>
                            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium hover:bg-zinc-50">
                                <Plus className="h-4 w-4" />
                                Add Plan
                            </button>
                        </div>

                        {isAssigningPack && (
                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 mb-4">
                                <h4 className="font-semibold text-sm mb-3">Assign Class Pack (Internal / POS)</h4>
                                <Form method="post" onSubmit={() => setIsAssigningPack(false)} className="flex gap-4 items-end">
                                    <input type="hidden" name="intent" value="assign_pack" />
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-zinc-500 mb-1">Select Pack</label>
                                        <select name="packId" className="w-full text-sm border-zinc-300 rounded-md">
                                            {(availablePacks || []).map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.credits} credits) - ${(p.price / 100).toFixed(2)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                                        Assign & Charge
                                    </button>
                                </Form>
                            </div>
                        )}

                        {/* Memberships */}
                        <div>
                            <h3 className="font-medium text-zinc-900 mb-3">Active Memberships</h3>
                            {member.memberships && member.memberships.length > 0 ? (
                                <div className="space-y-3">
                                    {member.memberships.map((membership: any) => (
                                        <div key={membership.id} className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-zinc-900">{membership.plan?.name || "Unknown Plan"}</h3>
                                                <div className="text-sm text-zinc-500 mt-1">
                                                    Status: <span className="capitalize font-medium text-zinc-700">{membership.status}</span>
                                                    <span className="mx-2">•</span>
                                                    Started {format(new Date(membership.startDate), "MMM d, yyyy")}
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${membership.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                                }`}>
                                                {membership.status.toUpperCase()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-zinc-500 italic">No active memberships.</div>
                            )}
                        </div>

                        {/* Purchased Packs */}
                        <div>
                            <h3 className="font-medium text-zinc-900 mb-3">Class Packs & Credits</h3>
                            {member.purchasedPacks && member.purchasedPacks.length > 0 ? (
                                <div className="space-y-3">
                                    {member.purchasedPacks.map((pack: any) => (
                                        <div key={pack.id} className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-zinc-900">{pack.definition?.name || "Unknown Pack"}</h3>
                                                <div className="text-sm text-zinc-500 mt-1 flex items-center gap-3">
                                                    <span>Purchased {format(new Date(), "MMM d, yyyy")}</span> {/* createdAt missing in props but available in backend */}
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
                                                <div className="text-lg font-bold text-zinc-900">{pack.remainingCredits} / {pack.initialCredits}</div>
                                                <div className="text-xs text-zinc-500 uppercase">Credits Left</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-zinc-500 italic">No packs purchased.</div>
                            )}
                        </div>
                    </div>
                )}



                {activeTab === "coupons" && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-blue-800">
                                These are coupons automatically generated for this student by marketing automations.
                                If a student missed their window, you can manually reactivate a coupon for 7 days.
                            </p>
                        </div>
                        {coupons && coupons.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {coupons.map((coupon: any) => {
                                    const isExpired = new Date(coupon.expiresAt) < new Date();
                                    const canReactivate = !coupon.active || isExpired;

                                    return (
                                        <div key={coupon.id} className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-mono text-lg font-bold text-zinc-900 bg-zinc-100 px-2 py-1 rounded">
                                                    {coupon.code}
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${!coupon.active ? 'bg-zinc-100 text-zinc-500' :
                                                    isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {!coupon.active ? 'Inactive' : isExpired ? 'Expired' : 'Active'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-zinc-600 mb-4">
                                                {coupon.type === 'percent' ? `${coupon.value}% Off` : `$${coupon.value} Off`}
                                                <div className="text-xs text-zinc-400 mt-1">
                                                    Expires: {format(new Date(coupon.expiresAt), "MMM d, yyyy")}
                                                </div>
                                            </div>
                                            {canReactivate && (
                                                <Form method="post">
                                                    <input type="hidden" name="intent" value="reactivate_coupon" />
                                                    <input type="hidden" name="couponId" value={coupon.id} />
                                                    <button
                                                        type="submit"
                                                        className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                                    >
                                                        Reactivate for 7 Days
                                                    </button>
                                                </Form>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-zinc-50 rounded-lg border border-zinc-200 text-zinc-500">
                                No coupons have been generated for this student.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "attendance" && (
                    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-zinc-500">Date</th>
                                    <th className="px-4 py-3 font-medium text-zinc-500">Class</th>
                                    <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {member.bookings.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">No attendance history</td>
                                    </tr>
                                ) : (
                                    member.bookings.map((booking: any) => (
                                        <tr key={booking.id} className="hover:bg-zinc-50">
                                            <td className="px-4 py-3 text-zinc-600">
                                                {format(new Date(booking.createdAt), "MMM d, yyyy h:mm a")}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-900 font-medium">
                                                {booking.class?.title || "Unknown Class"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                                                    ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === "documents" && (
                    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-zinc-500">Document</th>
                                    <th className="px-4 py-3 font-medium text-zinc-500">Signed Date</th>
                                    <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {member.waiverSignatures?.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">No signed documents</td>
                                    </tr>
                                ) : (
                                    member.waiverSignatures?.map((sig: any) => (
                                        <tr key={sig.id} className="hover:bg-zinc-50">
                                            <td className="px-4 py-3 text-zinc-900 font-medium flex items-center gap-2">
                                                <FileText size={16} className="text-zinc-400" />
                                                {sig.template?.title || "Waiver"}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-600">
                                                {format(new Date(sig.signedAt), "MMM d, yyyy h:mm a")}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    <Check size={12} />
                                                    Signed
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === "notes" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Note Input */}
                        <div>
                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 mb-6">
                                <h3 className="font-semibold text-sm mb-3">Add Note</h3>
                                <Form method="post">
                                    <input type="hidden" name="intent" value="add_note" />
                                    <textarea
                                        name="note"
                                        rows={4}
                                        className="w-full border border-zinc-300 rounded p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-3 bg-white"
                                        placeholder="Enter confidential notes about this student..."
                                        required
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={navigation.state === "submitting"}
                                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {navigation.state === "submitting" ? "Saving..." : "Save Note"}
                                        </button>
                                    </div>
                                </Form>
                            </div>
                        </div>

                        {/* Note List */}
                        <div className="space-y-4">
                            {notes.length === 0 ? (
                                <div className="text-center text-zinc-400 py-10 italic">No notes added yet.</div>
                            ) : (
                                notes.map(note => (
                                    <div key={note.id} className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm relative group">
                                        {editingNoteId === note.id ? (
                                            <Form method="post" onSubmit={() => setEditingNoteId(null)}>
                                                <input type="hidden" name="intent" value="edit_note" />
                                                <input type="hidden" name="noteId" value={note.id} />
                                                <textarea
                                                    name="note"
                                                    defaultValue={note.note}
                                                    rows={3}
                                                    className="w-full border border-zinc-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                                                    required
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingNoteId(null)}
                                                        className="px-3 py-1 text-xs border border-zinc-300 rounded hover:bg-zinc-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </Form>
                                        ) : (
                                            <>
                                                <div className="text-sm text-zinc-800 whitespace-pre-wrap pr-8">{note.note}</div>

                                                {/* Actions */}
                                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingNoteId(note.id)}
                                                        className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-zinc-50 rounded"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <Form method="post" onSubmit={(e: React.FormEvent) => {
                                                        if (!confirm("Are you sure you want to delete this note?")) {
                                                            e.preventDefault();
                                                        }
                                                    }}>
                                                        <input type="hidden" name="intent" value="delete_note" />
                                                        <input type="hidden" name="noteId" value={note.id} />
                                                        <button
                                                            type="submit"
                                                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-zinc-50 rounded"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Form>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-50 pt-2">
                                                    <span>
                                                        Add by {note.author?.user?.profile?.firstName || note.author?.user?.email || "Unknown Staff"}
                                                    </span>
                                                    <span>
                                                        {format(new Date(note.createdAt), "MMM d, yyyy")}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


