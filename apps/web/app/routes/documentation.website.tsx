
import { Globe, Layout, Code, Search } from "lucide-react";

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
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Custom Meta Titles & Descriptions</li>
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Open Graph Tags (Title, Description, Image) for beautiful social shares</li>
                            <li className="flex gap-2"><span className="text-blue-500">✓</span> Automatic Sitemap Generation</li>
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
            </div>
        </div>
    );
}
