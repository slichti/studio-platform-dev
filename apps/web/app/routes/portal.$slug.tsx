import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { Outlet, Link, useLoaderData, useLocation, useOutletContext, NavLink } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
// Removed unused Layout imports
import { Home, Calendar, User, LogOut, Ticket, Award, BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    // [E2E BYPASS] Allow impersonation/bypass for testing
    let userId: string | null = null;
    let token: string | null = null;
    let getToken: (() => Promise<string | null>) | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) {
            userId = match[1];
            token = userId;
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
        return redirect(`/sign-in?redirect_url=${new URL(args.request.url).pathname}`);
    }

    if (!token && getToken) token = await getToken();
    const { slug } = args.params;

    try {
        // Fetch Tenant & Member Info
        // Reusing the same endpoint as Studio since it provides the basic context
        const tenant = await apiRequest(`/tenants/${slug}`, token);
        const me = await apiRequest(`/users/me`, token).catch(() => null);

        // Verify Membership
        const membership = me?.tenants?.find((t: any) => t.slug === slug);
        if (!membership) {
            // Not a member? Redirect to join or public page?
            // For now, let's assume they might be trying to join
            // return redirect(`/studio/${slug}/join`);
        }

        return { tenant, me, membership };
    } catch (e) {
        console.error("Portal Loader Error:", e);
        throw new Response("Studio Not Found", { status: 404 });
    }
};

export default function StudentPortalLayout() {
    const { tenant, me, membership } = useLoaderData<typeof loader>();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { label: "Dashboard", icon: Home, to: "." },
        { label: "Book Class", icon: Calendar, to: "classes" },
        { label: "Courses", icon: BookOpen, to: "courses" },
        { label: "My Profile", icon: User, to: "profile" },
    ];

    if (!tenant) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    {tenant.branding?.logoUrl ? (
                        <img src={tenant.branding.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                            {tenant.name.substring(0, 2)}
                        </div>
                    )}
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{tenant.name}</span>
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-zinc-600 dark:text-zinc-300">
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-zinc-900 pt-20 px-6">
                    <nav className="flex flex-col gap-4">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setMobileMenuOpen(false)}
                                end={item.to === "."}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-4 p-4 rounded-xl text-lg font-medium transition-colors",
                                    isActive
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                )}
                            >
                                <item.icon size={24} />
                                {item.label}
                            </NavLink>
                        ))}
                        <Link to="/sign-out" className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 mt-8">
                            <LogOut size={24} />
                            Log Out
                        </Link>
                    </nav>
                </div>
            )}

            <div className="flex flex-1 max-w-7xl mx-auto w-full">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex flex-col w-64 p-6 border-r border-zinc-200 dark:border-zinc-800 min-h-screen sticky top-0 h-screen">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        {tenant.branding?.logoUrl ? (
                            <img src={tenant.branding.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                {tenant.name.substring(0, 2)}
                            </div>
                        )}
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-lg leading-tight">{tenant.name}</span>
                    </div>

                    <nav className="flex flex-col gap-2 flex-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "."}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group",
                                    isActive
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:translate-x-1"
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={20} className={isActive ? "" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"} />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 px-2 mb-4">
                            {me?.portraitUrl ? (
                                <img src={me.portraitUrl} className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{me?.firstName}</p>
                                <p className="text-xs text-zinc-500 truncate">Student</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0 p-4 md:p-8">
                    <Outlet context={{ tenant, me, membership }} />
                </main>
            </div>
        </div>
    );
}
