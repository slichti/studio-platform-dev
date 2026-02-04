
import { Link, useRouteLoaderData } from "react-router";
import { Plus, Building2, ShieldCheck, Search } from "lucide-react";

export default function DashboardIndex() {
    // Get data from parent layout loader
    const data = useRouteLoaderData("routes/dashboard") as { isPlatformAdmin: boolean; tenants: any[]; userProfile: any } | undefined;

    const isPlatformAdmin = data?.isPlatformAdmin || false;
    const tenants = data?.tenants || [];
    const user = data?.userProfile;

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="mb-10">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                    Manage your studios, memberships, and classes from one place.
                </p>
            </div>

            {/* Quick Actions / Platform Admin */}
            {isPlatformAdmin && (
                <div className="mb-12">
                    <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
                        Platform Administration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Link to="/admin" className="group block p-6 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-zinc-900 border border-purple-100 dark:border-purple-800/50 rounded-xl shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-300">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">Admin Portal</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage tenants, users, and platform settings.</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            )}

            {/* My Studios */}
            <div className="mb-12">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        My Studios
                    </h3>
                    <Link to="/create-studio" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                        <Plus className="w-4 h-4" />
                        Create new Studio
                    </Link>
                </div>

                {tenants.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tenants.map((tenant: any) => (
                            <Link
                                key={tenant.id}
                                to={`/studio/${tenant.slug}/dashboard`}
                                className="group block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                            >
                                <div className="h-32 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                                    {/* Simple pattern or branding image if available */}
                                    {tenant.branding?.logoUrl ? (
                                        <img src={tenant.branding.logoUrl} alt={tenant.name} className="h-16 w-16 object-contain" />
                                    ) : (
                                        <Building2 className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                                    )}

                                    {/* Role Badge */}
                                    <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded text-xs font-medium text-zinc-600 dark:text-zinc-300 capitalize shadow-sm border border-zinc-200 dark:border-zinc-700">
                                        {tenant.roles.join(', ')}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h4 className="font-bold text-zinc-900 dark:text-zinc-50 text-lg mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {tenant.name}
                                    </h4>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                                        {tenant.slug}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                        <Building2 className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No studios yet</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1 mb-6 max-w-sm mx-auto">
                            You haven't joined or created any studios yet. Get started by creating your own or finding one to join.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link
                                to="/create-studio"
                                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                            >
                                Create Studio
                            </Link>
                            {/* Potential future feature: Discovery/Search */}
                            <button disabled className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md text-sm font-medium opacity-50 cursor-not-allowed">
                                Find a Studio
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
