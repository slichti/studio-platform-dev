import { Outlet, useLoaderData, useParams, NavLink, redirect, Link, useSearchParams } from "react-router";

import type { LoaderFunctionArgs } from "react-router";
import { useState, useEffect } from "react"; // Added useState
import { getAuth } from "@clerk/react-router/server";
import { apiRequest, API_URL } from "../utils/api";
import { UserButton } from "@clerk/react-router";
import { PoweredBy } from "../components/PoweredBy";
import {
    LayoutDashboard,
    Calendar,
    User,
    Users,
    TrendingUp,
    Settings,
    CreditCard,
    Dumbbell,
    DollarSign,
    FileSignature,
    AlertTriangle,
    Package,
    RefreshCw,
    Tag,
    Clock,
    Mail,
    ShoppingCart,
    CheckCircle2,
    Ticket,
    ListTodo,
    BarChart3,
    Search,
    Globe,
    Award,
    Code,
    Terminal,
    Film,
    Image as ImageIcon,
    Database,
    Smartphone,
    MessageSquare,
    CircleHelp,
    QrCode,
    Trophy,
    History,
    Shield,
    Activity,
    Filter
} from "lucide-react";
const CommandBar = lazy(() => import("../components/CommandBar").then(m => ({ default: m.CommandBar })));
const ChatWidget = lazy(() => import("../components/chat/ChatWidget").then(m => ({ default: m.ChatWidget })));
const QuickStartModal = lazy(() => import("../components/onboarding/QuickStartModal").then(m => ({ default: m.QuickStartModal })));
const ImpersonationBanner = lazy(() => import("../components/ImpersonationBanner").then(m => ({ default: m.ImpersonationBanner })));

import { ThemeToggle } from "../components/ThemeToggle";
import { SidebarGroup } from "../components/SidebarGroup";
import { useClerk, useUser } from "@clerk/react-router";
import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params, request } = args;
    const url = request.url;

    // [E2E BYPASS] Allow impersonation/bypass for testing
    let userId: string | null = null;
    let token: string | null = null;
    let getToken: (() => Promise<string | null>) | null = null;

    const cookie = request.headers.get("Cookie");

    // [SECURITY CRITICAL] ONLY allow bypass in Development/Test environments
    // This prevents production exploitation of the bypass cookie

    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) {
            userId = match[1];
            token = userId; // [CRITICAL] Set token for API bypass
            console.warn(`[SECURITY WARNING] E2E Bypass Active for User: ${userId}`);
        }
    }

    // Only call getAuth if we didn't bypass
    if (!userId) {
        const authResult = await getAuth(args);
        userId = authResult.userId;
        getToken = authResult.getToken;
    }

    if (!userId) {
        return redirect(`/sign-in?redirect_url=${request.url}`);
    }

    const { slug } = params;
    if (!slug) return redirect("/");

    if (!token && getToken) token = await getToken();

    // Check for server-side impersonation (Cookie)
    const cookieHeader = request.headers.get("Cookie");
    let isImpersonating = false;
    if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|; )__impersonate_token=([^;]*)/);
        if (match && match[1]) {
            token = match[1];
            isImpersonating = true;
        }
    }

    try {
        const [tenantInfo, me] = await Promise.all([
            apiRequest(`/tenant/info`, token, { headers: { 'X-Tenant-Slug': slug } }) as Promise<any>,
            apiRequest(`/tenant/me`, token, { headers: { 'X-Tenant-Slug': slug } })
        ]);

        // Fetch My Role in this specific tenant
        if (tenantInfo.error) {
            console.error("Studio layout loader: Tenant fetch error", tenantInfo.error);
            const msg = typeof tenantInfo.error === 'string' ? tenantInfo.error : JSON.stringify(tenantInfo.error);
            throw new Response(`Studio Not Found: ${msg}`, { status: 404 });
        }

        // Role-based Redirect
        // If user is ONLY a student (not owner/admin/instructor/platform_admin) and NOT impersonating
        // Redirect to /portal/:slug
        const hasAdminRole = me.roles.some((r: string) => ['owner', 'admin', 'instructor'].includes(r));
        const isPlatformAdmin = me.user?.isPlatformAdmin;

        if (!hasAdminRole && !isPlatformAdmin && !isImpersonating && !url.includes('/join')) { // Allow join/public pages if any
            return redirect(`/portal/${slug}`);
        }

        // Onboarding Enforcement
        // Only for owners/admins who have an explicit onboarding step < 4
        // Legacy tenants with undefined onboardingStep are skipped (assumed complete)
        const onboardingStep = tenantInfo.settings?.onboardingStep;
        if (
            (me.roles.includes('owner') || me.roles.includes('admin')) &&
            onboardingStep &&
            onboardingStep < 4 &&
            !url.includes('/onboarding')
        ) {
            return redirect(`/studio/${slug}/onboarding`);
        }

        return {
            slug: params.slug,
            tenant: tenantInfo,
            me,
            token,
            isPaused: tenantInfo.status === 'paused',
            isImpersonating,
            features: tenantInfo.features || []
        };
    } catch (e: any) {
        if (e instanceof Response) throw e;

        console.error("Studio layout loader failed:", e);
        const details = (e as any).data || e.message;
        throw new Response(`Studio Not Found/Access Denied: ${JSON.stringify(details)}`, { status: 404 });
    }
};

