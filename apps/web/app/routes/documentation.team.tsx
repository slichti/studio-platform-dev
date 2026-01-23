
import { Users, Shield, DollarSign, CalendarCheck } from "lucide-react";

export default function TeamDocs() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Team & Staff</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Manage your instructors, admins, and front-desk staff. Handle payroll, permissions, and substitution requests.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Roles & Permissions */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <Shield className="text-blue-500" /> Roles & Permissions
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50">
                                <tr>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Access Level</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                <tr className="bg-white dark:bg-zinc-900">
                                    <td className="px-6 py-4 font-semibold">Owner</td>
                                    <td className="px-6 py-4">Full access to everything, including billing and transfers.</td>
                                </tr>
                                <tr className="bg-white dark:bg-zinc-900">
                                    <td className="px-6 py-4 font-semibold">Manager</td>
                                    <td className="px-6 py-4">Can manage classes, students, and settings. No access to bank payouts.</td>
                                </tr>
                                <tr className="bg-white dark:bg-zinc-900">
                                    <td className="px-6 py-4 font-semibold">Instructor</td>
                                    <td className="px-6 py-4">Can view own schedule, manage own rosters, and request subs.</td>
                                </tr>
                                <tr className="bg-white dark:bg-zinc-900">
                                    <td className="px-6 py-4 font-semibold">Front Desk</td>
                                    <td className="px-6 py-4">Can check students in and sell items via POS. No access to financial reports.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Payroll */}
                    <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <DollarSign className="text-green-500" /> Payroll
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            Automate your instructor payouts based on attendance or flat rates.
                        </p>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li>• Flat Rate per Class</li>
                            <li>• Per-Head Bonus (e.g. +$2 per student over 10)</li>
                            <li>• Hourly Rates for Front Desk</li>
                            <li>• Generate Bi-weekly Reports</li>
                        </ul>
                    </section>

                    {/* Substitutions */}
                    <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <CalendarCheck className="text-purple-500" /> Substitution Management
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            Instructors can request a sub directly from the app.
                        </p>
                        <ol className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm list-decimal list-inside">
                            <li>Instructor requests sub for specific class.</li>
                            <li>Notification sent to all eligible instructors.</li>
                            <li>First available instructor accepts.</li>
                            <li>Schedule and Payroll updated automatically.</li>
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
}
