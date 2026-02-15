
import { type LoaderFunctionArgs } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "../utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const AdminTenantsPage = lazy(() => import("../components/routes/AdminTenantsPage"));

export async function loader(args: LoaderFunctionArgs) {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    if (!token) throw new Error("Unauthorized");

    const [tenants, platformConfig]: [any, any] = await Promise.all([
        apiRequest("/admin/tenants", token),
        apiRequest("/admin/platform/config", token)
    ]);

    return {
        tenants,
        platformConfig
    };
}

export default function AdminTenants() {
    return (
        <ClientOnly fallback={
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        }>
            <Suspense fallback={
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            }>
                <AdminTenantsPage />
            </Suspense>
        </ClientOnly>
    );
}

export function ErrorBoundary({ error }: { error: Error }) {
    console.error("AdminTenants Error:", error);
    return (
        <div className="p-8 text-center text-red-600 dark:text-red-400">
            <h2 className="text-xl font-bold mb-2">Failed to load Tenants</h2>
            <p className="text-sm">
                There was an error loading this page. This might be due to a network issue or an ad blocker.
                <br />
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                >
                    Retry
                </button>
            </p>
        </div>
    );
}
