// import { useAuth } from "@clerk/react-router";

const DEFAULT_API_URL = "http://localhost:8787";

export async function apiRequest(path: string, token: string | null | undefined, options: RequestInit = {}, baseUrl?: string) {
    const url = baseUrl || import.meta.env.VITE_API_URL || DEFAULT_API_URL;
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
        const error = await res.text();
        throw new Error(error || res.statusText);
    }

    return res.json();
}
