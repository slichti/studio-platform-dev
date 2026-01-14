
import { Link } from "react-router";
import { ArrowRight, Smartphone, Settings, Users } from "lucide-react";

export default function HelpIndex() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 font-serif">Welcome to Studio Platform Help</h1>
                <p className="text-xl text-zinc-500 dark:text-zinc-400">
                    Everything you need to know about managing your studio, classes, and mobile app.
                </p>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1 */}
                <Link to="/help/setup" className="group p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Settings size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Studio Setup</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">Learn how to configure your tenant, payment settings, and branding.</p>
                    <div className="flex items-center text-blue-600 font-medium text-sm">
                        Start Guide <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>

                {/* Card 2 */}
                <Link to="/help/mobile-builder" className="group p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Smartphone size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Mobile App Builder</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">Create and publish your own white-label mobile app for iOS and Android.</p>
                    <div className="flex items-center text-purple-600 font-medium text-sm">
                        Learn More <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            </div>
        </div>
    );
}
