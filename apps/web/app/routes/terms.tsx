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

            <main className="max-w-4xl mx-auto px-4 py-20 md:py-32">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Terms of Service</h1>
                    <p className="text-sm text-zinc-500 mb-12">Last Updated: February 2026</p>

                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <p>
                            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Studio Platform website or application (the "Service") operated by Studio Platform ("us", "we", or "our").
                        </p>
                        <p>
                            Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, studio owners, instructors, and others who access or use the Service.
                        </p>

                        <h2>1. Subscriptions and Billing</h2>
                        <p>
                            Some parts of the Service are billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring and periodic basis ("Billing Cycle"). Billing cycles are set either on a monthly or annual basis, depending on the type of subscription plan you select when purchasing a Subscription.
                        </p>
                        <p>
                            A valid payment method, including credit card, is required to process the payment for your Subscription. You shall provide Studio Platform with accurate and complete billing information including full name, address, state, zip code, telephone number, and a valid payment method information.
                        </p>

                        <h2>2. Content and Studio Data</h2>
                        <p>
                            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.
                        </p>
                        <p>
                            By posting Content to the Service, you grant us the right and license to store, process, and display that Content in order to provide the Service to you and your students. You retain any and all of your rights to any Content you submit, post or display on or through the Service and you are responsible for protecting those rights.
                        </p>

                        <h2>3. User Accounts</h2>
                        <p>
                            When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                        </p>
                        <p>
                            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service. We use authentication providers (such as Clerk) to secure your account.
                        </p>

                        <h2>4. Termination</h2>
                        <p>
                            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or cancel your subscription in the billing portal.
                        </p>

                        <h2>5. Limitation Of Liability</h2>
                        <p>
                            In no event shall Studio Platform, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.
                        </p>

                        <h2>6. Changes</h2>
                        <p>
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
                            <PublicPageRenderer content={page.content} />
                        </Suspense>
                    </ClientOnly>
                </main>
                <PublicFooter />
            </div>
        );
    }

    return <FallbackTermsContent />;
}
