import { Outlet, useLoaderData, useParams, NavLink, redirect, Link, useSearchParams } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { useState, useEffect } from "react"; // Added useState
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { UserButton } from "@clerk/react-router";
import { PoweredBy } from "../components/PoweredBy";
import {
    LayoutDashboard,
    Calendar,
    User,
    Users,
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
    Award,
    Code,
    Terminal,
    Film,
    Image as ImageIcon,
    Database,
    Smartphone,
    MessageSquare,
    CircleHelp
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { CommandBar } from "../components/CommandBar";
import { SidebarGroup } from "../components/SidebarGroup";
import { ComponentProps } from "react";
import { useClerk, useUser } from "@clerk/react-router";
import { ImpersonationBanner } from "../components/ImpersonationBanner";
import { ChatWidget } from "../components/chat/ChatWidget";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params, request } = args;
    const { userId, getToken } = await getAuth(args);

    if (!userId) {
        return redirect(`/sign-in?redirect_url=${request.url}`);
    }

    const { slug } = params;
    if (!slug) return redirect("/");

    let token = await getToken();

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

        // Status Enforcement
        if (tenantInfo.status === 'suspended') {
            throw new Response("This studio has been suspended by the platform administrator.", { status: 403 });
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
    const { slug, tenant, me, isPaused, features, token, isImpersonating } = useLoaderData<typeof loader>();
    const { user: clerkUser } = useUser();
    const featureSet = new Set(features);

    // Name Display Logic
    const dbName = `${me.firstName || ''} ${me.lastName || ''}`.trim();
    // If DB name is just "User" or empty, try Clerk name, otherwise fallback to DB (or 'Member')
    const displayName = (dbName && dbName !== 'User') ? dbName : (clerkUser?.fullName || dbName || 'Member');

    // Student View State
    // Initialize from localStorage if client-side, otherwise false
    const [isStudentView, setIsStudentView] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('studio_student_view') === 'true';
        return false;
    });

    const toggleStudentView = () => {
        const newState = !isStudentView;
        setIsStudentView(newState);
        localStorage.setItem('studio_student_view', String(newState));

        // Force a soft reload/re-render might be needed if side effects depend on roles,
        // but passing new roles to Outlet context should propagate to children.
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
            // Ideally show toast here, but we don't have a global toast context readily visible without looking deeper.
            // Assuming silent apply is okay for now, checkout will show it.
        }
    }, [searchParams, setSearchParams]);

    // Effective Roles: If in student view, force role to just 'student'
    const effectiveRoles = isStudentView ? ['student'] : (me?.roles || []);
    // Also override 'me' slightly to reflect restricted permissions if needed downstream
    // But 'roles' is the main gatekeeper for the Sidebar and children.

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed inset-y-0 z-20 transition-colors duration-300">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <Link to={`/studio/${slug}`} prefetch="intent" className="flex items-center gap-2 group">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: tenant.branding?.primaryColor || '#2563eb' }}
                        >
                            {tenant.name.substring(0, 1)}
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
                        {/* Only show Substitutions to Instructors/Admins */}
                        {!isStudentView && (
                            <NavItem to={`/studio/${slug}/substitutions`} icon={<RefreshCw size={18} />}>Substitutions</NavItem>
                        )}
                        <NavItem to={`/studio/${slug}/waivers`} icon={<FileSignature size={18} />}>Waivers</NavItem>
                        <NavItem to={`/studio/${slug}/videos`} icon={<ImageIcon size={18} />}>Media Library</NavItem>
                    </SidebarGroup>

                    <SidebarGroup title="Commerce">
                        {(featureSet.has('pos') || ['growth', 'scale'].includes(tenant.tier)) && !isStudentView && (
                            <>
                                <NavItem to={`/studio/${slug}/pos`} icon={<ShoppingCart size={18} />}>POS & Retail</NavItem>
                            </>
                        )}
                        <NavItem to={`/studio/${slug}/memberships`} icon={<CreditCard size={18} />}>Memberships</NavItem>
                        <NavItem to={`/studio/${slug}/commerce/packs`} icon={<Package size={18} />}>Class Packs</NavItem>

                        {(featureSet.has('pos') || ['growth', 'scale'].includes(tenant.tier)) && (
                            <>
                                <NavItem to={`/studio/${slug}/commerce/coupons`} icon={<Ticket size={18} />}>
                                    {isStudentView ? "My Coupons" : "Coupons"}
                                </NavItem>
                                <NavItem to={`/studio/${slug}/commerce/gift-cards`} icon={<Ticket size={18} />}>Gift Cards</NavItem>
                            </>
                        )}
                    </SidebarGroup>

                    {/* HIDE CRM and Management when in Student View */}
                    {!isStudentView && (
                        <>
                            <SidebarGroup title="CRM">
                                <NavItem to={`/studio/${slug}/leads`} icon={<User size={18} />}>Leads</NavItem>
                                <NavItem to={`/studio/${slug}/tasks`} icon={<ListTodo size={18} />}>Tasks</NavItem>
                                {(featureSet.has('marketing') || ['growth', 'scale'].includes(tenant.tier)) && (
                                    <NavItem to={`/studio/${slug}/marketing`} icon={<Mail size={18} />}>Marketing</NavItem>
                                )}
                                {(featureSet.has('loyalty') || ['growth', 'scale'].includes(tenant.tier)) && (
                                    <NavItem to={`/studio/${slug}/loyalty`} icon={<Award size={18} />}>Loyalty</NavItem>
                                )}
                            </SidebarGroup>

                            <SidebarGroup title="Management">
                                <NavItem to={`/studio/${slug}/students`} icon={<Users size={18} />}>People</NavItem>
                                {(['scale'].includes(tenant.tier) || featureSet.has('payroll')) && (
                                    <NavItem to={`/studio/${slug}/financials/payroll`} icon={<CreditCard size={18} />}>Payroll Admin</NavItem>
                                )}
                                {(effectiveRoles.some((r: string) => ['instructor', 'admin', 'owner'].includes(r))) && (
                                    <NavItem to={`/studio/${slug}/financials/my-payouts`} icon={<DollarSign size={18} />}>My Payouts</NavItem>
                                )}

                                <NavItem to={`/studio/${slug}/finances`} end icon={<DollarSign size={18} />}>Finances</NavItem>
                                <NavItem to={`/studio/${slug}/discounts`} icon={<Tag size={18} />}>Discounts</NavItem>
                                <NavItem to={`/studio/${slug}/settings/embeds`} icon={<Code size={18} />}>Website Widgets</NavItem>
                                {tenant.platformFeatures?.feature_mobile_app && (
                                    <NavItem to={`/studio/${slug}/settings/mobile`} icon={<Smartphone size={18} />}>Mobile App</NavItem>
                                )}
                                <NavItem to={`/studio/${slug}/settings/integrations`} icon={<Terminal size={18} />}>Integrations</NavItem>
                                <NavItem to={`/studio/${slug}/settings/chat`} icon={<MessageSquare size={18} />}>Chat Settings</NavItem>
                                <NavItem to={`/studio/${slug}/data`} icon={<Database size={18} />}>Data</NavItem>
                                <NavItem to={`/studio/${slug}/settings`} end icon={<Settings size={18} />}>Settings</NavItem>
                            </SidebarGroup>

                            <SidebarGroup title="Analytics">
                                <NavItem to={`/studio/${slug}/reports`} icon={<BarChart3 size={18} />}>Reports</NavItem>
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
                        to="/help"
                        className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 text-xs font-medium transition mb-1"
                    >
                        <CircleHelp size={14} />
                        <span>Help & Support</span>
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
                    <ImpersonationBanner
                        tenantName={tenant.name}
                        userName={`${me.firstName} ${me.lastName}`}
                        currentRole={me.roles && me.roles.length > 0 ? me.roles[0] : 'student'}
                    />
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

                        <Link
                            to="/help"
                            title="Help Center"
                            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <CircleHelp size={20} />
                        </Link>

                        <ThemeToggle />

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
                    <Outlet context={{ tenant, me, features: featureSet, roles: effectiveRoles, isStudentView }} />
                </div>
                {!isStudentView && (
                    <CommandBar token={token || ''} />
                )}

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
            <ChatWidget
                roomId={`support-${me.id}`}
                tenantId={isStudentView ? (slug || "") : "platform"}
                userId={me.id}
                userName={`${me.firstName} ${me.lastName}`}
                enabled={!isStudentView || tenant.settings?.chatEnabled !== false}
                chatConfig={isStudentView ? tenant.settings?.chatConfig : undefined}
                apiUrl={(typeof window !== 'undefined' ? (window as any).ENV?.API_URL : '')}
            />
        </div>
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


