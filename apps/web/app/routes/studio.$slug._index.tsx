// @ts-ignore
import { Link, useOutletContext } from "react-router";

export default function StudioDashboardIndex() {
    const { tenant, member, roles } = useOutletContext<any>();
    const names = member?.user?.profile?.firstName ? `${member.user.profile.firstName} ${member.user.profile.lastName || ''}` : member?.user?.email?.split('@')[0];
    const isOwner = roles.includes('owner');

    return (
        <div style={{ color: 'var(--text)' }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>Welcome back, {names}!</h2>

            {isOwner && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Quick Stats Placeholders */}
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-6 rounded-lg shadow-sm">
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Active Students</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--text)' }}>--</div>
                    </div>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-6 rounded-lg shadow-sm">
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Upcoming Classes</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--text)' }}>--</div>
                    </div>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="p-6 rounded-lg shadow-sm">
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Monthly Revenue</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--text)' }}>--</div>
                    </div>
                </div>
            )}

            <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }} className="rounded-lg p-6">
                <h3 className="font-bold mb-2" style={{ color: 'var(--text)' }}>Getting Started</h3>
                <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Your studio is ready. Quick actions:</p>
                <div className="flex flex-wrap gap-4">
                    {isOwner && (
                        <Link to="branding" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} className="px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors hover:opacity-80">
                            Customize Branding
                        </Link>
                    )}
                    {(isOwner || roles.includes('instructor')) && (
                        <Link to="schedule" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} className="px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors hover:opacity-80">
                            Manage Schedule
                        </Link>
                    )}
                    {isOwner && (
                        <Link to="memberships" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} className="px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors hover:opacity-80">
                            Setup Memberships
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
