import { AuthStore } from "./auth";

// Replace with your local IP if testing on device, or localhost for simulator
export const API_URL = 'https://studio-platform-api.slichti.workers.dev';
// export const API_URL = 'http://localhost:8787'; // Local Verification

export async function apiRequest(path: string, options: RequestInit = {}) {
    const token = await AuthStore.getToken();
    const headers: any = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Tenant Context
    const tenantSlug = await AuthStore.getTenantSlug();
    if (tenantSlug) {
        headers['X-Tenant-Slug'] = tenantSlug;
    }

    try {
        const res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            let errorMsg = text;
            try {
                const json = JSON.parse(text);
                errorMsg = json.error || text;
            } catch (e) {
                // ignore json parse error
            }
            throw new Error(errorMsg || `API Error: ${res.status}`);
        }

        // Return JSON if contentType is json
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await res.json();
        }
        return await res.text();

    } catch (e: any) {
        console.error(`API Request Failed: ${path}`, e);
        throw e;
    }
}
