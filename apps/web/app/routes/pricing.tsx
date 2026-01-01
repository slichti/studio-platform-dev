// @ts-ignore
import type { MetaFunction } from "react-router";
// @ts-ignore
import { Link } from "react-router";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/react-router";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Check, X, Info, Zap, Store, BarChart3, Users } from "lucide-react";
import { useState } from "react";
import { Modal } from "~/components/Modal";

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
        idealFor: "Solo instructors, hobbyists, and part-time teachers.",
        trial: null,
        features: [
            'Unlimited Students',
            '5 Instructors',
            '1 Location',
            '5GB Storage',
        ],
        detailedFeatures: {
            Operations: [
                "Manage up to 5 Instructors",
                "Single Location Support",
                "Unlimited Student Database",
                "Basic Reporting & Analytics",
                "Waiver Management"
            ],
            Marketing: [
                "Automated Transactional Emails",
                "Basic Client Profiles"
            ],
            Commerce: [
                "Credit Card Processing (2.9% + 30¢)",
                "Class Packs & Memberships",
                "Drop-in Payments"
            ]
        },
        missing: [
            'Zoom Integration',
            'Video on Demand',
            'Automations',
            'White Labeling'
        ],
        cta: 'View Details',
        finalCta: 'Get Started',
        highlight: false
    },
    {
        name: 'Growth',
        price: '$49',
        period: '/month',
        description: 'For established studios growing their community.',
        idealFor: "Boutique studios, yoga centers, and growing gyms.",
        trial: "14-Day Free Trial",
        features: [
            'Everything in Launch',
            '15 Instructors',
            '3 Locations',
            '50GB Storage',
            'Zoom Integration',
            'Video on Demand (VOD)',
            'Automations (No-Show, etc)',
            'SMS Notifications'
        ],
        detailedFeatures: {
            Operations: [
                "Manage up to 15 Instructors",
                "Up to 3 Locations",
                "Advanced Payroll Reporting",
                "Automated No-Show Fees",
                "Waitlist Automation"
            ],
            Marketing: [
                "SMS Notifications & Reminders",
                "Campaign Builder (Email & SMS)",
                "Win-back Campaigns"
            ],
            Commerce: [
                "All Launch Features",
                "Recursring Membership Billing",
                "Discount Codes & Gift Cards"
            ],
            "Digital Studio": [
                "Zoom Integration (Auto-Meeting Creation)",
                "Video on Demand Hosting (50GB)",
                "Hybrid Class Support"
            ]
        },
        missing: [
            'White Labeling',
            'API Access'
        ],
        cta: 'View Details',
        finalCta: 'Start Free Trial',
        highlight: true
    },
    {
        name: 'Scale',
        price: '$129',
        period: '/month',
        description: 'For multi-location studios and franchises.',
        idealFor: "Franchises, large wellness centers, and enterprise.",
        trial: "14-Day Free Trial",
        features: [
            'Everything in Growth',
            'Unlimited Instructors',
            'Unlimited Locations',
            '1TB Storage',
            'White Label Options',
            'API Access',
            'Priority Support',
            '0% Platform Fees'
        ],
        detailedFeatures: {
            Operations: [
                "Unlimited Instructors & Locations",
                "API Access for Custom Integrations",
                "Dedicated Account Manager",
                "Priority Support SLA"
            ],
            Marketing: [
                "Whitelabel Branding Options",
                "Custom Domain Support",
                "Advanced Segmentation"
            ],
            Commerce: [
                "All Growth Features",
                "0% Application Fee (Save 1.5% - 5%)",
                "Custom Payment Gateways (Contact Sales)"
            ],
            "Digital Studio": [
                "1TB Video Storage",
                "4K Streaming Support",
                "Custom Player Branding"
            ]
        },
        missing: [],
        cta: 'View Details',
        finalCta: 'Start Free Trial',
        highlight: false
    }
];

export default function Pricing() {
    const { user } = useUser();
    const [selectedTier, setSelectedTier] = useState<typeof TIERS[0] | null>(null);

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

                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                {tier.features.slice(0, 5).map((feature) => (
                                    <div key={feature} className="flex items-start gap-3">
                                        <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                        </div>
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{feature}</span>
                                    </div>
                                ))}
                                {tier.features.length > 5 && (
                                    <p className="text-sm text-zinc-500 italic pl-8">+ {tier.features.length - 5} more features</p>
                                )}
                            </div>

                            <button
                                onClick={() => setSelectedTier(tier)}
                                className={`w-full py-3 px-4 rounded-lg font-medium text-center transition-colors ${tier.highlight
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                                    : 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                                    }`}
                            >
                                {tier.cta}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="max-w-3xl mx-auto mt-20 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    <p>All plans include standard payment processing fees (2.9% + 30¢). <br /> Launch and Growth plans include an additional small platform fee (5% and 1.5% respectively) on transactions.</p>
                </div>
            </main>

            {/* Plan Detail Modal */}
            <Modal
                isOpen={!!selectedTier}
                onClose={() => setSelectedTier(null)}
                title={`Deep dive into ${selectedTier?.name}`}
                maxWidth="max-w-4xl"
            >
                {selectedTier && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-xl font-bold mb-2 flex items-center gap-2 text-zinc-900 dark:text-white">
                                    <span className="text-3xl">{selectedTier.price}</span>
                                    {selectedTier.period && <span className="text-lg font-normal text-zinc-500">{selectedTier.period}</span>}
                                </h4>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-4">{selectedTier.description}</p>
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
                                    <h5 className="font-semibold mb-2 text-sm uppercase tracking-wider text-zinc-500">Best For</h5>
                                    <p className="text-zinc-900 dark:text-zinc-100">{selectedTier.idealFor}</p>
                                </div>

                                <div className="space-y-2">
                                    <h5 className="font-semibold mb-2 text-sm uppercase tracking-wider text-zinc-500">Includes</h5>
                                    {selectedTier.features.map(f => (
                                        <div key={f} className="flex items-center gap-2 text-sm">
                                            <Check className="w-4 h-4 text-green-500" />
                                            <span className="text-zinc-700 dark:text-zinc-300">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                {Object.entries(selectedTier.detailedFeatures).map(([category, features]) => (
                                    <div key={category}>
                                        <h5 className="font-semibold mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-1 text-zinc-900 dark:text-white">
                                            {category}
                                        </h5>
                                        <ul className="space-y-2">
                                            {features.map((item) => (
                                                <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 flex-shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedTier(null)}
                                className="px-4 py-2 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Close
                            </button>
                            <Link
                                to="/sign-up"
                                className="px-8 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
                            >
                                {selectedTier.finalCta}
                            </Link>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="max-w-7xl mx-auto text-center text-zinc-500 dark:text-zinc-400 text-sm">
                    © {new Date().getFullYear()} Studio Platform. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
