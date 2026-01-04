// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Link } from "react-router";
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
        console.log("Students Loader Res:", JSON.stringify(res, null, 2));
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
            }) as any;
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
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">People</h2>
                <div className="flex gap-2">
                    <input
                        placeholder="Search members..."
                        className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm min-w-[250px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                    <button className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 text-sm font-medium">
                        Add Member
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
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
                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                                    No members found yet.
                                </td>
                            </tr>
                        ) : (
                            (Array.isArray(members) ? members : []).map((member: any) => (
                                <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold uppercase">
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
                                                className="text-sm border-zinc-200 dark:border-zinc-700 rounded p-1 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                value={(Array.isArray(member.roles) ? member.roles : []).find((r: any) => r.role === 'owner' || r.role === 'instructor')?.role || 'student'}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            >
                                                <option value="student">Student</option>
                                                <option value="instructor">Instructor</option>
                                                <option value="owner">Owner</option>
                                            </select>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 capitalize">
                                                {(Array.isArray(member.roles) ? member.roles : []).map((r: any) => r.role).join(', ') || 'Student'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 text-sm">
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-sm">Edit</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Showing {members.length} member{members.length === 1 ? '' : 's'}
                </div>
            </div>
        </div>
    );
}
