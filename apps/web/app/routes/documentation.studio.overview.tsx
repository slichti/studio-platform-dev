
import { CreditCard, Calendar, Users, BarChart3, ArrowRight } from "lucide-react";
import { Link } from "react-router";

export default function StudioOverview() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero */}
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Studio Owner Guide</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Everything you need to successfully run your studio, manage memberships, and grow your community.
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Create Class", icon: Calendar, href: "/documentation/classes", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Connect Stripe", icon: CreditCard, href: "/documentation/setup", color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Get Mobile App", icon: Users, href: "/documentation/mobile-builder", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
                    { label: "View Reports", icon: BarChart3, href: "/documentation", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
                ].map((action, i) => (
                    <Link
                        key={i}
                        to={action.href}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group flex items-center gap-3 bg-white dark:bg-zinc-900"
                    >
                        <div className={`p-2 rounded-lg ${action.bg} ${action.color}`}>
                            <action.icon size={20} />
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{action.label}</span>
                    </Link>
                ))}
            </div>

            {/* Main Sections */}
            <div className="grid gap-12">
                <section>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Managing Your Business</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                                <Users className="text-blue-500" size={20} />
                                Members & Students
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Learn how to manage student profiles, view attendance history, and handle membership statuses.
                            </p>
                            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                <li>• Importing students from CSV</li>
                                <li>• Assigning memberships</li>
                                <li>• Tracking waivers and liability forms</li>
                            </ul>
                            <Link to="/documentation" className="text-blue-600 font-medium inline-flex items-center text-sm hover:underline">
                                Read Guide <ArrowRight size={14} className="ml-1" />
                            </Link>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                                <CreditCard className="text-green-500" size={20} />
                                Payments & Billing
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Understand how payments work, how to set up memberships, and how payouts are processed.
                            </p>
                            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                <li>• Creating recurring memberships</li>
                                <li>• Setting up drop-in rates</li>
                                <li>• Using the Point of Sale (POS)</li>
                            </ul>
                            <Link to="/documentation/setup" className="text-blue-600 font-medium inline-flex items-center text-sm hover:underline">
                                Payment Setup <ArrowRight size={14} className="ml-1" />
                            </Link>
                        </div>
                    </div>
                </section>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                <section>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Growth & Retention</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="md:flex gap-8 items-start">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold mb-2">Automated Marketing</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                    Set up automated email campaigns to welcome new students, nurture leads, and win back inactive members.
                                </p>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold mb-2">Referral Program</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                    Reward your loyal students for bringing friends. configure reward amounts and tracking.
                                </p>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold mb-2">Branded Mobile App</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                    Launch your own iOS and Android app to increase engagement and bookings.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
