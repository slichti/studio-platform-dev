import { LoaderFunction } from "react-router";
import { useLoaderData, useOutletContext } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
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

export const loader: LoaderFunction = async (args) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const members = await apiRequest("/members", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { members };
    } catch (e: any) {
        console.error("Failed to load members", e);
        return { members: [], error: e.message };
    }
};

export default function StudioStudents() {
    const { members, error } = useLoaderData<{ members: Student[], error?: string }>();
    const { roles } = useOutletContext<any>();
    const isOwner = roles && roles.includes('owner');
    const { getToken } = useAuth();
    const [updating, setUpdating] = useState<string | null>(null);

    const handleRoleChange = async (memberId: string, newRole: string) => {
        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
        setUpdating(memberId);
        try {
            const token = await getToken();
            const res = await apiRequest(`/members/${memberId}/role`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': window.location.pathname.split('/')[2] }, // Grab slug from URL hack or context
                body: JSON.stringify({ role: newRole })
            });
            if (res.error) alert(res.error);
            else window.location.reload(); // Simple refresh for now
        } catch (e: any) {
            alert(e.message);
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">People</h2>
                <div className="flex gap-2">
                    <input
                        placeholder="Search members..."
                        className="px-3 py-2 border border-zinc-200 rounded-md text-sm min-w-[250px]"
                    />
                    <button className="bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800 text-sm font-medium">
                        Add Member
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    Failed to load members: {error}
                </div>
            )}

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {members.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                    No members found yet.
                                </td>
                            </tr>
                        ) : (
                            members.map((member: any) => (
                                <tr key={member.id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-900">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold uppercase">
                                                {member.user.email.substring(0, 2)}
                                            </div>
                                            {member.user.profile?.firstName ? `${member.user.profile.firstName} ${member.user.profile.lastName}` : 'Unknown Name'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-600 text-sm">{member.user.email}</td>
                                    <td className="px-6 py-4">
                                        {isOwner ? (
                                            <select
                                                disabled={updating === member.id}
                                                className="text-sm border-zinc-200 rounded p-1 bg-zinc-50"
                                                value={member.roles.find((r: any) => r.role === 'owner' || r.role === 'instructor')?.role || 'student'}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            >
                                                <option value="student">Student</option>
                                                <option value="instructor">Instructor</option>
                                                <option value="owner">Owner</option>
                                            </select>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 capitalize">
                                                {member.roles.map((r: any) => r.role).join(', ') || 'Student'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500 text-sm">
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-zinc-400 hover:text-zinc-600 text-sm">Edit</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="p-4 border-t border-zinc-100 bg-zinc-50 text-center text-xs text-zinc-500">
                    Showing {members.length} member{members.length === 1 ? '' : 's'}
                </div>
            </div>
        </div>
    );
}
