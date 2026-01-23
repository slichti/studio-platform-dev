
import { BarChart3, TrendingUp, Download, PieChart } from "lucide-react";

export default function ReportsDocs() {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Reports & Analytics</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Track the financial health and growth of your studio with real-time analytics and exportable reports.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Dashboard */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <BarChart3 className="text-blue-500" /> Financial Dashboard
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        The main dashboard typically updates every 5-10 minutes (cached at the edge) and provides a snapshot of your monthly performance.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6 text-sm">
                        <div className="space-y-2">
                            <strong className="block text-zinc-900 dark:text-zinc-100">Gross Revenue</strong>
                            <p className="text-zinc-500">Total sales before refunds and fees.</p>
                        </div>
                        <div className="space-y-2">
                            <strong className="block text-zinc-900 dark:text-zinc-100">Net Revenue</strong>
                            <p className="text-zinc-500">Revenue actually deposited to your bank (Gross - Fees).</p>
                        </div>
                        <div className="space-y-2">
                            <strong className="block text-zinc-900 dark:text-zinc-100">MRR (Monthly Recurring)</strong>
                            <p className="text-zinc-500">Predictable revenue from active memberships.</p>
                        </div>
                    </div>
                </section>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Attendance */}
                    <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <TrendingUp className="text-green-500" /> Attendance Reports
                        </h2>
                        <ul className="space-y-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li>• **Utilization Rate:** specific classes filling up vs. empty.</li>
                            <li>• **No-Show Rate:** monitor students who book but don't attend.</li>
                            <li>• **Instructor Performance:** average attendance per teacher.</li>
                        </ul>
                    </section>

                    {/* Custom Exports */}
                    <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Download className="text-purple-500" /> Data Exports
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            You can export any data table as a CSV for use in Excel or QuickBooks.
                        </p>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li>1. Navigate to the list view (e.g. Students, Transactions).</li>
                            <li>2. Apply any desired filters.</li>
                            <li>3. Click the <strong>Export CSV</strong> button.</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
