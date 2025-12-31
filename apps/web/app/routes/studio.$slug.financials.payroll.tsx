// @ts-ignore
import { useLoaderData, useFetcher, Link, useOutletContext } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { DollarSign, Settings, Calendar, CheckCircle, ChevronRight, Download } from "lucide-react";
import { format } from "date-fns/format";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    // Fetch initial data: Payroll Configs
    let configs = [];
    try {
        const res: any = await apiRequest("/payroll/config", token, { headers: { 'X-Tenant-Slug': slug } });
        configs = res.configs || [];
    } catch (e) {
        console.error("Failed to load payroll config", e);
    }

    return { configs, token, slug };
};

export default function PayrollPage() {
    const { configs, token, slug } = useLoaderData<any>();
    const [tab, setTab] = useState<"config" | "run" | "history">("run");

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">Payroll & Payouts</h1>
            <p className="text-zinc-500 mb-8">Manage instructor compensation and record payouts.</p>

            <div className="border-b border-zinc-200 mb-8">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setTab("run")}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${tab === "run" ? "border-blue-500 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                            }`}
                    >
                        <Calendar className="h-4 w-4" />
                        Run Payroll
                    </button>
                    <button
                        onClick={() => setTab("config")}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${tab === "config" ? "border-blue-500 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                            }`}
                    >
                        <Settings className="h-4 w-4" />
                        Configuration
                    </button>
                    <button
                        onClick={() => setTab("history")}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${tab === "history" ? "border-blue-500 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                            }`}
                    >
                        <CheckCircle className="h-4 w-4" />
                        Payout History
                    </button>
                </nav>
            </div>

            {tab === "config" && <PayrollConfig configs={configs} token={token} slug={slug} />}
            {tab === "run" && <RunPayroll token={token} slug={slug} />}
            {tab === "history" && <div className="text-zinc-500 italic">History feature coming soon.</div>}
        </div>
    );
}

function PayrollConfig({ configs, token, slug }: { configs: any[], token: string, slug: string }) {
    const [list, setList] = useState(configs);

    // In real app, fetching all members first might be needed to show those *without* config
    // For now we just show existing.

    return (
        <div>
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Instructor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Pay Model</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Rate</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                        {list.map((conf) => (
                            <ConfigRow key={conf.id} config={conf} token={token} slug={slug} />
                        ))}
                        {list.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-zinc-500">
                                    No configurations found. <br />
                                    <span className="text-xs"> (In MVP, you need to seed configs or use API to create them first, as UI to add new is skipped for brevity)</span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="mt-4 text-sm text-zinc-500">
                * Note: Rates for percentage model are in basis points (5000 = 50%). Flat rates are in cents.
            </p>
        </div>
    );
}

function ConfigRow({ config, token, slug }: { config: any, token: string, slug: string }) {
    const [editing, setEditing] = useState(false);
    const [model, setModel] = useState(config.payModel);
    const [rate, setRate] = useState(config.rate);
    const fetcher = useFetcher();

    async function handleSave() {
        try {
            await apiRequest("/payroll/config", token, {
                method: "PUT",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    memberId: config.memberId,
                    payModel: model,
                    rate: Number(rate)
                })
            });
            setEditing(false);
            // Ideally revalidate loader
        } catch (e) {
            alert("Failed to save");
        }
    }

    if (editing) {
        return (
            <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900">
                    {config.member?.user?.profile?.firstName} {config.member?.user?.profile?.lastName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="border rounded px-2 py-1">
                        <option value="flat">Flat Rate (per session)</option>
                        <option value="hourly">Hourly Rate</option>
                        <option value="percentage">Percentage (Revenue Share)</option>
                    </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <input
                        type="number"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        className="border rounded px-2 py-1 w-24"
                    />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button onClick={handleSave} className="text-blue-600 hover:text-blue-900 mr-3">Save</button>
                    <button onClick={() => setEditing(false)} className="text-zinc-600 hover:text-zinc-900">Cancel</button>
                </td>
            </tr>
        )
    }

    return (
        <tr>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                {config.member?.user?.profile?.firstName} {config.member?.user?.profile?.lastName}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 capitalize">
                {config.payModel}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                {config.rate} {config.payModel === 'percentage' ? 'bps' : 'cents'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onClick={() => setEditing(true)} className="text-blue-600 hover:text-blue-900">Edit</button>
            </td>
        </tr>
    );
}

function RunPayroll({ token, slug }: { token: string, slug: string }) {
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    async function runReport() {
        setLoading(true);
        try {
            const res: any = await apiRequest(`/payroll/report?start=${startDate}&end=${endDate}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            setReport(res.report);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="bg-zinc-50 p-4 rounded-lg flex gap-4 items-end mb-8 border border-zinc-200">
                <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Period Start</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Period End</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
                </div>
                <button
                    onClick={runReport}
                    disabled={loading}
                    className="bg-zinc-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                >
                    {loading ? "Calculating..." : "Calculate Payroll"}
                </button>
            </div>

            {report && (
                <div className="space-y-6">
                    {Object.keys(report).length === 0 && <p className="text-zinc-500 text-center py-8">No earnings found for this period.</p>}

                    {Object.entries(report).map(([instructorId, data]: [string, any]) => (
                        <PayrollCard
                            key={instructorId}
                            instructorId={instructorId}
                            data={data}
                            token={token}
                            slug={slug}
                            period={{ start: startDate, end: endDate }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PayrollCard({ instructorId, data, token, slug, period }: any) {
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);

    async function handleMarkPaid() {
        if (!confirm(`Mark $${data.total / 100} as paid?`)) return;
        setPaying(true);
        try {
            await apiRequest("/payroll/payout", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    instructorId,
                    amount: data.total,
                    periodStart: period.start,
                    periodEnd: period.end,
                    items: data.items
                })
            });
            setPaid(true);
        } catch (e: any) {
            alert("Failed to record payout: " + e.message);
        } finally {
            setPaying(false);
        }
    }

    return (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-zinc-50 px-6 py-4 flex justify-between items-center border-b border-zinc-200">
                <div>
                    <h3 className="font-semibold text-lg">Instructor ID: {instructorId.substring(0, 8)}...</h3>
                    {/* Ideally fetch name if report didn't populate it perfectly */}
                    <p className="text-sm text-zinc-500">{data.items.length} items</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold font-mono text-zinc-900">${(data.total / 100).toFixed(2)}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Owing</p>
                </div>
            </div>
            <div className="px-6 py-4">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-zinc-500 border-b border-zinc-100">
                            <th className="text-left py-2 font-medium">Date</th>
                            <th className="text-left py-2 font-medium">Item</th>
                            <th className="text-left py-2 font-medium">Details</th>
                            <th className="text-right py-2 font-medium">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {data.items.map((item: any, i: number) => (
                            <tr key={i}>
                                <td className="py-2 text-zinc-600">{new Date(item.date).toLocaleDateString()}</td>
                                <td className="py-2 font-medium text-zinc-900">{item.title}</td>
                                <td className="py-2 text-zinc-500 text-xs">{item.details}</td>
                                <td className="py-2 text-right text-zinc-900">${(item.amount / 100).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                {paid ? (
                    <span className="flex items-center gap-2 text-green-600 font-medium px-4 py-2">
                        <CheckCircle className="h-5 w-5" />
                        Payout Recorded
                    </span>
                ) : (
                    <button
                        onClick={handleMarkPaid}
                        disabled={paying}
                        className="bg-green-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <DollarSign className="h-4 w-4" />
                        {paying ? "Recording..." : "Mark as Paid"}
                    </button>
                )}
            </div>
        </div>
    );
}
