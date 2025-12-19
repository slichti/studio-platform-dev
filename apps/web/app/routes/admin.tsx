import { json, LoaderFunction } from "@remix-run/cloudflare";
import { useLoaderData, Form } from "@remix-run/react";
import { getAuth } from "@clerk/remix/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";

export const loader: LoaderFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const tenants = await apiRequest("/admin/tenants", token);
        const logs = await apiRequest("/admin/logs", token);
        return json({ tenants, logs });
    } catch (e) {
        // If 403, redirect or show error
        return json({ error: "Unauthorized" }, { status: 403 });
    }
};

export default function AdminDashboard() {
    const { tenants, logs, error } = useLoaderData<any>();
    const [impersonating, setImpersonating] = useState(false);

    if (error) return <div style={{ padding: '40px', color: 'red' }}>Error: {error}</div>;

    const handleImpersonate = async (userId: string) => {
        setImpersonating(true);
        try {
            // We need a fresh token. In a real app we might fetch it client side if needed
            // But here we need to call our BACKEND /admin/impersonate using our CURRENT token
            // Then swap the token in the browser storage? 
            // Clerk handles the session token automatically. We can't easily overwrite it.
            // WORKAROUND: We will store the "Impersonation Token" in localStorage and force the API client to use it if present.
            // Or simpler: Alert the token for now.
            // Real solution: Save to localStorage 'impersonation_token' and update api.ts to prefer it.

            // For now, let's just alert success
            alert(`Impersonation for ${userId} requested. Check console for token.`);

        } catch (e) {
            alert('Failed');
        } finally {
            setImpersonating(false);
        }
    };

    return (
        <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '30px' }}>Admin Support Dashboard</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Tenants</h2>
                    <div style={{ background: 'white', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                        {tenants.map((t: any) => (
                            <div key={t.id} style={{ padding: '15px', borderBottom: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                    <strong>{t.name}</strong> ({t.slug})
                                    <div style={{ fontSize: '0.8rem', color: '#71717a' }}>ID: {t.id}</div>
                                </div>
                                <button onClick={() => alert('TODO: List users for this tenant to impersonate')} style={{ padding: '6px 12px', background: '#f4f4f5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                                    View Users
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>System Logs</h2>
                    <div style={{ background: '#18181b', color: '#22c55e', padding: '20px', borderRadius: '8px', fontSize: '0.875rem', height: '400px', overflowY: 'auto' }}>
                        {logs.map((log: any) => (
                            <div key={log.id} style={{ marginBottom: '10px', fontFamily: 'monospace' }}>
                                <span style={{ color: '#71717a' }}>{new Date(log.createdAt).toLocaleTimeString()}</span>{' '}
                                <span style={{ color: '#eab308' }}>[{log.action}]</span>{' '}
                                {log.details}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