export default function StudioLayout() {
    const { slug } = useParams();

    const { tenant, me, features, isPaused, token, isImpersonating } = useLoaderData<typeof loader>();
    const { user: clerkUser } = useUser();
    const featureSet = new Set(features);

    // Name Display Logic
    const dbName = `${me.firstName || ''} ${me.lastName || ''}`.trim();
    // If DB name is just "User" or empty, try Clerk name, otherwise fallback to DB (or 'Member')
    const displayName = (dbName && dbName !== 'User') ? dbName : (clerkUser?.fullName || dbName || 'Member');

    // Student View State
    const [isStudentView, setIsStudentView] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('studio_student_view') === 'true') {
            setIsStudentView(true);
        }
    }, []);

    const toggleStudentView = () => {
        const newState = !isStudentView;
        setIsStudentView(newState);
        localStorage.setItem('studio_student_view', String(newState));
    };

    // Auto-Apply Coupon Logic
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const coupon = searchParams.get('coupon');
        if (coupon) {
            sessionStorage.setItem('pending_coupon', coupon.toUpperCase());
            // Clear param from URL to accept it gracefully
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('coupon');
            setSearchParams(newParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Effective Roles: If in student view, force role to just 'student'
    const effectiveRoles = isStudentView ? ['student'] : (me?.roles || []);
    // Also override 'me' slightly to reflect restricted permissions if needed downstream
    // But 'roles' is the main gatekeeper for the Sidebar and children.

    // Quick Start State
    const [showQuickStart, setShowQuickStart] = useState(() => {
        const isOwnerOrAdmin = me?.roles?.includes('owner') || me?.roles?.includes('admin');
        const isCompleted = tenant.settings?.onboardingCompleted;
        return isOwnerOrAdmin && !isCompleted && slug !== 'platform';
    });

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            {/* Quick Start Wizard */}
            {!isStudentView && showQuickStart && (
                <Suspense fallback={null}>
                    <ClientOnly>
                        <QuickStartModal
                            isOpen={showQuickStart}
                            onClose={() => setShowQuickStart(false)}
                            tenant={tenant}
                            token={token || ''}
                        />
                    </ClientOnly>
                </Suspense>
            )}

            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed inset-y-0 z-20 transition-colors duration-300">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <Link to={`/studio/${slug}`} prefetch="intent" className="flex items-center gap-2 group">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform overflow-hidden bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
                        >
                            {tenant.branding?.logoUrl ? (
                                <img src={tenant.branding.logoUrl} alt={tenant.name} className="w-full h-full object-contain" />
                            ) : (
                                <div
                                    className="w-full h-full flex items-center justify-center text-white font-bold"
                                    style={{ backgroundColor: tenant.branding?.primaryColor || '#2563eb' }}
                                >
                                    {tenant.name.substring(0, 1)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight text-zinc-900 dark:text-zinc-100">{tenant.name}</span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">/studio/{slug}</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 overflow-auto p-4 space-y-4">
                    <div className="space-y-1">
                        <NavItem to={`/studio/${slug}`} end icon={<LayoutDashboard size={18} />}>Dashboard</NavItem>
                    </div>

                    <SidebarGroup title="Operations">
                        <NavItem to={`/studio/${slug}/schedule`} icon={<Calendar size={18} />}>Schedule</NavItem>
                        <NavItem to={`/studio/${slug}/classes`} icon={<Dumbbell size={18} />}>Classes</NavItem>
                        <NavItem to={`/studio/${slug}/appointments`} icon={<Clock size={18} />}>Appointments</NavItem>
                        <NavItem to={`/studio/${slug}/checkin`} icon={<CheckCircle2 size={18} />}>
                            {isStudentView ? "Attendance History" : "Check-in"}
                        </NavItem>
                        <NavItem to={`/studio/${slug}/challenges`} icon={<Trophy size={18} />}>Challenges</NavItem>
                        {featureSet.has('progress_tracking') && (
                            <NavItem to={`/studio/${slug}/progress`} icon={<Activity size={18} />}>My Progress</NavItem>
                        )}
                        {/* Only show Substitutions to Instructors/Admins */}
                        {!isStudentView && (
                            <NavItem to={`/studio/${slug}/substitutions`} icon={<RefreshCw size={18} />}>Substitutions</NavItem>
                        )}
                        <NavItem to={`/studio/${slug}/waivers`} icon={<FileSignature size={18} />}>Waivers</NavItem>
                        {featureSet.has('vod') && (
                            <NavItem to={`/studio/${slug}/videos`} icon={<ImageIcon size={18} />}>Media Library</NavItem>
                        )}
                    </SidebarGroup>

                    <SidebarGroup title="Commerce">
                        {(featureSet.has('pos')) && !isStudentView && (
                            <>
                                <NavItem to={`/studio/${slug}/pos`} end icon={<ShoppingCart size={18} />}>POS & Retail</NavItem>
                                {featureSet.has('inventory') && (
                                    <NavItem to={`/studio/${slug}/inventory`} icon={<Package size={18} />}>Inventory</NavItem>
                                )}
                            </>
                        )}
                        <NavItem to={`/studio/${slug}/memberships`} icon={<CreditCard size={18} />}>Memberships</NavItem>
                        <NavItem to={`/studio/${slug}/commerce/packs`} icon={<Package size={18} />}>Class Packs</NavItem>
                        <NavItem to={`/studio/${slug}/commerce/gift-cards`} icon={<Ticket size={18} />}>Gift Cards</NavItem>
                    </SidebarGroup>

                    {/* HIDE CRM and Management when in Student View */}
                    {!isStudentView && (
                        <>

                            <SidebarGroup title="Marketing">
                                {(featureSet.has('marketing')) && (
                                    <NavItem to={`/studio/${slug}/marketing`} icon={<Mail size={18} />}>Email Automations</NavItem>
                                )}
                                {(featureSet.has('marketing') || featureSet.has('pos')) && (
                                    <>
                                        <NavItem to={`/studio/${slug}/commerce/coupons`} icon={<Ticket size={18} />}>
                                            {isStudentView ? "My Coupons" : "Coupons"}
                                        </NavItem>
                                        <NavItem to={`/studio/${slug}/commerce/referrals`} icon={<Award size={18} />}>Refer & Earn</NavItem>
                                    </>
                                )}
                            </SidebarGroup>

                            <SidebarGroup title="CRM">
                                <NavItem to={`/studio/${slug}/leads`} icon={<User size={18} />}>Leads</NavItem>
                                <NavItem to={`/studio/${slug}/tasks`} icon={<ListTodo size={18} />}>Tasks</NavItem>
                                {(featureSet.has('loyalty')) && (
                                    <NavItem to={`/studio/${slug}/loyalty`} icon={<Award size={18} />}>Loyalty</NavItem>
                                )}
                            </SidebarGroup>

                            <SidebarGroup title="Online Presence">
                                {featureSet.has('website_builder') && (
                                    <NavItem to={`/studio/${slug}/website/pages`} icon={<Globe size={18} />}>Website Builder</NavItem>
                                )}
                                <NavItem to={`/studio/${slug}/settings/embeds`} icon={<Code size={18} />}>Website Widgets</NavItem>
                                {featureSet.has('mobile_app') && (
                                    <NavItem to={`/studio/${slug}/settings/mobile`} icon={<Smartphone size={18} />}>Mobile App</NavItem>
                                )}
                                <NavItem to={`/studio/${slug}/settings/qr`} icon={<QrCode size={18} />}>QR Codes</NavItem>
                            </SidebarGroup>

                            <SidebarGroup title="Management">
                                <NavItem to={`/studio/${slug}/students`} icon={<Users size={18} />}>People</NavItem>
                                {(['scale'].includes(tenant.tier) || featureSet.has('payroll')) && (
                                    <NavItem to={`/studio/${slug}/financials/payroll`} icon={<CreditCard size={18} />}>Payroll Admin</NavItem>
                                )}
                                {(['instructor', 'admin', 'owner'].some(r => effectiveRoles.includes(r))) && (
                                    <NavItem to={`/studio/${slug}/financials/my-payouts`} icon={<DollarSign size={18} />}>My Payouts</NavItem>
                                )}

                                {(['admin', 'owner'].some(r => effectiveRoles.includes(r))) && (
                                    <>
                                        <NavItem to={`/studio/${slug}/settings/staff`} icon={<Users size={18} />}>Team</NavItem>
                                        <NavItem to={`/studio/${slug}/settings/roles`} icon={<Shield size={18} />}>Roles & Permissions</NavItem>
                                    </>
                                )}

                                {featureSet.has('financials') && (
                                    <NavItem to={`/studio/${slug}/finances`} end icon={<DollarSign size={18} />}>Finances</NavItem>
                                )}
                                <NavItem to={`/studio/${slug}/discounts`} icon={<Tag size={18} />}>Discounts</NavItem>
                                <NavItem to={`/studio/${slug}/settings/integrations`} icon={<Smartphone size={18} />}>Integrations</NavItem>
                                <NavItem to={`/studio/${slug}/settings/developers`} icon={<Terminal size={18} />}>Developers</NavItem>
                                {featureSet.has('chat') && (
                                    <NavItem to={`/studio/${slug}/settings/chat`} icon={<MessageSquare size={18} />}>Chat Settings</NavItem>
                                )}
                                <NavItem to={`/studio/${slug}/settings/appointments`} icon={<Calendar size={18} />}>Appointment Services</NavItem>
                                <NavItem to={`/studio/${slug}/settings/tags-fields`} icon={<Tag size={18} />}>Tags & Fields</NavItem>
                                <NavItem to={`/studio/${slug}/settings/activity`} icon={<History size={18} />}>Activity Log</NavItem>
                                <NavItem to={`/studio/${slug}/data`} icon={<Database size={18} />}>Data</NavItem>
                                <NavItem to={`/studio/${slug}/settings`} end icon={<Settings size={18} />}>Settings</NavItem>
                            </SidebarGroup>

                            <SidebarGroup title="Analytics">
                                <NavItem to={`/studio/${slug}/analytics/financials`} icon={<DollarSign size={18} />}>Financials</NavItem>
                                <NavItem to={`/studio/${slug}/analytics/attendance`} icon={<BarChart3 size={18} />}>Attendance</NavItem>
                                <NavItem to={`/studio/${slug}/analytics/projections`} icon={<TrendingUp size={18} />}>Projections</NavItem>
                                <NavItem to={`/studio/${slug}/analytics/custom`} icon={<Filter size={18} />}>Custom Reports</NavItem>
                                <NavItem to={`/studio/${slug}/analytics/reports`} icon={<Mail size={18} />}>Scheduled Reports</NavItem>
                            </SidebarGroup>
                        </>
                    )}
                </nav>


                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-3">
                    {/* View as Student Toggle */}
                    {!isStudentView && (me?.roles?.includes('owner') || me?.roles?.includes('admin') || (me?.user as any)?.isPlatformAdmin || isImpersonating) && (
                        <button
                            onClick={toggleStudentView}
                            className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 text-xs font-medium transition mb-1"
                        >
                            <Users size={14} />
                            <span>View as Student</span>
                        </button>
                    )}

                    {/* System Admin Escape Hatch */}
                    {((me?.user as any)?.isPlatformAdmin || isImpersonating) && !isStudentView && (
                        <a href="/admin" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-xs font-medium transition mb-1"
                        >
                            <Users size={14} />
                            <span>Return to Admin</span>
                        </a>
                    )}

                    <Link
                        to="/documentation"
                        className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 text-xs font-medium transition mb-1"
                    >
                        <CircleHelp size={14} />
                        <span>Documentation</span>
                    </Link>


                    <div className="pt-4 mt-auto">
                        <PoweredBy tier={tenant.tier} branding={tenant.branding} />
                    </div>
                </div>
            </aside >

            {/* Main Content */}
            <main className="flex-1 ml-64 flex flex-col min-w-0 relative">

                {/* Impersonation Banner */}
                {isImpersonating && (
                    <Suspense fallback={null}>
                        <ClientOnly>
                            <ImpersonationBanner
                                tenantName={tenant.name}
                                userName={`${me.firstName} ${me.lastName}`}
                                currentRole={me.roles && me.roles.length > 0 ? me.roles[0] : 'student'}
                            />
                        </ClientOnly>
                    </Suspense>
                )}

                {/* Student View Banner */}
                {isStudentView && (
                    <div className="bg-blue-600 text-white px-6 py-2 text-sm font-medium flex items-center justify-between shadow-md z-30">
                        <div className="flex items-center gap-2">
                            <Users size={16} />
                            <span>You are viewing as a Student.</span>
                        </div>
                        <button
                            onClick={toggleStudentView}
                            className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-zinc-100 transition"
                        >
                            Exit View
                        </button>
                    </div>
                )}

                {isPaused && (
                    <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-6 py-3 text-sm font-medium flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>This studio is currently paused. Some features may be restricted.</span>
                    </div>
                )}

                {/* Global Header */}
                <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 sticky top-0 z-10">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="hover:text-zinc-900 dark:hover:text-zinc-300 cursor-pointer">Studio</span>
                        <span>/</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{tenant.name}</span>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-command-bar'))}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:border-blue-500 transition-all shadow-sm group"
                        >
                            <Search size={14} className="group-hover:text-blue-500" />
                            <span>Search...</span>
                            <kbd className="ml-2 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded font-sans opacity-50">⌘K</kbd>
                        </button>

                        <Suspense fallback={null}>
                            <ClientOnly>
                                <CommandBar token={token || ''} isPlatformAdmin={(me as any)?.user?.isPlatformAdmin} />
                            </ClientOnly>
                        </Suspense>

                        <Link
                            to="/documentation"
                            title="Documentation"
                            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <CircleHelp size={20} />
                        </Link>

                        <ClientOnly>
                            <ThemeToggle />
                        </ClientOnly>

                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />

                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end hidden sm:flex">
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-none">{displayName}</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium capitalize mt-0.5">
                                    {(() => {
                                        const isPlatformAdmin = (me as any)?.user?.isPlatformAdmin;
                                        let baseRole = 'Member';
                                        if (isPlatformAdmin) baseRole = 'Admin';
                                        else if (me?.roles?.includes('owner')) baseRole = 'Owner';
                                        else if (me?.roles?.includes('admin')) baseRole = 'Manager';
                                        else if (me?.roles?.includes('instructor')) baseRole = 'Instructor';

                                        let activeRole = (effectiveRoles[0] || 'member').replace(/_/g, ' ');

                                        // Capitalize helper
                                        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
                                        baseRole = cap(baseRole);
                                        activeRole = cap(activeRole);

                                        // Deduplicate if same
                                        if (baseRole === activeRole) return activeRole;

                                        // Show compound if strictly different effective state (e.g. Admin acting as Owner, or Owner viewing as Student)
                                        // Case 1: System Admin acting as anything else
                                        if (baseRole === 'Admin') return `${baseRole} / ${activeRole}`;
                                        // Case 2: Owner/Manager viewing as Student
                                        if (activeRole === 'Student' && baseRole !== 'Member') return `${baseRole} / ${activeRole}`;

                                        return activeRole;
                                    })()}
                                </span>
                            </div>
                            <UserButton />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto">
                    <Outlet context={{ tenant, me, features: featureSet, roles: effectiveRoles, isStudentView, token }} />
                </div>

                {/* Tenant Google Analytics */}
                {(tenant.googleCredentials as any)?.measurementId && (
                    <>
                        <script async src={`https://www.googletagmanager.com/gtag/js?id=${(tenant.googleCredentials as any).measurementId}`}></script>
                        <script dangerouslySetInnerHTML={{
                            __html: `
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', '${(tenant.googleCredentials as any).measurementId}');
                        `}} />
                    </>
                )}
            </main>
            <Suspense fallback={null}>
                <ClientOnly>
                    <ChatWidget
                        roomId={`support-${me.id}`}
                        tenantId={isStudentView ? tenant.id : undefined}
                        tenantSlug={isStudentView ? undefined : "platform"}
                        userId={me.id}
                        userName={`${me.firstName} ${me.lastName}`}
                        enabled={!isStudentView && (tenant.settings?.chatEnabled !== false) && featureSet.has('chat')}
                        chatConfig={isStudentView ? tenant.settings?.chatConfig : undefined}
                        apiUrl={API_URL}
                        token={token || undefined}
                        brandColor={tenant.branding?.primaryColor || '#2563EB'}
                    />
                </ClientOnly>
            </Suspense>
        </div >
    );
}

function NavItem({ to, children, icon, end }: { to: string, children: React.ReactNode, icon: React.ReactNode, end?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            prefetch="intent"
            className={({ isActive }: { isActive: boolean }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 flex items-center gap-3 ${isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`
            }
        >
            {icon}
            {children}
        </NavLink>
    );
}


