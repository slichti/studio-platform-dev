
import { useState } from "react";
import { useOutletContext, Form } from "react-router";
import { apiRequest } from "../utils/api";

export default function StudioBranding() {
    const { tenant } = useOutletContext<any>();
    const [primaryColor, setPrimaryColor] = useState(tenant.branding?.primaryColor || '#4f46e5');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();

            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ branding: { primaryColor } })
            });
            setSuccess("Branding saved successfully.");
        } catch (e: any) {
            setError(e.message || "Failed to save branding.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>Customize Branding</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage your studio's look and feel.</p>
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
                            Primary Brand Color
                        </label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }}
                            />
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', fontSize: '0.95rem', fontFamily: 'monospace', outline: 'none' }}
                                placeholder="#000000"
                            />
                        </div>
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
