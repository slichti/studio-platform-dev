import { LoaderFunction } from "react-router";
import { useLoaderData, useOutletContext } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Students</h2>
                <div className="flex gap-2">
                    <input
                        placeholder="Search students..."
                        className="px-3 py-2 border border-zinc-200 rounded-md text-sm min-w-[250px]"
                    />
                    <button className="bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800 text-sm font-medium">
                        Add Student
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    Failed to load students: {error}
                </div>
            )}

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {members.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                    No students found yet.
                                </td>
                            </tr>
                        ) : (
                            members.map((member) => (
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
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800">
                                            —
                                        </span>
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
                    Showing {members.length} student{members.length === 1 ? '' : 's'}
                </div>
            </div>
        </div>
    );
}
