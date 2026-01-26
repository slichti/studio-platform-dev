import { useUser, useClerk } from "@clerk/react-router";
// @ts-ignore
import { NavLink, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Menu, X } from "lucide-react";

type LayoutProps = {
    children: React.ReactNode;
    tenantName?: string;
    role?: string;
    navItems?: React.ReactNode;
    title?: string;
};

export default function Layout({ children, tenantName = "Studio Platform", role, navItems, title = "Overview" }: LayoutProps) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [impersonationToken, setImpersonationToken] = useState<string | null>(null);
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Check for impersonation token on mount
        setImpersonationToken(localStorage.getItem("impersonation_token"));
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("impersonation_token");
            setImpersonationToken(null);
        }
        signOut({ redirectUrl: "/" });
    };

    const SidebarContent = () => (
        <>
            {/* Logo / Tenant Area */}
            <div className="p-6 flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-3xl">🧘‍♀️</div>
                <div>
                    <h1 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 leading-tight">
                        {tenantName}
                    </h1>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {navItems || (
                    <>
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }: { isActive: boolean }) =>
                                `block px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`
                            }
                        >
                            Overview
                        </NavLink>
                    </>
                )}
            </nav>
        </>
    );

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col transition-colors duration-300 flex-shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar (Sheet) */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} side="left">
                <SheetContent className="p-0 w-[80%] max-w-[300px]">
                    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
                        <SidebarContent />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Impersonation Banner */}
                {impersonationToken && (
                    <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium">
                        <span>⚠️ Impersonating {typeof window !== 'undefined' ? localStorage.getItem("impersonation_target_email") : "User"}</span>
                        <button
                            onClick={() => {
                                localStorage.removeItem("impersonation_token");
                                localStorage.removeItem("impersonation_target_email");
                                setImpersonationToken(null);
                                window.location.href = "/";
                            }}
                            className="bg-white text-red-500 px-2 py-0.5 rounded text-xs font-bold hover:bg-red-50"
                        >
                            Exit
                        </button>
                    </div>
                )}

                {/* Header */}
                <header className="h-[70px] bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 md:px-8 transition-colors duration-300 flex-shrink-0 z-20">
                    {/* Left: Mobile Trigger & Page Title */}
                    <div className="flex items-center gap-3 md:gap-0">
                        {/* Mobile Menu Trigger */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="p-2 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="text-lg font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {title}
                        </div>
                    </div>

                    {/* Right: User Profile */}
                    <div className="flex items-center gap-3 md:gap-5">
                        {/* Theme Toggle */}
                        <ThemeToggle />

                        {/* User Info Dropdown Trigger */}
                        {isLoaded && user && (
                            <div className="relative">
                                <button
                                    className="flex items-center gap-3 p-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                        {user.imageUrl ? (
                                            <img src={user.imageUrl} alt={user.fullName || "User"} className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{user.firstName ? user.firstName[0] : 'U'}</span>
                                        )}
                                    </div>

                                    <div className="text-left hidden md:block">
                                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 max-w-[120px] truncate">{user.fullName}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{role || "admin"}</div>
                                    </div>

                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 hidden md:block">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                            <NavLink
                                                to="/dashboard/profile"
                                                onClick={() => setIsDropdownOpen(false)}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                My Profile
                                            </NavLink>

                                            {impersonationToken && (
                                                <button
                                                    onClick={() => {
                                                        setIsDropdownOpen(false);
                                                        localStorage.removeItem("impersonation_token");
                                                        localStorage.removeItem("impersonation_target_email");
                                                        setImpersonationToken(null);
                                                        window.location.href = "/admin";
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 0-10 10v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a10 10 0 0 0-10-10Z" /><path d="M12 12v6" /><circle cx="12" cy="7" r="1" /></svg>
                                                    Return to Admin
                                                </button>
                                            )}

                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                                            <button
                                                onClick={() => { setIsDropdownOpen(false); handleLogout(); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                                Sign Out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}
