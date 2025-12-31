// @ts-ignore
import { Outlet, NavLink } from "react-router";
import { useUser } from "@clerk/react-router";
import { LogoutButton } from "../components/LogoutButton";

export default function AdminLayout() {
    const { user, isLoaded } = useUser();
    const navItems = [
        { label: "Overview", href: "/admin", end: true, icon: "📊" },
        { label: "Tenants", href: "/admin/tenants", icon: "🏢" },
        { label: "Emails", href: "/admin/emails", icon: "📧" },
        { label: "System Users", href: "/admin/users", icon: "👥" },
        { label: "System Status", href: "/admin/status", icon: "🟢" },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 font-sans flex text-zinc-900">
            {/* Admin Sidebar */}
            <aside className="w-64 bg-zinc-950 text-zinc-400 flex flex-col border-r border-zinc-800 shadow-xl z-10">
                <div className="p-6 border-b border-zinc-900/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/20">
                        S
                    </div>
                    <div>
                        <div className="font-semibold text-zinc-100 leading-tight">Studio Platform</div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">System Admin</div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1 mt-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            end={item.end}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? "bg-zinc-800/80 text-white shadow-inner"
                                    : "hover:bg-zinc-900 hover:text-zinc-200"
                                }`
                            }
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
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50/50">
                <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="hover:text-zinc-900 cursor-pointer">Admin</span>
                        <span>/</span>
                        <span className="font-medium text-zinc-900">Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-zinc-400 bg-zinc-100 px-2 py-1 rounded">v1.0.0-dev</span>
                        <div className="h-4 w-px bg-zinc-200 mx-2" />

                        {isLoaded && user ? (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-medium text-zinc-900 leading-none">{user.fullName || "Admin User"}</span>
                                    <span className="text-xs text-zinc-500">
                                        {user.primaryEmailAddress?.emailAddress || "admin@platform.com"}
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
                                    <img
                                        src={user.imageUrl}
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
            </main>
        </div>
    );
}
