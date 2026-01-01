// @ts-ignore
import type { MetaFunction } from "react-router";
// @ts-ignore
import { Link } from "react-router";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/react-router";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Check, X } from "lucide-react";

export const meta: MetaFunction = () => {
    return [
        { title: "Pricing - Studio Platform" },
        { name: "description", content: "Simple, transparent pricing for studios of all sizes." },
    ];
};

const TIERS = [
    {
        name: 'Launch',
        price: 'Free',
        period: null,
        description: 'Perfect for new instructors and hobbyists.',
        trial: null,
        features: [
            'Unlimited Students',
            '5 Instructors',
            '1 Location',
            '5GB Storage',
            'Basic Financials & Reporting',
            'Waiver Management',
            'Transactional Email Notifications',
            'Class Packs & Drop-ins'
        ],
        cta: 'Get Started',
        ctaLink: '/create-studio?tier=basic',
        highlight: false
    },
    {
        name: 'Growth',
        price: '$49',
        period: '/month',
        description: 'For established studios growing their community.',
        trial: "14-Day Free Trial",
        features: [
            'Everything in Launch',
            '15 Instructors',
            '3 Locations',
            '50GB Storage',
            'Zoom Integration (Auto-Meeting)',
            'Video on Demand (VOD)',
            'Automations (No-Show Fees)',
            'SMS Notifications & Marketing',
            'Recurring Memberships'
        ],
        cta: 'Start Free Trial',
        ctaLink: '/create-studio?tier=growth',
        highlight: true
    },
    {
        name: 'Scale',
        price: '$129',
        period: '/month',
        description: 'For multi-location studios and franchises.',
        trial: "14-Day Free Trial",
        features: [
            'Everything in Growth',
            'Unlimited Instructors',
            'Unlimited Locations',
            '1TB Video Storage',
            'White Label Branding Options',
            'API Access',
            'Priority Support',
            '0% Platform Fees'
        ],
        cta: 'Start Free Trial',
        ctaLink: '/create-studio?tier=scale',
        highlight: false
    }
];

export default function Pricing() {
    const { user } = useUser();

    return (
        <div className="font-sans min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 flex flex-col">
            {/* Navigation */}
            <nav className="flex justify-between items-center px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
                        🧘 Studio Platform
                    </Link>
                </div>
                <div className="flex items-center gap-6">
                    <ThemeToggle />
                    <Link to="/pricing" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
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

            {/* Pricing Section */}
            <main className="flex-grow py-24 px-6">
                <div className="max-w-7xl mx-auto text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">
                        Simple, transparent pricing
                    </h1>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        Start for free and scale as you grow. No hidden fees or surprises.
                    </p>
                </div>

                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    {TIERS.map((tier) => (
                        <div
                            key={tier.name}
                            className={`rounded-2xl p-8 border flex flex-col ${tier.highlight
                                ? 'border-blue-500 ring-2 ring-blue-500 shadow-xl bg-white dark:bg-zinc-900 transform md:-translate-y-4'
                                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
                                }`}
                        >
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{tier.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-zinc-900 dark:text-white">{tier.price}</span>
                                    {tier.period && <span className="text-zinc-500 dark:text-zinc-400">{tier.period}</span>}
                                </div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{tier.description}</p>
                                {tier.trial && (
                                    <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        {tier.trial}
                                    </div>
                                )}
                            </div>

                            <div className="flex-grow space-y-4 mb-8">
                                {tier.features.map((feature) => (
                                    <div key={feature} className="flex items-start gap-3">
                                        <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                        </div>
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Link
                                to={tier.ctaLink}
                                className={`w-full py-3 px-4 rounded-lg font-medium text-center transition-colors ${tier.highlight
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                                    : 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                                    }`}
                            >
                                {tier.cta}
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Link
                        to="/pricing/compare"
                        className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors"
                    >
                        Compare all features and limits <span className="text-xl">→</span>
                    </Link>
                </div>

                <div className="max-w-3xl mx-auto mt-20 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="max-w-3xl mx-auto mt-20 text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-2">Understanding Platform Fees</h4>
                        <p className="mb-2">
                            <strong>Credit Card Processing (2.9% + 30¢):</strong> This fee goes directly to Stripe to process payments securely. It applies to all transactions on all plans.
                        </p>
                        <p>
                            <strong>Platform Fee (0% - 5%):</strong> This is a small percentage of transactions that goes to Studio Platform to support development and hosting.
                            It allows us to offer the <strong>Launch</strong> plan with no monthly subscription cost. As you grow, you can upgrade to reduce or eliminate this fee entirely.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="max-w-7xl mx-auto text-center text-zinc-500 dark:text-zinc-400 text-sm">
                    © {new Date().getFullYear()} Studio Platform. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
