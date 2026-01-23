
import { CreditCard, ShoppingCart, Ticket, Tag } from "lucide-react";

export default function CommerceDocs() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Commerce & Finance</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Monetize your studio with flexible membership options, class packs, and a powerful Point of Sale (POS) system.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Memberships & Packs */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <CreditCard className="text-blue-500" /> Memberships & Class Packs
                    </h2>
                    <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400">
                        <p>
                            You can create unlimited membership types and class packs to suit your business model.
                        </p>
                        <div className="grid md:grid-cols-2 gap-6 mt-6 not-prose">
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <h3 className="font-bold text-lg mb-2">Recurring Memberships</h3>
                                <p className="text-sm text-zinc-500 mb-4">Best for loyal students. Auto-renewing subscriptions via Stripe.</p>
                                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                                    <li>• Set billing interval (Weekly, Monthly, Yearly)</li>
                                    <li>• Limit credits per period or Unlimted</li>
                                    <li>• Configure commitment periods</li>
                                </ul>
                            </div>
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <h3 className="font-bold text-lg mb-2">Class Packs</h3>
                                <p className="text-sm text-zinc-500 mb-4">Pre-paid bundles of class credits with an expiration date.</p>
                                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                                    <li>• 5-Class Pack, 10-Class Pack, etc.</li>
                                    <li>• Set expiration (e.g., "Valid for 3 months")</li>
                                    <li>• One-time purchase</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* POS */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <ShoppingCart className="text-green-500" /> Point of Sale (POS)
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        The built-in POS allows you to sell products, water, mats, and memberships directly at the front desk.
                    </p>
                    <ul className="space-y-3">
                        <li className="flex gap-3">
                            <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded text-green-600"><Tag size={16} /></div>
                            <div>
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">Quick Checkout:</span>
                                <span className="text-zinc-500 ml-2">Search for a student, add items to cart, and charge their card on file.</span>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded text-green-600"><Ticket size={16} /></div>
                            <div>
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">Gift Cards:</span>
                                <span className="text-zinc-500 ml-2">Sell and redeem digital gift cards. Balance is tracked automatically.</span>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    );
}
