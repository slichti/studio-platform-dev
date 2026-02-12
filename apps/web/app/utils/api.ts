import { useAuth } from "@clerk/react-router";

const DEFAULT_API_URL = "http://localhost:8788";
const PROD_API_URL = "https://studio-platform-api.slichti.workers.dev"; // Fallback for production

export const API_URL = (() => {
    // 1. Explicit Env Var (Build Time)
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.length > 0) {
        return envUrl;
    }

    // 2. Client-side Detection (Runtime)
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        // If we are NOT on localhost, assume production URL
        if (!hostname.includes("localhost") && !hostname.includes("127.0.0.1")) {
            return PROD_API_URL;
        }
    }

    // 3. Server-side Production Fallback (Cloudflare Pages Functions)
    if (import.meta.env.PROD) {
        return PROD_API_URL;
    }

    // 4. Fallback to Localhost (Dev)
    return DEFAULT_API_URL;
})();

export async function apiRequest<T = any>(path: string, token: string | null | undefined, options: Omit<RequestInit, 'headers'> & { headers?: Record<string, string | undefined> | HeadersInit } = {}, baseUrl?: string): Promise<T> {
    const url = baseUrl || API_URL;

    // Sanitize headers to remove undefined values
    const safeHeaders: HeadersInit = {};
    if (options.headers) {
        if (options.headers instanceof Headers || Array.isArray(options.headers)) {
            // Already safe or iterable
            // converting to Headers object to merge
            (options.headers as any).forEach((v: string, k: string) => (safeHeaders as any)[k] = v);
        } else {
            Object.entries(options.headers).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    (safeHeaders as any)[k] = String(v);
                }
            });
        }
    }

    const headers = new Headers(safeHeaders);

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Client-side Impersonation Override
    if (typeof window !== "undefined") {
        const impersonationToken = localStorage.getItem("impersonation_token");
        if (impersonationToken) {
            headers.set("Authorization", `Bearer ${impersonationToken}`);
        }
    }

    // Default to JSON unless FormData
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    // Trace ID
    if (!headers.has("x-request-id")) {
        headers.set("x-request-id", crypto.randomUUID());
    }

    const fullUrl = `${url}${path}`;
    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`, { headers: Object.fromEntries(headers.entries()) });

    const res = await fetch(fullUrl, {
        ...options,
        headers
    });

    if (!res.ok) {
        let errorData;
        try {
            // Clone the response to avoid consuming the body if JSON parsing fails
            errorData = await res.clone().json();
            const serverError = (errorData as any).error || res.statusText;
            const serverPath = (errorData as any).path ? ` (${(errorData as any).path})` : '';
            const error = new Error(`${serverError}${serverPath}`);
            (error as any).data = errorData;
            (error as any).status = res.status;
            throw error;
        } catch (e) {
            // If it was our wrapper error, rethrow
            if ((e as any).data) throw e;

            // Otherwise, it was likely a JSON parse error or non-JSON error response
            // We can safely read the original body as text now
            const errorText = await res.text();
            throw new Error(errorText || res.statusText);
        }
    }

    return res.json();
}
