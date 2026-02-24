
import { useOutletContext, Navigate, Link } from "react-router";
import { GraduationCap, Database, ToggleLeft, Settings, FileCode, Globe, CreditCard, BookOpen } from "lucide-react";

export default function DocumentationPlatformCourses() {
    const { isPlatformAdmin } = useOutletContext<{ isPlatformAdmin: boolean }>();

    if (!isPlatformAdmin) {
        return <Navigate to="/documentation" replace />;
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Course Management</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Platform feature for hybrid course offerings combining live sessions, on-demand video, quizzes, and enrollment tracking.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Platform Admin Only */}
                <section className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-2xl border border-blue-200 dark:border-blue-800">
                    <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-3">
                        <Settings className="text-blue-500" /> Platform Admin Only
                    </h2>
                    <p className="text-blue-800 dark:text-blue-300">
                        Course Management must be enabled at the <strong>platform level</strong> before any tenant can activate it.
                        Use the <Link to="/admin/features" className="underline font-medium">Platform Features</Link> toggle to control global availability.
                    </p>
                </section>

                {/* Architecture Overview */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <Database className="text-green-500" /> Architecture Overview
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        The Course Management system introduces two new database entities that sit above the existing class and video infrastructure:
                    </p>
                    <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
                        <li className="flex gap-3">
                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-sm shrink-0">courses</span>
                            <span>Standalone course entity with title, slug, pricing, and status. Links to a default <code>contentCollectionId</code> (video collection) for its on-demand curriculum.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-sm shrink-0">courseEnrollments</span>
                            <span>Tracks a user&apos;s enrollment, progress (0–100%), and completion status per course.</span>
                        </li>
                    </ul>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-6">
                        Individual <strong>live sessions</strong> (classes) are linked via <code>classes.courseId</code>, allowing a course to have multiple scheduled live events as part of its curriculum.
                    </p>
                </section>

                {/* Feature Flag Hierarchy */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <ToggleLeft className="text-purple-500" /> Feature Flag Hierarchy
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Enablement follows a two-tier system:
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Platform Level</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                <code>feature_course_management</code> — Controlled via <Link to="/admin/features" className="underline">Admin → Platform Features</Link>.
                            </p>
                            <p className="text-xs text-zinc-500">When disabled globally, no tenant sidebar shows the Courses link, even if their local flag is set.</p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Tenant Level</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                <code>course_management</code> — Controlled via <Link to="/admin/tenants" className="underline">Admin → Tenants → [Tenant] → Features</Link>.
                            </p>
                            <p className="text-xs text-zinc-500">Platform must be enabled first; this acts as an opt-in on a per-studio basis.</p>
                        </div>
                    </div>
                </section>

                {/* Enabling for a Tenant */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <BookOpen className="text-emerald-500" /> Enabling for a Tenant
                    </h2>
                    <ol className="space-y-3 text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
                        <li>Ensure <code>feature_course_management</code> is <strong>Enabled</strong> on the Platform Features page.</li>
                        <li>Navigate to <strong>Admin → Tenants</strong> and select the target studio.</li>
                        <li>Open the <strong>Features</strong> tab and toggle <strong>Course Management</strong> on.</li>
                        <li>The &quot;Courses&quot; link will appear in the studio&apos;s sidebar immediately.</li>
                    </ol>
                </section>

                {/* API Endpoints & UI Routes */}
                <section className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <FileCode className="text-amber-500" /> API Endpoints
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                        <th className="py-2 pr-4 font-semibold text-zinc-900 dark:text-zinc-100">Method</th>
                                        <th className="py-2 pr-4 font-semibold text-zinc-900 dark:text-zinc-100">Path</th>
                                        <th className="py-2 font-semibold text-zinc-900 dark:text-zinc-100">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="text-zinc-600 dark:text-zinc-400">
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2 pr-4">GET</td><td className="py-2 pr-4 font-mono text-xs">/courses</td><td className="py-2">List all courses</td></tr>
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2 pr-4">POST</td><td className="py-2 pr-4 font-mono text-xs">/courses</td><td className="py-2">Create a new course</td></tr>
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2 pr-4">GET</td><td className="py-2 pr-4 font-mono text-xs">/courses/:id</td><td className="py-2">Get course details</td></tr>
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2 pr-4">PATCH</td><td className="py-2 pr-4 font-mono text-xs">/courses/:id</td><td className="py-2">Update course</td></tr>
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2 pr-4">DELETE</td><td className="py-2 pr-4 font-mono text-xs">/courses/:id</td><td className="py-2">Delete a course</td></tr>
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2 pr-4">POST</td><td className="py-2 pr-4 font-mono text-xs">/courses/:id/enroll</td><td className="py-2">Enroll a user</td></tr>
                                    <tr className=""><td className="py-2 pr-4">POST</td><td className="py-2 pr-4 font-mono text-xs">/courses/:id/progress</td><td className="py-2">Update progress (0–100)</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Globe className="text-blue-500" /> Tenant UI Routes
                        </h2>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">/studio/:slug/courses</code> — Course list and creation</li>
                            <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">/studio/:slug/courses/:id</code> — Course editor and curriculum builder</li>
                        </ul>
                    </div>
                </section>

                {/* Billing */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                        <CreditCard className="text-green-500" /> Billing & Tiers
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Course Management is available on <strong>Scale</strong> tier and above.
                        Platform admins can manually override this for specific tenants using the tenant-level feature flag.
                    </p>
                </section>
            </div>
        </div>
    );
}
