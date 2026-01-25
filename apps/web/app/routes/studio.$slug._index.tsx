// @ts-ignore
import { useLoaderData, useOutletContext, Link } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useUser } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { Users, Calendar, DollarSign, ArrowRight, Activity, TrendingUp, FileSignature, Ticket, Award, Target, Flame } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    // [E2E BYPASS] Skip Clerk for E2E tests
    let token: string | null = null;
    const cookie = args.request.headers.get("Cookie");
    if (cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) token = match[1];
    }

    // Only call getAuth if we didn't bypass
    if (!token) {
        const { getToken } = await getAuth(args);
        token = await getToken();
    }

    const { slug } = args.params;

    try {
        const [stats, myProgress] = await Promise.all([
            apiRequest(`/tenant/stats`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => ({ activeStudents: 0 })),
            apiRequest(`/challenges/my-progress`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => [])
        ]);
        return { stats, myProgress };
    } catch (e) {
        console.error("Dashboard loader failed:", e);
        return { stats: { activeStudents: 0, upcomingBookings: 0, monthlyRevenueCents: 0 }, myProgress: [] };
    }
}

export default function StudioDashboardIndex() {
    const { tenant, roles, me, isStudentView } = useOutletContext<any>();
    const { stats } = useLoaderData<typeof loader>();
    const { user: clerkUser } = useUser();
    const isOwner = roles.includes('owner');

    // Get display name: prefer Clerk's logged-in user name (for impersonation), fallback to API name
    const displayName = clerkUser?.firstName || me?.firstName || 'Studio Admin';

    // Compute role label for impersonation/student view indicator
    const getRoleLabel = () => {
        const isPlatformAdmin = (me as any)?.user?.isPlatformAdmin;
        let baseRole = '';
        if (isPlatformAdmin) baseRole = 'Admin';
        else if (me?.roles?.includes('owner')) baseRole = 'Owner';
        else if (me?.roles?.includes('admin')) baseRole = 'Manager';
        else if (me?.roles?.includes('instructor')) baseRole = 'Instructor';

        // Show "(Admin/Owner)" suffix when viewing as different role
        if (isStudentView && baseRole) return ` (${baseRole})`;
        return '';
    };

    return (
        <div className="max-w-6xl pb-10 p-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        Welcome back, {displayName}{getRoleLabel()}!
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Here's what's happening at {tenant.name} today.</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                    <Activity size={16} />
                    <span>System Online</span>
                </div>
            </div>

            {isOwner && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded">Students</span>
                        </div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{stats.activeStudents}</div>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                            <TrendingUp size={12} className="text-emerald-500" />
                            <span>Active this month</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Calendar size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded">Bookings</span>
                        </div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{stats.upcomingBookings}</div>
                        <div className="text-xs text-zinc-500 mt-1">Confirmed upcoming sessions</div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group border-b-4 border-b-emerald-500 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                                <DollarSign size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded">Gross Sales</span>
                        </div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 relative z-10">
                            ${(stats.monthlyRevenueCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 italic relative z-10">Current billing period</div>

                        <div className="absolute top-4 right-4 text-emerald-100/20 z-0">
                            <DollarSign size={100} />
                        </div>
                    </div>

                    {/* Waiver Compliance */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                                <FileSignature size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded">Compliance</span>
                        </div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                            {stats.waiverCompliance ? Math.round((stats.waiverCompliance.signed / (stats.waiverCompliance.total || 1)) * 100) : 0}%
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                            {stats.waiverCompliance?.activeWaiver ? (
                                <span className="text-emerald-600">Active Waiver Enforcement</span>
                            ) : (
                                <span className="text-amber-600">No Active Waiver</span>
                            )}
                        </div>
                    </div>

                    {/* Gift Card Liability */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Ticket size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded">GC Liability</span>
                        </div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                            ${((stats.giftCardLiability || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Outstanding Store Credit</div>
                    </div>
                </div>

            )}

            {/* Dashboard Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8">
                    {!isStudentView ? (
                        <>
                            <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Getting Started</h2>
                            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Your studio is live! Use these shortcuts to manage your operations.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {isOwner && (
                                    <DashboardAction
                                        to="branding"
                                        title="Customize Branding"
                                        description="Update your colors, logo and style."
                                    />
                                )}
                                <DashboardAction
                                    to="schedule"
                                    title="Manage Schedule"
                                    description="Add classes and view bookings."
                                />
                                {isOwner && (
                                    <DashboardAction
                                        to="memberships"
                                        title="Setup Memberships"
                                        description="Create recurring revenue plans."
                                    />
                                )}
                                <DashboardAction
                                    to="students"
                                    title="Add Students"
                                    description="Grow your community today."
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Award className="text-yellow-500" />
                                Your Achievements
                            </h3>
                            {/* Student Achievements Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {((useLoaderData() as any).myProgress || []).map((challenge: any) => (
                                    <div key={challenge.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 shrink-0">
                                            {challenge.userProgress.status === 'completed' ? <Award size={24} /> : <Target size={24} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{challenge.title}</h4>
                                                {challenge.userProgress.status === 'completed' && (
                                                    <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">EARNED</span>
                                                )}
                                            </div>
                                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 mb-1">
                                                <div
                                                    className="bg-yellow-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, (challenge.userProgress.progress / challenge.targetValue) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="text-xs text-zinc-500 flex justify-between">
                                                {challenge.type === 'streak' ? (
                                                    <span className="flex items-center gap-1 font-medium text-amber-600">
                                                        <Flame size={12} className={challenge.userProgress.status === 'completed' ? "" : "animate-pulse"} />
                                                        {challenge.userProgress.progress} / {challenge.targetValue} {challenge.period || 'streak'}s
                                                    </span>
                                                ) : (
                                                    <span>{challenge.userProgress.progress} / {challenge.targetValue} {challenge.type === 'minutes' ? 'mins' : 'classes'}</span>
                                                )}
                                                <span>{Math.round((challenge.userProgress.progress / challenge.targetValue) * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!((useLoaderData() as any).myProgress) || (useLoaderData() as any).myProgress.length === 0) && (
                                    <div className="col-span-2 text-center py-4 text-zinc-500 dark:text-zinc-400 text-sm italic">
                                        Join active challenges to earn rewards!
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                    {isStudentView ? (
                        <>
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                <Activity size={18} className="text-blue-500" />
                                Announcements & Updates
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">New</span>
                                        <span className="text-[10px] text-zinc-400">Today</span>
                                    </div>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Summer schedule is live! Check out our new morning flow classes.</p>
                                </div>

                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 flex items-center gap-2 text-sm">
                                    <Flame size={16} className="text-orange-500" />
                                    Quick Discounts
                                </h3>
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-orange-700 dark:text-orange-400">3 Spots Left!</span>
                                        <span className="text-[10px] bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-1.5 py-0.5 rounded">20% OFF</span>
                                    </div>
                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Power Yoga @ 6:00 PM</p>
                                    <Link to="classes" className="text-xs text-blue-600 hover:underline mt-1 block">Book Now &rarr;</Link>
                                </div>
                            </div>
                        </>

                    ) : (
                        <>
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                <Activity size={18} className="text-blue-500" />
                                Quick Tips
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                                    <strong>Did you know?</strong> You can now use the <Link to="pos" className="text-blue-600 font-bold hover:underline">POS System</Link> to sell drinks and gear directly at your front desk.
                                </div>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                                    Enable <Link to="settings" className="text-blue-600 font-bold hover:underline">SMS Notifications</Link> to reduce no-shows by up to 30%.
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div >
        </div>
    );
}

function DashboardAction({ to, title, description }: { to: string, title: string, description: string }) {
    return (
        <Link
            to={to}
            className="group flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:translate-y-[-2px] shadow-sm"
        >
            <div className="flex-1 min-w-0">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-blue-600 transition-colors">{title}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{description}</div>
            </div>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-blue-500 transition-colors" />
        </Link>
    );
}
