import { Link, useLocation } from "react-router";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/react-router";
import { ThemeToggle } from "~/components/ThemeToggle";

export function PublicNav() {
    const { user } = useUser();
    const location = useLocation();

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(path + '/');

    const navLinkClass = (path: string) =>
        `text-sm font-medium transition-colors ${isActive(path)
            ? 'text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
        }`;

    return (
        <nav className="flex justify-between items-center px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
                    🧘 Studio Platform
                </Link>
            </div>
            <div className="flex items-center gap-6">
                <ThemeToggle />
                <Link to="/features" className={navLinkClass('/features')}>
                    Features
                </Link>
                <Link to="/pricing" className={navLinkClass('/pricing')}>
                    Pricing
                </Link>
                {/* @ts-ignore */}
                {!!user?.publicMetadata?.isPlatformAdmin && (
                    <Link to="/admin" className={navLinkClass('/admin')}>
                        Admin
                    </Link>
                )}
                <SignedIn>
                    <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                        Dashboard
                    </Link>
                    <div className="flex items-center gap-3 pl-2 border-l border-zinc-200 dark:border-zinc-800">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                            {user?.firstName ? `Hi, ${user.firstName}` : ''}
                        </span>
                        <UserButton afterSignOutUrl="/" />
                    </div>
                </SignedIn>
                <SignedOut>
                    <Link to="/sign-in" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                        Sign In
                    </Link>
                    <Link to="/sign-up" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                        Get Started
                    </Link>
                </SignedOut>
            </div>
        </nav>
    );
}
