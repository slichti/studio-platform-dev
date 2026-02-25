
import { Globe, Layout, Code, Search, MapPin } from "lucide-react";

export default function WebsiteDocs() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Website Builder</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Create a stunning, SEO-optimized website for your studio without writing a single line of code.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Visual Editor */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <Layout className="text-purple-500" /> Visual Editor
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Our drag-and-drop editor allows you to build pages using pre-designed blocks optimized for conversion.
                    </p>

                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <strong>Hero Sections:</strong> High-impact headers with video backgrounds or image sliders.
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <strong>Feature Grids:</strong> Showcase your amenities, class types, or instructors.
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <strong>Pricing Tables:</strong> clear comparison of your membership options.
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 col-span-full md:col-span-1">
                            <strong>Testimonials:</strong> Horizontal scroll carousel for student success stories.
                        </div>
                    </div>
                </section>

                {/* SEO & Domains */}
                <section className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Search className="text-blue-500" /> SEO Optimization
                        </h2>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Custom Meta Titles & Descriptions (with length validation)</li>
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Open Graph Tags (Title, Description, Image) for beautiful social shares</li>
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Automatic Sitemap Generation &amp; per-tenant robots.txt overlay</li>
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Fast Loading (Edge Cached)</li>
                        </ul>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Code className="text-orange-500" /> Widgets & Embeds
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            Already have a website? No problem.
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                            Use our <strong>Embed Code</strong> generator to place your Schedule, Class List, or Checkout flow directly onto your existing WordPress, Squarespace, or Wix site.
                        </p>
                    </div>
                </section>

                {/* Tenant SEO – Route Students Into Your Business */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                        <MapPin className="text-emerald-500" /> Tenant SEO: Route Students Into Your Studio
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Every tenant can perform SEO work themselves to route students, customers, and clients into their business. Use the Website Builder settings to customize how your studio appears in search results.
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                            <strong className="text-emerald-900 dark:text-emerald-300">Location-Based Search</strong>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                                Add your city and neighborhood to meta titles and descriptions (e.g. &quot;Yoga Studio in Ann Arbor&quot;, &quot;Pilates in Brooklyn&quot;) so local searchers find you when they Google &quot;yoga studio [city]&quot; or &quot;pilates near me&quot;.
                            </p>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                            <strong className="text-emerald-900 dark:text-emerald-300">Self-Service Controls</strong>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                                In <strong>Settings → SEO &amp; Discoverability</strong>, set default meta title, description, and local service area. Optionally add paths to hide from search engines (e.g. <code className="text-xs">/draft</code>, <code className="text-xs">/preview</code>) so they appear in the platform robots.txt. Use <strong>Marketing → Reviews</strong> for AI-generated reply drafts to Google reviews.
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-4">
                        Your public schedule, class list, and booking flow are all indexable. Embed widgets on your own domain to route traffic into your tenant—or use our hosted pages with your custom domain.
                    </p>
                </section>
            </div>
        </div>
    );
}
