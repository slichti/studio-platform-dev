
import { type LoaderFunctionArgs, type MetaFunction } from "react-router";

import { Link, useLoaderData } from "react-router";
import { SignedIn, SignedOut, useUser } from "@clerk/react-router";
import { PublicNav } from "~/components/PublicNav";
import { PublicFooter } from "~/components/PublicFooter";
import { ChatWidget } from "~/components/chat/ChatWidget";
import { getStudioPage, getSubdomain } from "~/utils/subdomain.server";
import { lazy, Suspense } from "react";
const PublicPageRenderer = lazy(() => import("~/components/website/PublicPageRenderer.client").then(m => ({ default: m.PublicPageRenderer })));
import { ClientOnly } from "~/components/ClientOnly";

export const meta: MetaFunction = ({ data }: any) => {
    if (data?.isStudioPage && data?.page) {
        return [
            { title: data.page.seoTitle || data.page.title },
            { name: "description", content: data.page.seoDescription || "" },
        ];
    }
    return [
        { title: "Studio Platform – Yoga Studio & Small Gym Management" },
        { name: "description", content: "Yoga studio management platform and small gym management software. Schedule classes, manage memberships, process payments, and grow your fitness business. Yoga studio management in Ann Arbor, New York, and everywhere." },
        { name: "keywords", content: "yoga studio management, small gym management, fitness studio software, studio management platform, yoga studio management platform, small gym hosting and management portal, class scheduling, membership billing" },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const studioOverride = url.searchParams.get("__studio");
    const subdomain = getSubdomain(request) || studioOverride;

    if (subdomain) {
        // Fetch the 'home' page for this studio
        const page = await getStudioPage(subdomain, 'home');
        if (page) {
            return {
                isStudioPage: true,
                page,
                tenantSlug: subdomain
            };
        }
        // If subdomain exists but no home page, we could 404 or fall through
        // For now, let's returned a limited state or fall through to platform home (maybe with a warning?)
        // Better to fall through for now if not found, or maybe standard 404?
        // Let's assume valid studio subdomain should have a home page.
    }

    return {
        isStudioPage: false,
        page: null,
        tenantSlug: null
    };
}

export default function Index() {
    const { user } = useUser();
    const data = useLoaderData<typeof loader>();

    // If it's a studio page, render that instead of platform home
    if (data.isStudioPage && data.page) {
        return (
            <ClientOnly>
                <Suspense fallback={
                    <div className="flex h-screen items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-black border-r-2" />
                    </div>
                }>
                    <PublicPageRenderer page={data.page} tenantSlug={data.tenantSlug || ""} />
                </Suspense>
            </ClientOnly>
        );
    }

    return (
        <div className="font-sans min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
            <PublicNav />

            {/* JSON-LD for SEO */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        name: "Studio Platform",
                        applicationCategory: "BusinessApplication",
                        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                        description: "Yoga studio management software and small gym management platform. Schedule classes, manage memberships, process payments, and grow your fitness business.",
                        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", ratingCount: "100" },
                        operatingSystem: "Web",
                    }),
                }}
            />
            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-6 py-24 text-center">
                <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent pb-2">
                    Yoga Studio & Small Gym Management
                </h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                    Yoga studio management and small gym hosting platform. Schedule classes, manage memberships,
                    process payments, and route students into your business—all in one place.
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
                        { title: "Instructor Portal", desc: "Give your instructors access to their schedules and rosters." },
                        { title: "Point of Sale", desc: "Integrated retail checkout with support for credit card terminals and inventory management." },
                        { title: "Family Accounts", desc: "Link family members, share payment methods, and manage bookings for children." },
                        { title: "Marketing CRM", desc: "Automated email campaigns, lead tracking, and retention tools to grow your studio." }
                    ].map((feature, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-950 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>


            {/* Security Section */}
            <div className="py-24 px-6 border-t border-zinc-100 dark:border-zinc-800">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-white">Enterprise-Grade Security</h2>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                        Security is our top priority. We use industry-leading Identity Providers (IDPs) like Google and Apple
                        to handle your authentication. This means we <strong>never</strong> store your passwords or sensitive login credentials.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">No Stored Passwords</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                By relying on secure IDPs, we eliminate the risk of password leaks from our databases. Your credentials stay with the providers you trust.
                            </p>
                        </div>
                        <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-900/30">
                            <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Advanced Protection</h3>
                            <p className="text-sm text-purple-700 dark:text-purple-400">
                                Benefit from the multi-factor authentication (MFA) and anomaly detection systems of major identity providers automatically.
                            </p>
                        </div>
                    </div>

                    <div className="mt-12 text-left">
                        <div className="p-8 bg-white dark:bg-zinc-900 rounded-xl text-zinc-900 dark:text-white shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold mb-3 flex items-center gap-2">
                                        Powered by Stripe Connect
                                    </h3>
                                    <p className="opacity-90 leading-relaxed mb-4 text-zinc-600 dark:text-zinc-300">
                                        We use Stripe to handle all payment processing. This means we never see or store your credit card information, ensuring full <strong>PCI Compliance</strong> from day one.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-4 mt-6">
                                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                            <strong className="block mb-1">Bring Your Own Stripe</strong>
                                            <span className="text-sm opacity-80 text-zinc-600 dark:text-zinc-400">Connect your existing Stripe account to keep your history, or create a new one that you fully own and control.</span>
                                        </div>
                                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                            <strong className="block mb-1">Direct Payouts</strong>
                                            <span className="text-sm opacity-80 text-zinc-600 dark:text-zinc-400">Funds flow directly to your bank account. We don't hold your money.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <PublicFooter />
            <ChatWidget
                roomId={user ? `support-${user.id}` : "support-guest"}
                tenantId="platform"
                userId={user?.id}
                userName={user?.fullName || "Guest"}
            />
        </div>
    );
}

