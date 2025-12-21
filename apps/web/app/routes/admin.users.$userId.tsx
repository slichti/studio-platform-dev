import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const userId = args.params.userId;
    try {
        const user = await apiRequest(`/admin/users/${userId}`, token, {}, (args.context.env as any).VITE_API_URL);
        return { user };
    } catch (e) {
        throw new Response("User Not Found", { status: 404 });
    }
};

export default function EditUser() {
    const { user } = useLoaderData<any>();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [isSystemAdmin, setIsSystemAdmin] = useState(user.isSystemAdmin);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const token = await getToken();
            await apiRequest(`/admin/users/${user.id}`, token, {
                method: 'PUT',
                body: JSON.stringify({ isSystemAdmin })
            });
            navigate("/admin/users");
        } catch (e: any) {
            setError(e.message || "Failed to update user");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Edit User</h2>
                <button
                    onClick={() => navigate("/admin/users")}
                    className="text-sm text-zinc-500 hover:text-zinc-900"
                >
                    Back to Directory
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-8 shadow-sm space-y-8">
                {/* Profile Header */}
                <div className="flex items-center gap-4 border-b border-zinc-100 pb-8">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-500">
                        {user.profile?.firstName?.[0] || 'U'}
                    </div>
                    <div>
                        <div className="font-semibold text-lg">{user.profile?.firstName} {user.profile?.lastName}</div>
                        <div className="text-zinc-500 font-mono text-sm">{user.id}</div>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                        <div className="p-2 bg-zinc-50 border border-zinc-200 rounded-md text-zinc-500 text-sm">
                            {user.email}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">Managed by Identity Provider (Google/Clerk)</p>
                    </div>

                    <div className="pt-4 border-t border-zinc-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isSystemAdmin}
                                onChange={(e) => setIsSystemAdmin(e.target.checked)}
                                className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                                <div className="font-medium text-zinc-900">System Administrator</div>
                                <div className="text-sm text-zinc-500">Grants full access to the Admin Dashboard (Tenants, Users, System Status).</div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-zinc-100 flex items-center justify-between">
                    <div className="text-red-600 text-sm font-medium">{error}</div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate("/admin/users")}
                            className="px-4 py-2 text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors font-medium text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
