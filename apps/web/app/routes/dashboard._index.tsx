export default function DashboardIndex() {
    return (
        <div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '20px' }}>Welcome back!</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e4e4e7' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'semibold', marginBottom: '10px' }}>Quick Stats</h3>
                    <p style={{ color: '#71717a' }}>No classes scheduled yet.</p>
                </div>
            </div>
        </div>
    );
}
