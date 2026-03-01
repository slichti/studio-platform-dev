import { useLoaderData, type MetaFunction, type LoaderFunctionArgs } from "react-router";
import { PublicNav } from "~/components/PublicNav";
import { PublicFooter } from "~/components/PublicFooter";
import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";
import { Globe, Heart, Shield, Users } from "lucide-react";

const PublicPageRenderer = lazy(() => import("~/components/website/PublicPageRenderer.client").then(m => ({ default: m.PublicPageRenderer })));

export const meta: MetaFunction = ({ data }: any) => {
    if (data?.page) {
        return [
            { title: data.page.seoTitle || data.page.title },
            { name: "description", content: data.page.seoDescription || "" },
        ];
    }
    return [
        { title: "About Us – Studio Platform | Yoga Studio & Gym Management" },
        { name: "description", content: "Learn about Studio Platform's mission to empower local fitness studios, yoga spaces, and wellness centers with beautiful, modern management software." },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    // Attempt to fetch custom platform page content
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    try {
        const apiUrl = process.env.API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/platform-pages/pages/about`);
        if (res.ok) {
            const page = await res.json();
            return { page, hasCustomPage: true };
        }
    } catch (e) {
        console.error("Failed to fetch custom about page:", e);
    }

    return { page: null, hasCustomPage: false };
}

function FallbackAboutContent() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <PublicNav />

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5" />
                <div className="max-w-4xl mx-auto px-4 py-24 md:py-32 relative text-center">
                    <h1 className="text-4xl md:text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
                        Empowering independent studios to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">thrive</span>.
                    </h1>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl mx-auto">
                        We believe that local yoga studios, gyms, and wellness centers are the heartbeat of our communities. We built Studio Platform to give them the modern tools they deserve.
                    </p>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Our Mission</h2>
                            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                                For too long, studio owners have been forced to choose between clunky legacy software or piecing together a dozen expensive tools just to run their business.
                            </p>
                            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Studio Platform changes that. We provide an all-in-one, beautifully designed operating system that handles everything from class scheduling and automatic billing to website building and point-of-sale — so owners can focus on what they do best: teaching and building community.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                                <Heart className="w-10 h-10 text-pink-500 mb-4" />
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Community First</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Tools designed specifically to foster connection.</p>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 mt-8">
                                <Users className="w-10 h-10 text-blue-500 mb-4" />
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Built for Growth</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Marketing and CRM tools that fill your classes.</p>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 -mt-8">
                                <Shield className="w-10 h-10 text-green-500 mb-4" />
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Reliable & Secure</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Enterprise-grade infrastructure you can trust.</p>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                                <Globe className="w-10 h-10 text-purple-500 mb-4" />
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Modern Design</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm">A premium experience for you and your students.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </div>
    );
}

export default function AboutPage() {
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

    return <FallbackAboutContent />;
}
