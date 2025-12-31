// @ts-ignore
import { Link, useOutletContext } from "react-router";

export default function StudioDashboardIndex() {
    const { tenant, member, roles } = useOutletContext<any>();
    const names = member?.user?.profile?.firstName ? `${member.user.profile.firstName} ${member.user.profile.lastName || ''}` : member?.user?.email?.split('@')[0];
    const isOwner = roles.includes('owner');

    return (
        <div className="max-w-6xl pb-10">
            <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">Welcome back, {names}!</h2>

            {isOwner && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Quick Stats Placeholders */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                        <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Active Students</div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">--</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                        <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Upcoming Classes</div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">--</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-sm">
                        <div className="text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Monthly Revenue</div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">--</div>
                    </div>
                </div>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <h3 className="font-bold mb-2 text-zinc-900 dark:text-zinc-100">Getting Started</h3>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Your studio is ready. Quick actions:</p>
                <div className="flex flex-wrap gap-4">
                    {isOwner && (
                        <Link to="branding" className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700">
                            Customize Branding
                        </Link>
                    )}
                    {(isOwner || roles.includes('instructor')) && (
                        <Link to="schedule" className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700">
                            Manage Schedule
                        </Link>
                    )}
                    {isOwner && (
                        <Link to="memberships" className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700">
                            Setup Memberships
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
