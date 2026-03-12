
import { Link, useOutletContext } from "react-router";
import { ArrowRight, Smartphone, Settings, Users, GraduationCap, Layout, Shield } from "lucide-react";
import { getDocVisibility } from "../utils/docsIndex";

export default function HelpIndex() {
    const ctx = useOutletContext<{ isPlatformAdmin?: boolean; user?: { tenants?: { roles: string[] }[] } }>();
    const visibility = getDocVisibility(ctx?.user ?? {});

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 font-serif">Welcome to Studio Platform Documentation</h1>
                <p className="text-xl text-zinc-500 dark:text-zinc-400">
                    Everything you need to know about managing your studio, classes, and mobile app.
                </p>
            </div>

            {/* Role-based quick links — only show sections the user can access */}
            <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">Find your role</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {visibility.hasPlatformAdmin && (
                        <Link to="/documentation/platform/architecture" className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                <Shield size={20} />
                            </div>
                            <div>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Platform Admin</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Architecture, tenants, RBAC</p>
                            </div>
                            <ArrowRight size={16} className="ml-auto text-zinc-400 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    )}
                    {(visibility.hasOwner || visibility.hasAdmin) && (
                        <Link to="/documentation/studio/overview" className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                                <Users size={20} />
                            </div>
                            <div>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Studio Owner / Admin</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Run your studio, reports, settings</p>
                            </div>
                            <ArrowRight size={16} className="ml-auto text-zinc-400 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    )}
                    {visibility.hasInstructor && (
                        <Link to="/documentation/instructors" className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                                <GraduationCap size={20} />
                            </div>
                            <div>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Instructor</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Schedule, rosters, check-in</p>
                            </div>
                            <ArrowRight size={16} className="ml-auto text-zinc-400 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    )}
                    <Link to="/documentation/studio/portal" className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                            <Layout size={20} />
                        </div>
                        <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Student Portal</span>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Book classes, profile, progress</p>
                        </div>
                        <ArrowRight size={16} className="ml-auto text-zinc-400 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1 */}
                <Link to="/documentation/setup" className="group p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all">
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
                <Link to="/documentation/mobile-builder" className="group p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all">
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
