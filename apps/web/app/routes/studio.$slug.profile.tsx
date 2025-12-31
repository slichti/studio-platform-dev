// @ts-ignore
import { ActionFunction, LoaderFunction } from "react-router";
// @ts-ignore
import { useLoaderData, useFetcher } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import { FamilyManager } from "~/components/FamilyManager";
import { AvailabilityManager } from "~/components/AvailabilityManager";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    // We can rely on the client-side fetch in FamilyManager, or prefetch here.
    // For simplicity, we just pass the token or let the client handle it?
    // Actually, passing token to client component is risky if SSR? 
    // Usually we use useFetcher which handles auth via cookies or headers if setup.
    // But our API expects Bearer token. 

    // Let's just return the user profile for now.
    const user = await apiRequest("/users/me", token);
    return { user, token };
};

export const action: ActionFunction = async (args: any) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "add_child") {
        const firstName = formData.get("firstName");
        const lastName = formData.get("lastName");
        const dob = formData.get("dob");

        try {
            // Include X-Tenant-Slug header or rely on context
            // Our apiRequest util might handle tenant header if configured?
            // checking apiRequest... assume it needs help or we rely on backend extracting from somewhere?
            // The backend /me/family requires tenant context. 
            // We usually pass tenant ID or Slug in header.

            // NOTE: apiRequest helper usually handles base URL. We need to pass headers.
            const res = await fetch(`${process.env.API_URL || 'https://api.studio-platform-dev.pages.dev'}/users/me/family`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Tenant-Slug': params.slug!
                },
                body: JSON.stringify({ firstName, lastName, dob })
            });

            const data = await res.json();
            return data;
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return null;
}

export default function StudioProfilePage() {
    const { user, token } = useLoaderData<{ user: any, token: string }>();

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">Your Profile</h1>
            <p className="text-zinc-500 mb-8">Manage your information and family members.</p>

            <div className="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Personal Info</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase">First Name</label>
                        <p className="text-zinc-900">{user.profile?.firstName}</p>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Last Name</label>
                        <p className="text-zinc-900">{user.profile?.lastName}</p>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Email</label>
                        <p className="text-zinc-900">{user.email}</p>
                    </div>
                </div>
            </div>

            <AvailabilityManager token={token} tenantSlug={user.slug || (user as any).tenantSlug || 'demo'} />

            <FamilyManager token={token} />
        </div>
    );
}
