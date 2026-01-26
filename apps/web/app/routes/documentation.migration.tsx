import { useOutletContext, Link } from "react-router";
import { ArrowRight, FileText, Database, CheckCircle, Smartphone } from "lucide-react";

export default function MigrationDocs() {
    const { isPlatformAdmin } = useOutletContext<any>();

    return (
        <div className="max-w-4xl animate-in fade-in duration-500">
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium mb-3">
                    <Database size={16} />
                    <span>Migration & Setup</span>
                </div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Migrating to Studio Platform</h1>
                <p className="text-xl text-zinc-500 dark:text-zinc-400 mt-4 leading-relaxed">
                    A comprehensive guide to moving your data from other systems like Arketa, HeyMarvelous, or FitDegree into Studio Platform.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-6">
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2">
                        <CheckCircle size={18} /> Why migrate?
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        Studio Platform offers unified booking, payments, and marketing. Bringing your history allows you to retain member loyalty and streaks.
                    </p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-2">
                        <FileText size={18} /> Supported Data
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        We currently support importing **Users**, **Memberships**, and **Class Schedules** via CSV.
                    </p>
                </div>
            </div>

            <div className="space-y-12">
                {/* General CSV Format */}
                <section>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Universal CSV Format</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Regardless of where you are coming from, formatting your data into our standard CSV structure ensures a smooth import.
                    </p>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-800/20">
                            <h3 className="font-semibold text-sm font-mono">users.csv</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-zinc-500 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">email <span className="text-red-500">*</span></th>
                                        <th className="px-6 py-3 font-medium">firstname <span className="text-red-500">*</span></th>
                                        <th className="px-6 py-3 font-medium">lastname <span className="text-red-500">*</span></th>
                                        <th className="px-6 py-3 font-medium">membership</th>
                                        <th className="px-6 py-3 font-medium">phone</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-zinc-600 dark:text-zinc-400">jane@example.com</td>
                                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">Jane</td>
                                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">Doe</td>
                                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">Unlimited Monthly</td>
                                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">+15550123456</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Specific Guides */}
                <section>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Platform-Specific Guides</h2>

                    <div className="grid gap-6">
                        {/* Arketa */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 hover:shadow-lg transition-shadow bg-white dark:bg-zinc-900">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Migrating from Arketa</h3>
                            <ol className="list-decimal pl-5 space-y-2 text-zinc-600 dark:text-zinc-400">
                                <li>Go to <strong>Client List</strong> in your Arketa dashboard.</li>
                                <li>Click <strong>Export CSV</strong>.</li>
                                <li>Rename the <code>Client Email</code> column to <code>email</code>.</li>
                                <li>Rename <code>First Name</code> to <code>firstname</code> and <code>Last Name</code> to <code>lastname</code>.</li>
                                <li>Upload the file in the Studio Platform onboarding wizard.</li>
                            </ol>
                        </div>

                        {/* HeyMarvelous */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 hover:shadow-lg transition-shadow bg-white dark:bg-zinc-900">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Migrating from HeyMarvelous</h3>
                            <ol className="list-decimal pl-5 space-y-2 text-zinc-600 dark:text-zinc-400">
                                <li>Navigate to <strong>Students</strong> tab.</li>
                                <li>Select "All Students" and click <strong>Export</strong>.</li>
                                <li>The export may contain separate columns for products purchased. You will need to map these to a single <code>membership</code> column matching your Plan Names in Studio Platform.</li>
                            </ol>
                        </div>

                        {/* MindBody / FitDegree */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 hover:shadow-lg transition-shadow bg-white dark:bg-zinc-900">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Migrating from MindBody / FitDegree</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-3">
                                These platforms often require requesting a data export from their support team.
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-400">
                                <li>Ask for "Client Contact Information" and "Active Membership Status".</li>
                                <li>Ensure you get the <strong>Visit History</strong> if you plan to import historical attendance (contact our support for assistance with this).</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
