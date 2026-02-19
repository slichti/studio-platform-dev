
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const AdminUsersPage = lazy(() => import("../components/routes/AdminUsersPage"));

interface Tenant {
    id: string;
    name: string;
    slug?: string;
}

interface UserProfile {
    firstName?: string;
    lastName?: string;
    portraitUrl?: string;
}

interface Membership {
    tenantId: string;
    role?: string;
    roles?: { role: string }[];
    tenant: Tenant;
}

interface User {
    id: string;
    email: string;
    role: string;
    isPlatformAdmin?: boolean;
    createdAt: string;
    lastActiveAt?: string | null;
    profile?: UserProfile;
    memberships?: Membership[];
    contextRole?: string;
    mfaEnabled?: boolean;
}

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(args.request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search") || "";
    const tenantId = url.searchParams.get("tenantId") || "";
    const sort = url.searchParams.get("sort") || "joined_desc";

    const context = args.context as { cloudflare?: { env: any }, env?: any };
    const env = context.cloudflare?.env || context.env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    try {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (tenantId) params.append("tenantId", tenantId);
        if (sort) params.append("sort", sort);
        params.append("limit", limit.toString());
        params.append("offset", offset.toString());

        const [usersData, tenants] = await Promise.all([
            apiRequest<any>(`/admin/users?${params.toString()}`, token, {}, apiUrl),
            apiRequest<Tenant[]>(`/admin/tenants`, token, {}, apiUrl)
        ]);

        return {
            users: usersData.users,
            total: usersData.total,
            stats: usersData.stats,
            page,
            limit,
            tenants: tenants || [],
            error: null
        };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unauthorized";
        return { users: [], total: 0, page: 1, limit: 50, tenants: [], error: message };
    }
};

export default function AdminUsers() {
    return (
        <ClientOnly fallback={
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <Suspense fallback={
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            }>
                <AdminUsersPage />
            </Suspense>
        </ClientOnly>
    );
}
