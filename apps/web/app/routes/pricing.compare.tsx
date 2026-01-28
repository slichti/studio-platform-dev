// @ts-ignore
import type { MetaFunction } from "react-router";
// @ts-ignore
import { Link } from "react-router";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Check, Minus, HelpCircle } from "lucide-react";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/react-router";

export const meta: MetaFunction = () => {
    return [
        { title: "Compare Plans - Studio Platform" },
        { name: "description", content: "Detailed comparison of Studio Platform features and limits." },
    ];
};

import { useLoaderData } from "react-router";
import { apiRequest } from "~/utils/api";

type Plan = {
    id: string;
    slug: string;
    name: string;
    features: string[];
};

export async function loader() {
    try {
        // Fetch public plans server-side or client-side. 
        // Note: apiRequest with null token works for public endpoints if backend allows.
        // Assuming /public/plans is available.
        // We can ALSO fetch this in a useEffect client-side if loader context is tricky, 
        // but Remix loader is better for SEO/initial paint.
        // However, sticking to client-side apiRequest pattern used elsewhere for consistency if needed.
        // Let's try client-fetch pattern in component to avoid ssr auth issues if any.
        return null;
    } catch {
        return null;
    }
}

const STATIC_FEATURES_TEMPLATE = [
    {
        category: "Operations",
        items: [
            { name: "Staff Members", launch: "5", growth: "15", scale: "Unlimited" },
            { name: "Locations", launch: "1", growth: "3", scale: "Unlimited" },
            { name: "Student Profiles", launch: "Unlimited", growth: "Unlimited", scale: "Unlimited" },
            { name: "Waiver Management", launch: true, growth: true, scale: true },
            { name: "Payroll Reporting", launch: "Basic", growth: "Advanced", scale: "Custom" },
            { name: "No-Show Automation", launch: false, growth: true, scale: true },
            { name: "Waitlist Automation", launch: false, growth: true, scale: true },
        ]
    },
    {
        category: "Commerce",
        items: [
            { name: "Platform Fee", launch: "5%", growth: "2%", scale: "0%" },
            { name: "Credit Card Processing", launch: "2.9% + 30¢", growth: "2.9% + 30¢", scale: "2.9% + 30¢" },
            { name: "Class Packs & Drop-ins", launch: true, growth: true, scale: true },
            { name: "Recurring Memberships", launch: false, growth: true, scale: true },
            { name: "Discount Codes", launch: false, growth: true, scale: true },
            { name: "Gift Cards", launch: false, growth: true, scale: true },
        ]
    },
    {
        category: "Digital Studio",
        items: [
            { name: "Zoom Integration", launch: false, growth: true, scale: true },
            { name: "Video Storage", launch: "5 GB", growth: "50 GB", scale: "1 TB" },
            { name: "On-Demand Library", launch: false, growth: true, scale: true },
            { name: "HD Streaming (1080p)", launch: false, growth: false, scale: true },
        ]
    },
    {
        category: "Marketing & Branding",
        items: [
            { name: "Email Notifications", launch: "Transactional", growth: "Campaigns", scale: "White-label" },
            { name: "SMS Notifications", launch: false, growth: true, scale: true },
            { name: "Custom Domain", launch: false, growth: false, scale: true },
            { name: "White Label Branding", launch: false, growth: false, scale: true },
            { name: "API Access", launch: false, growth: false, scale: true },
        ]
    }
];

import { useState, useEffect } from "react";

// ... (existing imports)

