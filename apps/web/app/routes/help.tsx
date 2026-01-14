
import { Outlet, NavLink, Link } from "react-router";
import { Book, Menu, X, Search, ChevronRight, GraduationCap, Smartphone, Settings } from "lucide-react";
import { useState } from "react";

export default function HelpLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navigation = [
        {
            category: "Getting Started",
            items: [
                { name: "Welcome to Studio Platform", href: "/help", icon: GraduationCap },
                { name: "Setting up your Studio", href: "/help/setup", icon: Settings },
            ]
        },
        {
            category: "Mobile App",
            items: [
                { name: "White Label App Builder", href: "/help/mobile-builder", icon: Smartphone },
            ]
        },
        {
            category: "Classes & Schedule",
            items: [
                { name: "Creating Classes", href: "/help/classes", icon: Book },
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <div className="flex h-16 items-center px-4 md:px-8">
                    <button
                        className="mr-4 md:hidden text-zinc-500"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X /> : <Menu />}
                    </button>

                    <Link to="/" className="flex items-center gap-2 font-bold text-lg mr-8 text-zinc-900 dark:text-zinc-100">
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center text-white dark:text-zinc-900">
                            <Book size={18} />
                        </div>
                        <span>Help Center</span>
                    </Link>

                    {/* Search (Mock) */}
                    <div className="flex-1 max-w-md hidden md:flex items-center relative">
                        <Search className="absolute left-3 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search documentation..."
                            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                        <Link to="/sign-in" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                            Return to App
                        </Link>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex">
                {/* Sidebar */}
                <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:block pt-20 md:pt-8 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <nav className="px-4 space-y-8">
                        {navigation.map((group, idx) => (
                            <div key={idx}>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
                                    {group.category}
                                </h3>
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <NavLink
                                            key={item.href}
                                            to={item.href}
                                            end={item.href === '/help'}
                                            onClick={() => setSidebarOpen(false)}
                                            className={({ isActive }) => `flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                                        >
                                            <item.icon size={16} className="opacity-70" />
                                            {item.name}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1 min-w-0 px-4 md:px-12 py-8 md:py-12">
                    <div className="max-w-3xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
