import { useOutletContext } from "react-router";

export default function StudioDashboardIndex() {
    const { tenant, member, roles } = useOutletContext<any>();

    const isOwner = roles.includes('owner');

    return (
        <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '20px' }}>Welcome back, {member.profile?.firstName || 'User'}</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {isOwner && (
                    <div style={{ padding: '20px', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Studio Overview</h3>
                        <p>Total Revenue: $--</p>
                        <p>Active Students: --</p>
                    </div>
                )}

                <div style={{ padding: '20px', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Upcoming Classes</h3>
                    <p>You have no upcoming classes booked.</p>
                </div>
            </div>
        </div>
    );
}
