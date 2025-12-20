import { LoaderFunction } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";

export const loader: LoaderFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const tenants = await apiRequest("/admin/tenants", token);
        const logs = await apiRequest("/admin/logs", token);
        return { tenants, logs };
    } catch (e) {
        throw new Response("Unauthorized", { status: 403 });
    }
};

export default function AdminDashboard() {
    const { tenants, logs: initialLogs } = useLoaderData<any>();
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [tenantUsers, setTenantUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [impersonating, setImpersonating] = useState(false);

    // We can use the useAuth hook to get the current token for client-side fetches
    // import { useAuth } from "@clerk/react-router";
    // const { getToken } = useAuth();
    // But apiRequest handles it if we pass null/undefined for token? 
    // Wait, apiRequest needs a token. 
    // In a real app we'd use the proper hook. For admin dashboard, let's just assume we have a token or the utility can handle it?
    // Actually, `apiRequest` takes `token`. If I don't pass it, it might fail.
    // Let's import useAuth.

    // Re-implementing imports that might be needed if I use `useAuth`
    // But `admin.tsx` is an SSR route, so I can also just rely on `loader` for initial data.
    // For fetching users dynamically, I need a token.

    // Let's grab token from window if we can, or use Clerk hook.
    // Since I can't easily add imports without rewriting the whole file (which I am doing), let's add `useAuth`.

    // WAIT: I cannot use `useAuth` from `@clerk/react-router/ssr.server` on client. 
    // I need `@clerk/react-router`.

    const handleViewUsers = async (tenantId: string) => {
        if (selectedTenant === tenantId) {
            setSelectedTenant(null);
            return;
        }

        setSelectedTenant(tenantId);
        setLoadingUsers(true);
        try {
            // We need a token. 
            // Simplest hack for this admin page: passing the token is tricky without the hook.
            // I'll skip the token since I enabled impersonation token override, BUT I am the admin right now.
            // I need my OWN token.
            // Let's assume the user has a valid session.
            // Ideally I should pull `useAuth` from `@clerk/react-router`.
            // But I'll just use `window.Clerk.session.getToken()` if available or fetch cleanly.

            // Actually, cleanest way is adding useAuth import.
            // I will proceed with that assumption in the file content below.

            // Placeholder fetch since I can't easily interpolate the token hook call inside this function block without the hook existing in scope.
            // See helper below.
        } catch (e) {
            console.error(e);
            alert("Failed to load users");
        } finally {
            setLoadingUsers(false);
        }
    };

    return (
        <AdminDashboardContent
            tenants={tenants}
            logs={initialLogs}
        />
    );
}

// Separate component to use hooks cleanly
import { useAuth } from "@clerk/react-router";
import { LogoutButton } from "../components/LogoutButton";

function AdminDashboardContent({ tenants, logs }: { tenants: any[], logs: any[] }) {
    const { getToken } = useAuth();
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [tenantUsers, setTenantUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [impersonating, setImpersonating] = useState(false);
    const navigate = useNavigate();

    const loadUsers = async (tenantId: string) => {
        setLoadingUsers(true);
        try {
            const token = await getToken();
            const users = await apiRequest(`/admin/users?tenantId=${tenantId}`, token);
            setTenantUsers(users);
            setSelectedTenant(tenantId);
        } catch (e) {
            console.error(e);
            alert("Failed to load users");
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleImpersonate = async (userId: string) => {
        if (!confirm("Are you sure you want to impersonate this user?")) return;

        setImpersonating(true);
        try {
            const token = await getToken();
            const res = await apiRequest("/admin/impersonate", token, {
                method: "POST",
                body: JSON.stringify({ targetUserId: userId })
            });

            if (res.token) {
                localStorage.setItem("impersonation_token", res.token);
                // Force reload/redirect to dashboard
                window.location.href = "/";
            }
        } catch (e) {
            console.error(e);
            alert("Impersonation failed");
            setImpersonating(false);
        }
    };

    return (
        <div className="p-10 font-sans max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">System Admin</h1>
                <LogoutButton />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Tenants Column */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">Tenants</h2>
                    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                        {tenants.map((t: any) => (
                            <div key={t.id} className="border-b border-zinc-100 last:border-0">
                                <div className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-lg">{t.name}</div>
                                        <div className="text-sm text-zinc-500">{t.slug} • {t.id.substring(0, 8)}...</div>
                                    </div>
                                    <button
                                        onClick={() => selectedTenant === t.id ? setSelectedTenant(null) : loadUsers(t.id)}
                                        className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
                                    >
                                        {selectedTenant === t.id ? "Close" : "Manage"}
                                    </button>
                                </div>

                                {selectedTenant === t.id && (
                                    <div className="bg-zinc-50 p-4 border-t border-zinc-100 animate-in slide-in-from-top-2">
                                        <h3 className="text-sm font-semibold text-zinc-900 mb-3 uppercase tracking-wider">Users</h3>
                                        {loadingUsers ? (
                                            <div className="text-zinc-500 py-2">Loading users...</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {tenantUsers.map((m: any) => (
                                                    <div key={m.member.id} className="flex items-center justify-between bg-white p-3 rounded border border-zinc-200">
                                                        <div>
                                                            <div className="font-medium">
                                                                {m.user?.profile?.firstName} {m.user?.profile?.lastName}
                                                            </div>
                                                            <div className="text-xs text-zinc-500">{m.user?.email}</div>
                                                            <div className="text-xs text-blue-600 mt-0.5">
                                                                {(Array.isArray(m.roles) ? m.roles : []).join(", ") || "Member"}
                                                            </div>
                                                        </div>
                                                        <button
                                                            disabled={impersonating}
                                                            onClick={() => handleImpersonate(m.user.id)}
                                                            className="px-2 py-1 text-xs bg-amber-100 text-amber-900 hover:bg-amber-200 rounded border border-amber-200"
                                                        >
                                                            {impersonating ? "..." : "Impersonate"}
                                                        </button>
                                                    </div>
                                                ))}
                                                {tenantUsers.length === 0 && <div className="text-sm text-zinc-500 italic">No users found.</div>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logs Column */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">Audit Logs</h2>
                    <div className="bg-zinc-950 text-green-400 p-4 rounded-lg h-[600px] overflow-y-auto font-mono text-xs shadow-inner">
                        {logs.map((log: any) => (
                            <div key={log.id} className="mb-2 border-l-2 border-zinc-800 pl-2">
                                <div className="flex gap-2 text-zinc-500">
                                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                                    <span>{log.ipAddress}</span>
                                </div>
                                <div>
                                    <span className="text-yellow-400 font-bold">[{log.action}]</span>{' '}
                                    <span className="text-zinc-300">Target: {log.targetId}</span>
                                </div>
                                <div className="text-zinc-500 break-all">
                                    {JSON.stringify(log.details)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
