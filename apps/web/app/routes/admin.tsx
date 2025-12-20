import { Outlet, NavLink } from "react-router";
import { LogoutButton } from "../components/LogoutButton";

export default function AdminLayout() {
    const navItems = [
        { label: "Overview", href: "/admin", end: true },
        { label: "Tenants", href: "/admin/tenants" },
        { label: "Users", href: "/admin/users" },
        { label: "System Status", href: "/admin/status" },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 font-sans flex text-zinc-900">
            {/* Admin Sidebar */}
            <aside className="w-64 bg-zinc-900 text-zinc-300 flex flex-col border-r border-zinc-800">
                <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
                    <div className="text-2xl">🛡️</div>
                    <div>
                        <div className="font-bold text-white">System Admin</div>
                        <div className="text-xs text-zinc-500">Platform Control</div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            end={item.end}
                            className={({ isActive }) =>
                                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                    ? "bg-zinc-800 text-white"
                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <LogoutButton />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 shadow-sm">
                    <h1 className="text-lg font-semibold text-zinc-800">
                        Platform Administration
                    </h1>
                    <div className="text-sm text-zinc-500">
                        v1.0.0-dev
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
