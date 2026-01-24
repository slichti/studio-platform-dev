import { Layout, Users, Award, Calendar } from "lucide-react";

export default function DocumentationPortal() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Dedicated Student Portal</h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Provide your members with a focused, distraction-free environment to manage their bookings, view achievements, and update their profile.
                </p>
            </div>

            <section className="space-y-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Layout className="text-indigo-500" /> Only What They Need
                </h2>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <p className="mb-4 text-zinc-700 dark:text-zinc-300">
                        The Student Portal is automatically enabled for all students. When a user with only the "Student" role logs in, they are automatically redirected to `https://your-studio.com/portal/your-slug`.
                    </p>
                    <ul className="grid md:grid-cols-2 gap-4">
                        <li className="flex items-start gap-3">
                            <Calendar className="mt-1 text-zinc-400" size={18} />
                            <div>
                                <strong className="block text-zinc-900 dark:text-zinc-100">Simple Scheduling</strong>
                                <span className="text-sm text-zinc-500">Book classes, view upcoming sessions, and join waitlists in one click.</span>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <Award className="mt-1 text-zinc-400" size={18} />
                            <div>
                                <strong className="block text-zinc-900 dark:text-zinc-100">Achievements</strong>
                                <span className="text-sm text-zinc-500">View progress on active challenges like "Attendance Streaks" or "30 Day Challenge".</span>
                            </div>
                        </li>
                    </ul>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">How to Preview</h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                    As an Admin or Owner, you can preview the Student Portal by clicking "View as Student" in the bottom of your sidebar. This will toggle your view without logging you out.
                </p>
            </section>
        </div>
    );
}
