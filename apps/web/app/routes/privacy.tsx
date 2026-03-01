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

            <main className="max-w-4xl mx-auto px-4 py-20 md:py-32">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Privacy Policy</h1>
                    <p className="text-sm text-zinc-500 mb-12">Last Updated: February 2026</p>

                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <p>
                            Studio Platform ("we", "our", or "us") respects your privacy and is committed to protecting it through our compliance with this policy. This policy describes the types of information we may collect from you or that you may provide when you visit the website or use our application.
                        </p>

                        <h2>1. Information We Collect</h2>
                        <p>We collect several types of information from and about users of our Website, including information:</p>
                        <ul>
                            <li><strong>Personal Information:</strong> Name, email address, phone number, and billing information (processed securely via Stripe).</li>
                            <li><strong>Studio Data:</strong> Information related to your studio, class schedules, instructors, and student lists.</li>
                            <li><strong>Usage Data:</strong> Information about your internet connection, the equipment you use to access our Website, and usage details.</li>
                        </ul>

                        <h2>2. How We Use Your Information</h2>
                        <p>We use information that we collect about you or that you provide to us, including any personal information:</p>
                        <ul>
                            <li>To present our Website and its contents to you.</li>
                            <li>To provide you with information, products, or services that you request from us.</li>
                            <li>To fulfill any other purpose for which you provide it (like processing class bookings).</li>
                            <li>To provide you with notices about your account or subscription.</li>
                            <li>To carry out our obligations and enforce our rights arising from any contracts entered into between you and us, including for billing and collection.</li>
                        </ul>

                        <h2>3. Data Security</h2>
                        <p>
                            We have implemented measures designed to secure your personal information from accidental loss and from unauthorized access, use, alteration, and disclosure. All payment transactions are encrypted using SSL technology and processed by our third-party payment processor, Stripe. We do not store full credit card numbers on our servers.
                        </p>

                        <h2>4. Third-Party Services</h2>
                        <p>
                            We may use third-party service providers to monitor and analyze the use of our Service, perform authentication (Clerk), and process payments (Stripe). These third parties have access to your Personal Information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                        </p>

                        <h2>5. Contact Information</h2>
                        <p>
                            To ask questions or comment about this privacy policy and our privacy practices, contact us at privacy@studioplatform.com.
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
                            <PublicPageRenderer content={page.content} />
                        </Suspense>
                    </ClientOnly>
                </main>
                <PublicFooter />
            </div>
        );
    }

    return <FallbackPrivacyContent />;
}
