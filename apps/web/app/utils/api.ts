import { useAuth } from "@clerk/remix";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export async function apiRequest(path: string, token: string | null | undefined, options: RequestInit = {}) {
    const headers = new Headers(options.headers);

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Default to JSON
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || res.statusText);
    }

    return res.json();
}
