
import { Outlet, Link, useLoaderData, Form, redirect } from "react-router";
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { UserButton } from "@clerk/react-router";
import Layout from "../components/Layout";

export const loader: LoaderFunction = async (args) => {
    const { userId, getToken } = await getAuth(args);
    if (!userId) {
        return redirect("/sign-in");
    }

    const token = await getToken();
    // Assuming API is accessible via VITE_API_URL and we are on the same domain or handling CORS correctly. 
    // In dev, we might need a specific URL. 
    // Also, we need to pass the tenant context. 
    // For now, let's assume the API URL is set up to point to the current tenant or generic, 
    // BUT we need to pass a header X-Tenant-Id or similar IF we are not on the subdomain.
    // However, the dashboard seems to be generic "/dashboard". 
    // This implies a platform-level dashboard or we need to know WHICH studio we are viewing.
    // If the user is logged in, they might belong to multiple studios.

    // For the purpose of "internal studio pieces", maybe we serve the studio dashboard at "/studio/:slug/dashboard".
    // The current route is "/dashboard". If this is the generic platform dashboard, it should list studios.

    // Let's assume for this task we are building the "Studio Internal Pieces", so we should probably redirect to a studio specific route or we are IN a studio context.
    // If we assume single-tenant deployment per domain, then we are fine.

    // Let's just try to fetch /tenant/me. If 404 (no tenant inferred), we might be on platform root?
    // We'll handle that.

    return {};
};

export default function DashboardRoute() {
    return (
        <Layout>
            <Outlet />
        </Layout>
    );
}
