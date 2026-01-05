// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Link, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";

type Student = {
    id: string; // Member ID
    user: {
        id: string; // Clerk ID
        email: string;
        profile?: {
            firstName?: string;
            lastName?: string;
        }
    };
    joinedAt: string;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const res = await apiRequest("/members", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        }) as any;
        const members = Array.isArray(res.members) ? res.members : [];
        return { members };
    } catch (e: any) {
        console.error("Failed to load members", e);
        return { members: [], error: e.message, errorDetails: (e as any).data };
    }
};

export default function StudioStudents() {
    const { members, error, errorDetails } = useLoaderData<{ members: Student[], error?: string, errorDetails?: any }>();
    const { roles } = useOutletContext<any>();
    const params = useParams();
    const slug = params.slug;
    const isOwner = roles && roles.includes('owner');
    const { getToken } = useAuth();

    const [updating, setUpdating] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isSubmittingMember, setIsSubmittingMember] = useState(false);

    // Filter members
    const filteredMembers = (members || []).filter((m: any) => {
        const q = searchQuery.toLowerCase();
        const name = `${m.user?.profile?.firstName || ''} ${m.user?.profile?.lastName || ''}`.toLowerCase();
        const email = (m.user?.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmittingMember(true);
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email');
        const firstName = formData.get('firstName');
        const lastName = formData.get('lastName');

        if (!slug) {
            alert("Missing studio slug");
            setIsSubmittingMember(false);
            return;
        }

        try {
            const token = await getToken();
            const res = await apiRequest(`/members`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ email, firstName, lastName })
            }) as any;

            if (res.error) {
                alert(res.error);
            } else {
                window.location.reload();
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmittingMember(false);
            setIsAddingMember(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: string) => {
        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
        setUpdating(memberId);

        if (!slug) {
            alert("Missing studio slug");
            setUpdating(null);
            return;
        }

        try {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}/role`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ role: newRole })
            }) as any;
            if (res.error) alert(res.error);
            else window.location.reload();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">People</h2>
                <div className="flex gap-2">
                    <input
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm min-w-[250px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                    />
                    <button
                        onClick={() => setIsAddingMember(true)}
                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 text-sm font-medium transition-colors"
                    >
                        Add Member
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm border border-red-100">
                    Failed to load members: {error}
                    {errorDetails && (
                        <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                            {JSON.stringify(errorDetails, null, 2)}
                        </pre>
                    )}
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {members.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400 italic">
                                    No members found yet.
                                </td>
                            </tr>
                        ) : filteredMembers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400 italic">
                                    No members match your search for "{searchQuery}".
                                </td>
                            </tr>
                        ) : (
                            filteredMembers.map((member: any) => (
                                <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold uppercase ring-1 ring-blue-200 dark:ring-blue-800">
                                                {(member.user?.email || '??').substring(0, 2)}
                                            </div>
                                            <Link
                                                to={`${member.id}`}
                                                className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                            >
                                                {member.user?.profile?.firstName ? `${member.user.profile.firstName} ${member.user.profile.lastName}` : 'Unknown Student'}
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-sm">{member.user.email}</td>
                                    <td className="px-6 py-4">
                                        {isOwner ? (
                                            <select
                                                disabled={updating === member.id}
                                                className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-md p-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={(Array.isArray(member.roles) ? member.roles : []).find((r: any) => r.role === 'owner' || r.role === 'instructor')?.role || 'student'}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            >
                                                <option value="student">Student</option>
                                                <option value="instructor">Instructor</option>
                                                <option value="owner">Owner</option>
                                            </select>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 capitalize border border-zinc-200 dark:border-zinc-700">
                                                {(Array.isArray(member.roles) ? member.roles : []).map((r: any) => r.role).join(', ') || 'Student'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 text-sm">
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-sm font-medium transition-colors">Edit</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Showing {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
                </div>
            </div>

            {/* Add Member Modal */}
            {isAddingMember && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Add New Member</h2>
                            <button onClick={() => setIsAddingMember(false)} className="text-zinc-400 hover:text-zinc-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                                    placeholder="student@example.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                                        placeholder="Jane"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingMember(false)}
                                    className="px-4 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingMember}
                                    className="px-4 py-2 text-sm font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {isSubmittingMember ? "Adding Member..." : "Add Member"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
