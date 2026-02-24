
import { ShoppingCart, LayoutDashboard, Sparkles } from "lucide-react";

export default function ClassPacksGuide() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Setup Class Packs</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Create flexible pricing options like &quot;10 Class Pack&quot; or drop-ins so students can buy credits and book classes.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Overview */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <ShoppingCart className="text-blue-500" /> Overview
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        Class Packs allow students to purchase a set number of credits to book classes. Unlike recurring memberships, these are one-time purchases (though they can have expiration dates).
                    </p>
                </section>

                {/* Step-by-step */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <LayoutDashboard className="text-purple-500" /> How to Create a Class Pack
                    </h2>

                    <div className="space-y-8">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <span className="font-bold text-blue-600 dark:text-blue-400">1</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Go to Commerce</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                    Navigate to <strong>Commerce</strong> → <strong>Packs & Retail</strong> in your studio sidebar.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <span className="font-bold text-blue-600 dark:text-blue-400">2</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Create New Pack</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                    Click the &quot;Create Product&quot; button and select <strong>Class Pack</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <span className="font-bold text-blue-600 dark:text-blue-400">3</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Configure Details</h3>
                                <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                                    <li><strong>Name:</strong> e.g., &quot;10 Class Summer Pack&quot;</li>
                                    <li><strong>Credits:</strong> How many classes does this buy? (e.g., 10)</li>
                                    <li><strong>Price:</strong> Total price (e.g., $150)</li>
                                    <li><strong>Expiration:</strong> (Optional) Set to expire 3, 6, or 12 months after purchase.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <span className="font-bold text-blue-600 dark:text-blue-400">4</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Save</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                    Hit Save. The pack is now available for purchase on your public page and mobile app.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Tip */}
                <section className="bg-amber-50 dark:bg-amber-900/20 p-8 rounded-2xl border border-amber-200 dark:border-amber-800">
                    <h2 className="text-xl font-bold text-amber-900 dark:text-amber-300 mb-4 flex items-center gap-3">
                        <Sparkles className="text-amber-500" /> Pricing Tip
                    </h2>
                    <p className="text-amber-800 dark:text-amber-300">
                        Class packs usually offer a discount per class compared to a drop-in rate. Make sure to highlight this value in your marketing and on your public schedule.
                    </p>
                </section>
            </div>
        </div>
    );
}
