import { ActionFunction, LoaderFunction } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

export const action: ActionFunction = async (args) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const name = formData.get("name");
    const primaryColor = formData.get("primaryColor");

    // We need to update the tenant. Endpoint might be PATCH /tenant or similar.
    // Assuming apiRequest handles the header automatically if we pass it, OR we need to pass X-Tenant-Slug explicitly
    // But better: PATCH /tenant/settings

    try {
        await apiRequest("/tenant/settings", token, {
            method: "PATCH",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ name, branding: { primaryColor } })
        });
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export default function StudioSettings() {
    const { tenant } = useOutletContext<any>();
    // const actionData = useActionData(); // No longer used directly for display
    // const navigation = useNavigation(); // No longer used for isSubmitting
    // const isSubmitting = navigation.state === "submitting"; // No longer used

    const [name, setName] = useState(tenant.name || '');
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
            // This logic mimics the action function but is client-side
            const { getToken } = await getAuth({}); // getAuth needs args, but we're client-side, so an empty object might work or need a different approach
            const token = await getToken();

            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': tenant.slug }, // Assuming tenant.slug is available
                body: JSON.stringify({ name, branding: { primaryColor } })
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
