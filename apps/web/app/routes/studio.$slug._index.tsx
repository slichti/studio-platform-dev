import { Link, useOutletContext } from "react-router";

export default function StudioDashboardIndex() {
    const { tenant, member, roles } = useOutletContext<any>();
    const names = member?.user?.profile?.firstName ? `${member.user.profile.firstName} ${member.user.profile.lastName || ''}` : member?.user?.email?.split('@')[0];
    const isOwner = roles.includes('owner');

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Welcome back, {names}!</h2>

            {isOwner && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Quick Stats Placeholders */}
                    <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                        <div className="text-sm font-medium text-zinc-500 mb-1">Active Students</div>
                        <div className="text-3xl font-bold text-zinc-900">--</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                        <div className="text-sm font-medium text-zinc-500 mb-1">Upcoming Classes</div>
                        <div className="text-3xl font-bold text-zinc-900">--</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                        <div className="text-sm font-medium text-zinc-500 mb-1">Monthly Revenue</div>
                        <div className="text-3xl font-bold text-zinc-900">--</div>
                    </div>
                </div>
            )}

            <div className="bg-zinc-50 rounded-lg p-6 border border-zinc-200">
                <h3 className="font-bold text-zinc-900 mb-2">Getting Started</h3>
                <p className="text-zinc-600 mb-4 text-sm">Your studio is ready. Quick actions:</p>
                <div className="flex flex-wrap gap-4">
                    {isOwner && (
                        <Link to="settings" className="px-4 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors">
                            Customize Branding
                        </Link>
                    )}
                    {(isOwner || roles.includes('instructor')) && (
                        <Link to="schedule" className="px-4 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors">
                            Manage Schedule
                        </Link>
                    )}
                    {isOwner && (
                        <Link to="memberships" className="px-4 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors">
                            Setup Memberships
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
