// @ts-ignore
import { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, redirect, Link, Outlet, useLocation } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Calendar, Clock, Users, DollarSign, Repeat, Home, Settings } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const [statsData, upcomingData] = await Promise.all([
            apiRequest('/instructor/stats', token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/instructor/upcoming', token, { headers: { 'X-Tenant-Slug': slug } })
        ]) as any[];

        return {
            stats: statsData || {},
            upcoming: upcomingData || [],
            slug
        };
    } catch (e) {
        console.error("Instructor Loader Error", e);
        return { stats: {}, upcoming: [], slug };
    }
};

export default function InstructorPortal() {
    const { stats, upcoming, slug } = useLoaderData<typeof loader>();
    const location = useLocation();
    const isIndex = location.pathname.endsWith('/instructor') || location.pathname.endsWith('/instructor/');

    const navItems = [
        { href: `/studio/${slug}/instructor`, label: 'Dashboard', icon: Home },
        { href: `/studio/${slug}/instructor/schedule`, label: 'My Schedule', icon: Calendar },
        { href: `/studio/${slug}/instructor/availability`, label: 'Availability', icon: Clock },
        { href: `/studio/${slug}/instructor/subs`, label: 'Sub Requests', icon: Repeat },
        { href: `/studio/${slug}/instructor/payroll`, label: 'Earnings', icon: DollarSign },
    ];

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return (
        <div className="flex h-full bg-zinc-50">
            {/* Sidebar */}
            <nav className="w-64 bg-white border-r border-zinc-200 p-4">
                <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="p-2 bg-purple-600 rounded-lg text-white"><Users size={20} /></div>
                    <span className="font-bold text-zinc-900">Instructor Portal</span>
                </div>
                <div className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-purple-50 text-purple-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {isIndex ? (
                    /* Dashboard */
                    <div className="p-6">
                        <h1 className="text-2xl font-bold text-zinc-900 mb-6">Welcome back!</h1>

                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <StatCard icon={Calendar} label="Classes This Week" value={stats.classesThisWeek || 0} />
                            <StatCard icon={Users} label="Total Students" value={stats.totalStudents || 0} />
                            <StatCard icon={DollarSign} label="Earnings (MTD)" value={`$${((stats.earningsMtd || 0) / 100).toFixed(2)}`} />
                            <StatCard icon={Repeat} label="Open Sub Requests" value={stats.openSubRequests || 0} />
                        </div>

                        {/* Upcoming Classes */}
                        <div className="bg-white rounded-xl border border-zinc-200">
                            <div className="p-4 border-b border-zinc-100">
                                <h2 className="font-bold text-zinc-900 flex items-center gap-2"><Clock size={18} /> Upcoming Classes</h2>
                            </div>
                            {upcoming.length === 0 ? (
                                <p className="p-6 text-center text-zinc-500">No upcoming classes</p>
                            ) : (
                                <div className="divide-y divide-zinc-100">
                                    {upcoming.slice(0, 5).map((cls: any) => (
                                        <div key={cls.id} className="p-4 flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-zinc-900">{cls.title}</div>
                                                <div className="text-sm text-zinc-500">
                                                    {formatDate(cls.startTime)} at {formatTime(cls.startTime)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                                <Users size={14} /> {cls.confirmedCount || 0} booked
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <Outlet />
                )}
            </main>
        </div>
    );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
    return (
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600"><Icon size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{value}</div>
            <div className="text-xs text-zinc-500">{label}</div>
        </div>
    );
}
