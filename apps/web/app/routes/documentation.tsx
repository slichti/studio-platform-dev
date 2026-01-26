
import { Outlet, NavLink, Link, useLoaderData, type LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useUser } from "@clerk/react-router";
import { Book, Menu, X, Search, GraduationCap, Smartphone, Settings, Shield, Server, Users, FileText, ShoppingCart, Globe, MessageSquare, BarChart3, Layout, Database } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "../utils/api";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoutButton } from "../components/LogoutButton";

// @ts-ignore
import Fuse from "fuse.js";
import { docsIndex } from "../utils/docsIndex";
import { useNavigate } from "react-router";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();

    // 1. Authentication Check
    if (!userId || !token) {
        return redirect("/sign-in?redirect_url=/documentation");
    }

    try {
        const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
        const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

        // Fetch /me to get permissions/role
        const user = (await apiRequest("/users/me", token, {}, apiUrl)) as any;

        return { user, token };
    } catch (e: any) {
        console.error("Help Loader Error:", e);
        return redirect("/sign-in?redirect_url=/documentation");
    }
};

export default function HelpLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user: clerkUser } = useUser();
    const loaderData = useLoaderData<typeof loader>();
    const dbUser = loaderData?.user;

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<typeof docsIndex>([]);
    const [showResults, setShowResults] = useState(false);
    const navigate = useNavigate();

    const isPlatformAdmin = dbUser?.isPlatformAdmin || dbUser?.role === 'owner' || dbUser?.role === 'admin';

    const fuse = new Fuse(docsIndex, {
        keys: ["title", "content", "category"],
        threshold: 0.3,
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 1) {
            const results = fuse.search(query).map((result: any) => result.item);
            setSearchResults(results);
            setShowResults(true);
        } else {
            setShowResults(false);
        }
    };

    // Navigation Data
    const navigation = [
        // PLATFORM ADMIN SECTION
        ...(isPlatformAdmin ? [{
            category: "Platform Administration",
            items: [
                { name: "Architecture Overview", href: "/documentation/platform/architecture", icon: Server },
                { name: "Tenant Management", href: "/documentation/platform/tenants", icon: Shield },
            ]
        }] : []),

        // STUDIO MANAGEMENT SECTION (Visible to everyone)
        {
            category: "Getting Started",
            items: [
                { name: "Welcome to Studio Platform", href: "/documentation", icon: GraduationCap },
                { name: "Setting up your Studio", href: "/documentation/setup", icon: Settings },
                { name: "Migration & Import", href: "/documentation/migration", icon: Database },
                { name: "For Studio Owners", href: "/documentation/studio/overview", icon: Users },
            ]
        },

        {
            category: "Classes & Schedule",
            items: [
                { name: "Creating Classes", href: "/documentation/classes", icon: Book },
            ]
        },
        {
            category: "Commerce & Finance",
            items: [
                { name: "Memberships & POS", href: "/documentation/commerce", icon: ShoppingCart },
            ]
        },
        {
            category: "Online Presence",
            items: [
                { name: "Website Builder", href: "/documentation/website", icon: Globe },
                { name: "Mobile App", href: "/documentation/mobile-builder", icon: Smartphone },
            ]
        },
        {
            category: "Growth & CRM",
            items: [
                { name: "Marketing & Leads", href: "/documentation/crm", icon: MessageSquare },
            ]
        },
        {
            category: "Team Management",
            items: [
                { name: "Staff & Payroll", href: "/documentation/team", icon: Users },
                { name: "Advanced Analytics", href: "/documentation/studio/analytics", icon: BarChart3 }, // Updated
            ]
        },
        {
            category: "Student Experience",
            items: [
                { name: "Student Portal", href: "/documentation/studio/portal", icon: Layout },
            ]
        },
        {
            category: "How-to Guides",
            items: [
                { name: "Create a Waiver", href: "/documentation/guides/waiver", icon: FileText },
                { name: "Setup Class Packs", href: "/documentation/guides/class-packs", icon: ShoppingCart },
            ]
        }
    ];

    const displayName = dbUser?.firstName || clerkUser?.fullName || "User";
    const displayImage = dbUser?.portraitUrl || clerkUser?.imageUrl;

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-300">
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
                        <span className="hidden sm:inline">Internal Docs</span>
                    </Link>

                    {/* Return to App Context */}
                    {(dbUser?.tenants?.length > 0 || isPlatformAdmin) && (
                        <div className="hidden md:flex mr-6">
                            <a
                                href={isPlatformAdmin ? "/admin" : `/studio/${dbUser.tenants[0]?.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                            >
                                <Layout size={14} />
                                {isPlatformAdmin ? 'Return to Admin Portal' : 'Return to Studio'}
                            </a>
                        </div>
                    )}

                    {/* Search (Real) */}
                    <div className="flex-1 max-w-md hidden md:flex items-center relative group">
                        <Search className="absolute left-3 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearch}
                            onFocus={() => { if (searchQuery.length > 1) setShowResults(true); }}
                            onBlur={() => setTimeout(() => setShowResults(false), 200)} // Delay to allow click
                            placeholder="Search documentation..."
                            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-zinc-400"
                        />

                        {/* Results Dropdown */}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50">
                                {searchResults.map((result, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            navigate(result.href);
                                            setShowResults(false);
                                            setSearchQuery("");
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                    >
                                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-0.5">{result.category}</div>
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{result.title}</div>
                                        <div className="text-xs text-zinc-500 truncate mt-1">{result.content}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>


                    <div className="ml-auto flex items-center gap-4">
                        <ThemeToggle />

                        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-800">
                            <div className="text-right hidden md:block">
                                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{displayName}</div>
                                <div className="text-xs text-zinc-500">{isPlatformAdmin ? 'Platform Admin' : 'Studio Member'}</div>
                            </div>
                            {displayImage && (
                                <img src={displayImage} alt="Profile" className="w-8 h-8 rounded-full bg-zinc-200" />
                            )}
                        </div>

                        <LogoutButton />
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:block pt-20 md:pt-8 overflow-y-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <nav className="px-4 space-y-8 pb-8">
                        {navigation.map((group, idx) => (
                            <div key={idx}>
                                <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-3 px-2">
                                    {group.category}
                                </h3>
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <NavLink
                                            key={item.href}
                                            to={item.href}
                                            end={item.href === '/documentation' || item.href === '/documentation/platform'}
                                            onClick={() => setSidebarOpen(false)}
                                            className={({ isActive }) => `flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                                        >
                                            <item.icon size={18} className="opacity-70" />
                                            {item.name}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1 min-w-0 px-4 md:px-12 py-8 md:py-12 overflow-y-auto scroll-smooth">
                    <div className="max-w-4xl mx-auto">
                        <Outlet context={{ isPlatformAdmin, user: dbUser }} />
                    </div>
                </main>
            </div>
        </div>
    );
}
