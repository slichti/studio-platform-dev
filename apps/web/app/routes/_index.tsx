// @ts-ignore
import type { MetaFunction } from "react-router";
// @ts-ignore
import { Link } from "react-router";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/react-router";
import { ThemeToggle } from "~/components/ThemeToggle";

export default function Index() {
    const { user } = useUser();

    return (
        <div className="font-sans min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
            {/* Navigation */}
            <nav className="flex justify-between items-center px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold tracking-tight">🧘 Studio Platform</span>
                </div>
                <div className="flex items-center gap-6">
                    <ThemeToggle />
                    <Link to="/pricing" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                        Pricing
                    </Link>
                    <Link to="/admin" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                        Admin
                    </Link>
                    <SignedIn>
                        <Link to="/dashboard" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
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

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-6 py-24 text-center">
                <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent pb-2">
                    Modern Studio Management
                </h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                    Streamline your yoga studio operations with our comprehensive platform.
                    Manage classes, memberships, and students all in one place.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
                    <SignedIn>
                        <Link to="/dashboard" className="px-8 py-3.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-lg hover:shadow-xl">
                            Go to Dashboard
                        </Link>
                    </SignedIn>
                    <SignedOut>
                        <Link to="/sign-up" className="px-8 py-3.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-lg hover:shadow-xl">
                            Start Your Free Trial
                        </Link>
                        <Link to="/sign-in" className="px-8 py-3.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg font-semibold text-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                            Log In
                        </Link>
                    </SignedOut>
                </div>
            </main>

            {/* Features Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 py-24 px-6 border-t border-zinc-100 dark:border-zinc-800">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { title: "Class Scheduling", desc: "Easy to use calendar for managing all your classes and recurring sessions." },
                        { title: "Member Management", desc: "Track attendance, memberships, and payments for all your students." },
                        { title: "Instructor Portal", desc: "Give your instructors access to their schedules and rosters." }
                    ].map((feature, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-950 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

