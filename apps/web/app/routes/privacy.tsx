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
        { title: "Privacy Policy – Studio Platform" },
        { name: "description", content: "Privacy Policy for Studio Platform. Learn how we collect, use, and protect your data." },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    try {
        const apiUrl = process.env.API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/platform-pages/pages/privacy`);
        if (res.ok) {
            const page = await res.json();
            return { page, hasCustomPage: true };
        }
    } catch (e) {
        console.error("Failed to fetch custom privacy page:", e);
    }

    return { page: null, hasCustomPage: false };
}

function FallbackPrivacyContent() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <PublicNav />

            {/* Header Section */}
            <section className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 pt-24 pb-12 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-pink-500/5 pointer-events-none" />
                <div className="max-w-5xl mx-auto relative relative">
                    <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Privacy Policy</h1>
                    <p className="text-lg text-zinc-500 dark:text-zinc-400">Last Updated: February 2026</p>
                </div>
            </section>

            <main className="max-w-5xl mx-auto px-4 py-16 flex flex-col md:flex-row gap-12">
                {/* Sidebar Table of Contents */}
                <div className="md:w-64 flex-shrink-0">
                    <div className="sticky top-24 bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">In this policy</h3>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#information" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">1. Information We Collect</a></li>
                            <li><a href="#usage" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">2. How We Use Information</a></li>
                            <li><a href="#security" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">3. Data Security</a></li>
                            <li><a href="#third-party" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">4. Third-Party Services</a></li>
                            <li><a href="#contact" className="text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">5. Contact Information</a></li>
                        </ul>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-10">
                            Studio Platform ("we", "our", or "us") respects your privacy and is committed to protecting it through our compliance with this policy. This policy describes the types of information we may collect from you or that you may provide when you visit the website or use our application.
                        </p>

                        <h2 id="information" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-sm font-bold m-0">1</span>
                            Information We Collect
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">We collect several types of information from and about users of our Website, including information:</p>
                        <ul className="text-zinc-600 dark:text-zinc-400 marker:text-indigo-400">
                            <li><strong className="text-zinc-900 dark:text-zinc-100">Personal Information:</strong> Name, email address, phone number, and billing information (processed securely via Stripe).</li>
                            <li><strong className="text-zinc-900 dark:text-zinc-100">Studio Data:</strong> Information related to your studio, class schedules, instructors, and student lists.</li>
                            <li><strong className="text-zinc-900 dark:text-zinc-100">Usage Data:</strong> Information about your internet connection, the equipment you use to access our Website, and usage details.</li>
                        </ul>

                        <h2 id="usage" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400 text-sm font-bold m-0">2</span>
                            How We Use Your Information
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">We use information that we collect about you or that you provide to us, including any personal information:</p>
                        <ul className="text-zinc-600 dark:text-zinc-400 marker:text-pink-400">
                            <li>To present our Website and its contents to you.</li>
                            <li>To provide you with information, products, or services that you request from us.</li>
                            <li>To fulfill any other purpose for which you provide it (like processing class bookings).</li>
                            <li>To provide you with notices about your account or subscription.</li>
                            <li>To carry out our obligations and enforce our rights arising from any contracts entered into between you and us, including for billing and collection.</li>
                        </ul>

                        <h2 id="security" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-sm font-bold m-0">3</span>
                            Data Security
                        </h2>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-100 dark:border-zinc-800 my-6 not-prose">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                We have implemented measures designed to secure your personal information from accidental loss and from unauthorized access, use, alteration, and disclosure. All payment transactions are encrypted using SSL technology and processed by our third-party payment processor, Stripe. We do not store full credit card numbers on our servers.
                            </p>
                        </div>

                        <h2 id="third-party" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-bold m-0">4</span>
                            Third-Party Services
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            We may use third-party service providers to monitor and analyze the use of our Service, perform authentication (Clerk), and process payments (Stripe). These third parties have access to your Personal Information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                        </p>

                        <h2 id="contact" className="scroll-mt-24 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 mt-12">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-sm font-bold m-0">5</span>
                            Contact Information
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            To ask questions or comment about this privacy policy and our privacy practices, contact us at <a href="mailto:privacy@studioplatform.com" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">privacy@studioplatform.com</a>.
                        </p>
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}

export default function PrivacyPage() {
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

    return <FallbackPrivacyContent />;
}
