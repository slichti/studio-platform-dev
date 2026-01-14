
import { Link } from "react-router";
import { Settings, CreditCard, Palette, ArrowRight } from "lucide-react";

export default function HelpSetup() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Setting up your Studio</h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Welcome to Studio Platform! This guide will help you configure the essential settings for your studio tenant.
                </p>
            </div>

            <div className="grid gap-6">
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg text-blue-600 dark:text-blue-400">
                            <Settings size={24} />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">General Configuration</h3>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Navigate to <strong>Settings</strong> in the sidebar to access your studio's core configuration.
                                Here you can update your studio name, contact email, and timezone.
                            </p>
                            <ul className="list-disc list-inside text-zinc-500 dark:text-zinc-400 space-y-1 ml-1">
                                <li>Set your Studio Name</li>
                                <li>Configure Support Email</li>
                                <li>Set Timezone and Currency</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg text-green-600 dark:text-green-400">
                            <CreditCard size={24} />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Payments & Payouts</h3>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                To receive payments from your students, you must connect a Stripe account.
                                Go to the <strong>Finances</strong> tab to get started.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg text-purple-600 dark:text-purple-400">
                            <Palette size={24} />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Branding</h3>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Make the platform your own by customizing your brand colors and logos.
                                This branding will appear on your public schedule, booking widgets, and mobile app.
                            </p>
                            <Link to="/help/mobile-builder" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium">
                                Learn about Mobile App Branding <ArrowRight size={14} className="ml-1" />
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
