import { useAuth } from "@clerk/react-router";

const DEFAULT_API_URL = "http://localhost:8787";
export const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export async function apiRequest(path: string, token: string | null | undefined, options: RequestInit = {}, baseUrl?: string) {
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

    const res = await fetch(`${url}${path}`, {
        ...options,
        headers
    });

    if (!res.ok) {
        let errorData;
        try {
            // Clone the response to avoid consuming the body if JSON parsing fails
            errorData = await res.clone().json();
            const error = new Error(errorData.error || res.statusText);
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
