import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        // Fetch global users - needs a new endpoint or update existing users endpoint to support global list
        // Implementing basic listing for now assuming endpoint exists or will exist
        const apiUrl = (args.context.env as any).VITE_API_URL;
        const users = await apiRequest("/admin/users", token, {}, apiUrl);
        return { users };
    } catch (e) {
        throw new Response("Unauthorized", { status: 403 });
    }
};

export default function AdminUsers() {
    const { users } = useLoaderData<any>();

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Global User Directory</h2>
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {users.map((u: any) => (
                            <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-900 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">
                                        {u.profile?.firstName?.[0] || 'U'}
                                    </div>
                                    {u.profile?.firstName} {u.profile?.lastName}
                                </td>
                                <td className="px-6 py-4 text-zinc-600 text-sm">{u.email}</td>
                                <td className="px-6 py-4 text-zinc-600 text-sm">
                                    {u.isSystemAdmin ? (
                                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">Admin</span>
                                    ) : (
                                        <span className="text-zinc-400">User</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-zinc-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                    <Link to={`/admin/users/${u.id}`} className="text-zinc-500 hover:text-zinc-900 text-sm font-medium">Edit</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
