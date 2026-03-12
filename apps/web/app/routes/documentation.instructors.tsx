
import { Calendar, Users, UserCheck, ArrowRight, Settings, BookOpen, ShoppingCart } from "lucide-react";
import { Link } from "react-router";

export default function InstructorsDoc() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">For Instructors</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Use the studio from a teaching perspective: your schedule, rosters, check-in, substitutions, and what you can do on behalf of students.
                </p>
            </div>

            {/* Quick links */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "My Teaching Schedule", icon: Calendar, href: "/documentation/classes", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Classes & Rosters", icon: Users, href: "/documentation/classes", color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Check-in & Attendance", icon: UserCheck, href: "/documentation/classes", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
                    { label: "Memberships & POS", icon: ShoppingCart, href: "/documentation/commerce", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
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

            {/* Teaching schedule */}
            <section>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                    <Calendar className="text-blue-500" size={24} />
                    My Teaching Schedule
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    In the studio app, use <strong>Schedule</strong> or <strong>My Teaching Schedule</strong> to see only the classes you are assigned to teach. You can view by day, week, or month and quickly open a class to see its roster or run check-in.
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                    If you are covering for another instructor, your studio may use <strong>substitutions</strong>: you appear as the covering instructor for that session. Substitution assignments are managed by owners or admins.
                </p>
            </section>

            {/* Rosters & check-in */}
            <section>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                    <Users className="text-green-500" size={24} />
                    Rosters & Check-in
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    What you can do with class rosters and check-in depends on your studio’s <strong>instructor permissions</strong>, set by owners or admins under <strong>Settings → Class Management → Instructor Permissions</strong>.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400 mb-4">
                    <li><strong>View rosters</strong> – When enabled, you can see who is registered for classes you teach (and only those classes).</li>
                    <li><strong>Manage enrollments</strong> – When enabled, you can add or remove students and check them in for <strong>your own</strong> classes.</li>
                    <li><strong>Check-in any class</strong> – When enabled, you can check in students for any class at the studio, not just the ones you teach (e.g. for front-desk or kiosk coverage).</li>
                </ul>
                <p className="text-zinc-600 dark:text-zinc-400">
                    If a setting is off, the app will hide roster and check-in actions from you for those classes. <Link to="/documentation/classes" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Classes & Rosters</Link> covers the schedule and roster workflows in more detail.
                </p>
            </section>

            {/* Booking on behalf */}
            <section>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                    <BookOpen className="text-purple-500" size={24} />
                    Booking on Behalf of Students
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    When your studio allows it, you can <strong>book classes for students</strong> (e.g. at the front desk or when a student calls). This uses the same rules as the student: packs, memberships, and capacity apply. Your actions may be logged for audit purposes.
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                    If you don’t see “book for member” or similar options, the studio has not enabled this for instructors. Owners and admins can control who can book on behalf of others in settings.
                </p>
            </section>

            {/* Class settings (instructor-specific) */}
            <section>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                    <Settings className="text-orange-500" size={24} />
                    Instructor Permissions (Studio Settings)
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    These options are configured by <strong>owners or admins</strong> only. They control what instructors can do without granting full admin access:
                </p>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 text-sm">
                    <p><strong>Instructor can view rosters</strong> – View the list of registered students for classes they teach.</p>
                    <p><strong>Instructor can manage enrollments</strong> – Add/remove students and check them in for their own classes.</p>
                    <p><strong>Instructor can check-in any class</strong> – Check-in students for any class (e.g. kiosk or front desk).</p>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 mt-4">
                    If something you expect (e.g. roster or check-in) is missing, ask your studio owner or admin to review these settings.
                </p>
            </section>

            {/* POS & commerce */}
            <section>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                    <ShoppingCart className="text-blue-500" size={24} />
                    Point of Sale & Memberships
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    Instructors with <strong>POS</strong> access can run in-studio sales: drop-ins, class packs, products, and gift cards. You typically cannot create or edit membership plans, pack definitions, or pricing—those are admin/owner tasks. See <Link to="/documentation/commerce" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Memberships & POS</Link> for workflows.
                </p>
            </section>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            <section>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Related docs</h2>
                <ul className="space-y-2">
                    <li>
                        <Link to="/documentation/classes" className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1 hover:underline">
                            Classes & Rosters <ArrowRight size={14} />
                        </Link>
                        — Scheduling, recurrence, virtual classes, rosters
                    </li>
                    <li>
                        <Link to="/documentation/commerce" className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1 hover:underline">
                            Memberships & POS <ArrowRight size={14} />
                        </Link>
                        — Subscriptions, packs, POS, checkout
                    </li>
                </ul>
            </section>
        </div>
    );
}
