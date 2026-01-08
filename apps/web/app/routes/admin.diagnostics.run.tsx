import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getAuth } from "@clerk/remix/ssr.server";

export const loader = async (args: LoaderFunctionArgs) => {
    const { userId, getToken } = await getAuth(args);
    if (!userId) return json({ error: "Unauthorized" }, { status: 401 });

    const token = await getToken();
    const API_URL = args.context.env.API_URL || 'https://studio-platform-api.slichti.workers.dev';

    try {
        // 1. Get Tenant ID (Assuming system admin context or general check)
        // Since this is generic diagnostics, we might hit the endpoint directly.
        // But API often requires X-Tenant-Slug headers.
        // For general diagnostics, we'll try hitting without tenant first or assume user context is enough.
        // The API route /diagnostics might be protected by authMiddleware but not tenantMiddleware.

        const res = await fetch(`${API_URL}/diagnostics`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const text = await res.text();
            return json({ error: `API Error: ${res.status}`, details: text }, { status: res.status });
        }

        const data = await res.json();
        return json(data);

    } catch (error: any) {
        return json({ error: "Failed to fetch diagnostics", message: error.message }, 500);
    }
};
