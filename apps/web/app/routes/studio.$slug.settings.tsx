import { useState } from "react";
// @ts-ignore
import { useOutletContext } from "react-router";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/ssr.server";

export default function StudioSettings() {
    const { tenant } = useOutletContext<any>();

    const [name, setName] = useState(tenant.name || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Client side fetch
            const token = await (window as any).Clerk?.session?.getToken();

            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ name })
            });
            setSuccess("Settings saved successfully.");
        } catch (e: any) {
            setError(e.message || "Failed to save settings.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>Studio Settings</h1>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            Studio Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ width: '100%', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                            placeholder="Enter studio name"
                        />
                    </div>

                    <div style={{ paddingTop: '10px' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                background: 'var(--accent)',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '6px',
                                border: 'none',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