export default function ComparePlans() {
    const { user } = useUser();
    const [plans, setPlans] = useState<Plan[]>([]);

    useEffect(() => {
        apiRequest('/public/plans', null).then(res => {
            if (Array.isArray(res)) setPlans(res);
        });
    }, []);

    const getPlanValue = (slug: string, featureName: string, defaultValue: string | boolean) => {
        const plan = plans.find(p => p.slug === slug);
        if (!plan) return defaultValue;

        // 1. Exact Match (Boolean Feature)
        if (plan.features.includes(featureName)) return true;

        // 2. Value Match (e.g. "5 Staff Members" -> "5")
        // Check for strings ending with feature name
        const valueMatch = plan.features.find(f => f.endsWith(` ${featureName}`) || f.includes(featureName));
        if (valueMatch) {
            // "5 Staff Members" -> "5"
            // "Unlimited Students" -> "Unlimited"
            const simpleVal = valueMatch.replace(featureName, '').trim();
            if (simpleVal) return simpleVal;
            return true; // Use checkmark if just found
        }

        // 3. Fallback to static default if not found (or if default was explicit limit not in features list)
        // If default was false and we didn't find it, remains false.
        // If default was "5" and we didn't find override, remains "5".
        return defaultValue;
    };

    const dynamicCategories = STATIC_FEATURES_TEMPLATE.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({
            name: item.name,
            launch: getPlanValue('launch', item.name, item.launch),
            growth: getPlanValue('growth', item.name, item.growth),
            scale: getPlanValue('scale', item.name, item.scale),
        }))
    }));

    return (
        <div className="font-sans min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
            {/* Same Nav ... */}
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
                        <UserButton afterSignOutUrl="/" />
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

            <main className="py-24 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-extrabold mb-4">Compare Plans</h1>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">Detailed feature breakdown for every stage of your business.</p>
                    <Link to="/pricing" className="text-blue-600 hover:underline">← Back to Pricing</Link>
                </div>

                {/* Desktop Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-4 border-b-2 border-zinc-200 dark:border-zinc-800 w-1/4">Feature</th>
                                <th className="p-4 border-b-2 border-zinc-200 dark:border-zinc-800 w-1/4 text-center">
                                    <div className="font-bold text-xl mb-1">Launch</div>
                                    <div className="text-sm text-zinc-500">Free</div>
                                </th>
                                <th className="p-4 border-b-2 border-blue-500 w-1/4 text-center bg-blue-50/50 dark:bg-blue-900/10">
                                    <div className="font-bold text-xl mb-1 text-blue-700 dark:text-blue-400">Growth</div>
                                    <div className="text-sm text-zinc-500">$49/mo</div>
                                </th>
                                <th className="p-4 border-b-2 border-zinc-200 dark:border-zinc-800 w-1/4 text-center">
                                    <div className="font-bold text-xl mb-1">Scale</div>
                                    <div className="text-sm text-zinc-500">$129/mo</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {dynamicCategories.map((category) => (
                                <片 key={category.category}>
                                    <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                                        <td colSpan={4} className="p-3 font-semibold text-sm uppercase tracking-wider text-zinc-500 pl-4">
                                            {category.category}
                                        </td>
                                    </tr>
                                    {category.items.map((item, idx) => (
                                        <tr key={item.name} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                            <td className="p-4 font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                {item.name}
                                                {item.name === "Platform Fee" && (
                                                    <div className="group relative">
                                                        <HelpCircle className="w-4 h-4 text-zinc-400 cursor-help" />
                                                        <div className="hidden group-hover:block absolute z-10 w-64 p-2 bottom-full left-1/2 -translate-x-1/2 mb-2 text-xs text-white bg-zinc-900 rounded shadow-lg pointer-events-none">
                                                            A percentage of transaction volume taken by Studio Platform. Does not include Stripe processing fees.
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center text-zinc-600 dark:text-zinc-400">
                                                {renderValue(item.launch)}
                                            </td>
                                            <td className="p-4 text-center font-medium text-zinc-900 dark:text-zinc-100 bg-blue-50/30 dark:bg-blue-900/5">
                                                {renderValue(item.growth)}
                                            </td>
                                            <td className="p-4 text-center text-zinc-600 dark:text-zinc-400">
                                                {renderValue(item.scale)}
                                            </td>
                                        </tr>
                                    ))}
                                </片>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="p-4"></td>
                                <td className="p-4 text-center">
                                    <Link to="/sign-up" className="block w-full py-2 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-medium transition-colors">
                                        Get Started
                                    </Link>
                                </td>
                                <td className="p-4 text-center bg-blue-50/30 dark:bg-blue-900/5">
                                    <Link to="/sign-up" className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
                                        Start Free Trial
                                    </Link>
                                </td>
                                <td className="p-4 text-center">
                                    <Link to="/sign-up" className="block w-full py-2 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg font-medium transition-colors">
                                        Start Free Trial
                                    </Link>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
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

function renderValue(val: string | boolean) {
    if (val === true) return <Check className="w-5 h-5 mx-auto text-green-500" />;
    if (val === false) return <Minus className="w-5 h-5 mx-auto text-zinc-300" />;
    return <span>{val}</span>;
}

// Fragment fix
const 片 = ({ children }: { children: React.ReactNode }) => <>{children}</>;
