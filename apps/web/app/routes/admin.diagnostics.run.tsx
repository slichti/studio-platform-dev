// @ts-ignore
import { type LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";

export const loader = async (args: LoaderFunctionArgs) => {
    const { userId, getToken } = await getAuth(args);
    if (!userId) return { error: "Unauthorized", status: 401 };

    const token = await getToken();
    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const API_URL = env.VITE_API_URL || env.API_URL || 'https://studio-platform-api.slichti.workers.dev';
    const traceId = args.request.headers.get("x-request-id") || crypto.randomUUID();

    try {
        // 1. Get Tenant ID (Assuming system admin context or general check)
        // Since this is generic diagnostics, we might hit the endpoint directly.
        // But API often requires X-Tenant-Slug headers.
        // For general diagnostics, we'll try hitting without tenant first or assume user context is enough.
        // The API route /diagnostics might be protected by authMiddleware but not tenantMiddleware.

        const res = await fetch(`${API_URL}/diagnostics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-request-id': traceId
            }
        });

        if (!res.ok) {
            const text = await res.text();
            return { error: `API Error: ${res.status}`, details: text, status: res.status };
        }

        const data = await res.json();
        return data;

    } catch (error: any) {
        return { error: "Failed to fetch diagnostics", message: error.message, status: 500 };
    }
};
