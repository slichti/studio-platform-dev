import { useLoaderData, type MetaFunction, type LoaderFunctionArgs } from "react-router";
import { PublicNav } from "~/components/PublicNav";
import { PublicFooter } from "~/components/PublicFooter";
import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const PublicPageRenderer = lazy(() => import("~/components/website/PublicPageRenderer.client").then(m => ({ default: m.PublicPageRenderer })));

export const meta: MetaFunction = ({ data }: any) => {
    if (data?.page) {
        return [
            { title: data.page.seoTitle || data.page.title },
            { name: "description", content: data.page.seoDescription || "" },
        ];
    }
    return [
        { title: "Terms of Service – Studio Platform" },
        { name: "description", content: "Terms of Service for Studio Platform." },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    try {
        const apiUrl = process.env.API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/platform-pages/pages/terms`);
        if (res.ok) {
            const page = await res.json();
            return { page, hasCustomPage: true };
        }
    } catch (e) {
        console.error("Failed to fetch custom terms page:", e);
    }

    return { page: null, hasCustomPage: false };
}

function FallbackTermsContent() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <PublicNav />

            {/* Header Section */}
            <section className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 pt-24 pb-12 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-pink-500/5 pointer-events-none" />
                <div className="max-w-5xl mx-auto relative relative">
                    <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Terms of Service</h1>
                    <p className="text-lg text-zinc-500 dark:text-zinc-400">Last Updated: February 2026</p>
                </div>
            </section>

            <main className="max-w-5xl mx-auto px-4 py-16 flex flex-col md:flex-row gap-12">
                {/* Sidebar Table of Contents */}
                <div className="md:w-64 flex-shrink-0">
                    <div className="sticky top-24 bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">In these terms</h3>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#billing" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">1. Subscriptions & Billing</a></li>
                            <li><a href="#content" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">2. Content & Studio Data</a></li>
                            <li><a href="#accounts" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">3. User Accounts</a></li>
                            <li><a href="#termination" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">4. Termination</a></li>
                            <li><a href="#liability" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">5. Limitation of Liability</a></li>
                            <li><a href="#changes" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">6. Changes to Terms</a></li>
                        </ul>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Studio Platform website or application (the "Service") operated by Studio Platform ("us", "we", or "our").
                        </p>
                        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-10">
                            Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, studio owners, instructors, and others who access or use the Service.
                        </p>

                        <h2 id="billing" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-sm font-bold m-0">1</span>
                            Subscriptions and Billing
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Some parts of the Service are billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring and periodic basis ("Billing Cycle"). Billing cycles are set either on a monthly or annual basis, depending on the type of subscription plan you select when purchasing a Subscription.
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            A valid payment method, including credit card, is required to process the payment for your Subscription. You shall provide Studio Platform with accurate and complete billing information including full name, address, state, zip code, telephone number, and a valid payment method information.
                        </p>

                        <h2 id="content" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400 text-sm font-bold m-0">2</span>
                            Content and Studio Data
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            By posting Content to the Service, you grant us the right and license to store, process, and display that Content in order to provide the Service to you and your students. You retain any and all of your rights to any Content you submit, post or display on or through the Service and you are responsible for protecting those rights.
                        </p>

                        <h2 id="accounts" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-sm font-bold m-0">3</span>
                            User Accounts
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service. We use authentication providers (such as Clerk) to secure your account.
                        </p>

                        <h2 id="termination" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold m-0">4</span>
                            Termination
                        </h2>
                        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl border border-red-100 dark:border-red-900/30 my-6 not-prose">
                            <p className="text-zinc-600 dark:text-zinc-400 m-0">
                                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or cancel your subscription in the billing portal.
                            </p>
                        </div>

                        <h2 id="liability" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-sm font-bold m-0">5</span>
                            Limitation Of Liability
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            In no event shall Studio Platform, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.
                        </p>

                        <h2 id="changes" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-bold m-0">6</span>
                            Changes
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                        </p>
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}

export default function TermsPage() {
    const { hasCustomPage, page } = useLoaderData<typeof loader>();

    if (hasCustomPage && page) {
        return (
            <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
                <PublicNav />
                <main className="flex-1">
                    <ClientOnly fallback={<div className="h-64 flex items-center justify-center">Loading content...</div>}>
                        <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading content...</div>}>
                            <PublicPageRenderer page={page} tenantSlug="platform" isPlatformPage={true} />
                        </Suspense>
                    </ClientOnly>
                </main>
                <PublicFooter />
            </div>
        );
    }

    return <FallbackTermsContent />;
}
