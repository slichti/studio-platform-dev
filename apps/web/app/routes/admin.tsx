import { type LoaderFunctionArgs, redirect, Outlet, NavLink, useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useUser } from "@clerk/react-router";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { CommandBar } from "../components/CommandBar";
import { apiRequest } from "../utils/api";
import { Search } from "lucide-react";

// ----------------------------------------------------------------------
// SECURITY CONFIGURATION
// ----------------------------------------------------------------------
// Platform Admin access is now controlled solely by the 'isPlatformAdmin' flag on the user record.
// See `packages/api/src/routes/users.ts` and `authMiddleware` for details.

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();

    // 1. Authentication Check
    if (!userId || !token) {
        return redirect("/sign-in?redirect_url=/admin");
    }

    // 2. Authorization Check (Fetch User Profile)
    try {
        const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
        const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

        // Fetch /me to get email and system role
        const user = (await apiRequest("/users/me", token, {}, apiUrl)) as any;

        // A. Role Check (Must be System Admin)
        if (!user.isPlatformAdmin && user.role !== 'admin') {
            console.warn(`Admin Access Denied: User ${user.email} (${user.id}) is not a Platform Admin.`);
            throw new Response("Forbidden", { status: 403 });
        }

        // B. Strict Allowlist Check - REMOVED per user request to allow DB-based role management
        // Now relying solely on user.isPlatformAdmin or user.role === 'admin' checked above.

        return { user, token };
    } catch (e: any) {
        if (e.status === 403 || e.message?.includes("Forbidden")) {
            throw new Response("Access Denied", { status: 403 });
        }
        // If API fails (e.g. 401), redirect to login
        if (e.status === 401) {
            return redirect("/sign-in?redirect_url=/admin");
        }
        console.error("Admin Loader Error:", e);

        // Return a dummy user with error state to prevent UI crash, 
        // OR throw a 503 response that error boundary handles nicely?
        // Let's throw a proper Response so standard Error Boundary picks it up but with logic
        throw new Response(`System Unavailable: ${e.message}`, { status: 503 });
    }
};

export default function AdminLayout() {
    const { user: clerkUser, isLoaded } = useUser();
    const loaderData = useLoaderData<typeof loader>();
    const dbUser = loaderData?.user;

    // Use DB user profile if available (synced), fallback to Clerk
    const displayName = dbUser?.firstName || clerkUser?.fullName || "Admin User";
    const displayEmail = dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || "admin@platform.com";
    const displayImage = dbUser?.portraitUrl || clerkUser?.imageUrl;

    const navItems = [
        { label: "Overview", href: "/admin", end: true, icon: "📊" },
        { label: "Tenants", href: "/admin/tenants", icon: "🏢" },
        { label: "Financials", href: "/admin/financials", icon: "💰" },
        { label: "Projections", href: "/admin/projections", icon: "📈" },
        { label: "Communications", href: "/admin/comms", icon: "📡" },
        { label: "Activity Logs", href: "/admin/logs", icon: "📋" },
        { label: "Global User Directory", href: "/admin/users", icon: "👥" },
        { label: "Video Manager", href: "/admin/videos", icon: "🎬" },
        { label: "Website Builder", href: "/admin/website", icon: "🌐" },
        { label: "Chat System", href: "/admin/chat", icon: "💬" },
        { label: "Platform Features", href: "/admin/features", icon: "⚙️" },
        { label: "System Status", href: "/admin/status", icon: "🟢" },
        { label: "Architecture", href: "/admin/architecture", icon: "🏗️" },
        { label: "Marketing Automations", href: "/admin/workflows", icon: "📋" },
        { label: "Internal Docs", href: "/documentation", icon: "📚" },
        { label: "Coupons", href: "/admin/coupons", icon: "🎟️" },
        { label: "Diagnostics", href: "/admin/diagnostics", icon: "🩺" },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans flex text-zinc-900 dark:text-zinc-100">
            {/* Admin Sidebar */}
            <aside className="w-64 bg-zinc-950 text-zinc-400 flex flex-col border-r border-zinc-800 shadow-xl z-10">
                <div className="p-6 border-b border-zinc-900/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/20">
                        S
                    </div>
                    <div>
                        <div className="font-semibold text-zinc-100 leading-tight">Studio Platform</div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                            {dbUser?.role === 'owner' ? 'Platform Owner' : 'Platform Admin'}
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1 mt-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            end={item.end}
                            className={({ isActive }: { isActive: boolean }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? "bg-zinc-800/80 text-white shadow-inner"
                                    : "hover:bg-zinc-900 hover:text-zinc-200"
                                }`
                            }
                            {...(item.href.includes('documentation') ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                            <span className="opacity-70">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-zinc-900/50 text-xs text-zinc-600 text-center">
                    &copy; 2024 Studio Platform
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50/50 dark:bg-zinc-950">
                <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="hover:text-zinc-900 dark:hover:text-zinc-300 cursor-pointer">Admin</span>
                        <span>/</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">v1.0.0-dev</span>

                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-command-bar'))}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:border-blue-500 transition-all shadow-sm group"
                        >
                            <Search size={14} className="group-hover:text-blue-500" />
                            <span>Search...</span>
                            <kbd className="ml-2 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded font-sans opacity-50">⌘K</kbd>
                        </button>

                        <ThemeToggle />

                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />

                        {isLoaded && (clerkUser || dbUser) ? (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-none">{displayName}</span>
                                    <span className="text-xs text-zinc-500">
                                        {displayEmail}
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
                                    <img
                                        src={displayImage}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 animate-pulse">
                                <div className="flex flex-col items-end gap-1">
                                    <div className="h-4 w-24 bg-zinc-100 rounded"></div>
                                    <div className="h-3 w-32 bg-zinc-100 rounded"></div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-zinc-100"></div>
                            </div>
                        )}

                        <LogoutButton />
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    <Outlet />
                </div>
                <CommandBar token={loaderData?.token || ""} />
            </main>
        </div>
    );
}
