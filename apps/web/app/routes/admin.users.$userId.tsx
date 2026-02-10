
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { Suspense, lazy } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const AdminUserPage = lazy(() => import("~/components/routes/AdminUserPage"));

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const userId = args.params.userId;
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";
    try {
        const [user, tenants] = await Promise.all([
            apiRequest(`/admin/users/${userId}`, token, {}, apiUrl),
            apiRequest(`/admin/tenants`, token, {}, apiUrl)
        ]);
        return { user, tenants };
    } catch (e) {
        throw new Response("User Not Found", { status: 404 });
    }
};

export default function EditUserRoute() {
    return (
        <ClientOnly fallback={<div className="p-10 text-center text-zinc-500">Loading user...</div>}>
            {() => (
                <Suspense fallback={<div className="p-10 text-center text-zinc-500">Loading user...</div>}>
                    <AdminUserPage />
                </Suspense>
            )}
        </ClientOnly>
    );
}
