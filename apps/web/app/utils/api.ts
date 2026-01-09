import { useAuth } from "@clerk/react-router";

const DEFAULT_API_URL = "http://localhost:8787";
const PROD_API_URL = "https://studio-platform-api.slichti.workers.dev"; // Fallback for production

export const API_URL = (() => {
    // If explicitly set via build-time env var, use it
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

    // Client-side detection: If on production domain but no Env Var, use Prod API
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
        return PROD_API_URL;
    }

    return DEFAULT_API_URL;
})();

export async function apiRequest<T = any>(path: string, token: string | null | undefined, options: RequestInit = {}, baseUrl?: string): Promise<T> {
    const url = baseUrl || API_URL;
    const headers = new Headers(options.headers);

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

    // Default to JSON
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    // Trace ID
    if (!headers.has("x-request-id")) {
        headers.set("x-request-id", crypto.randomUUID());
    }

    const res = await fetch(`${url}${path}`, {
        ...options,
        headers
    });

    if (!res.ok) {
        let errorData;
        try {
            // Clone the response to avoid consuming the body if JSON parsing fails
            errorData = await res.clone().json();
            const error = new Error((errorData as any).error || res.statusText);
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
