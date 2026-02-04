
import { LoaderFunctionArgs } from "react-router";

import { useLoaderData, redirect, useSearchParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { DollarSign, Calendar, Clock, TrendingUp, Download } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const url = new URL(args.request.url);
    const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const token = await getToken();

    try {
        const payrollData = await apiRequest(`/instructor/payroll?month=${month}`, token, { headers: { 'X-Tenant-Slug': slug } }) as any;
        return { payroll: payrollData || {}, month };
    } catch (e) {
        console.error("Payroll Loader Error", e);
        return { payroll: {}, month };
    }
};

export default function InstructorPayroll() {
    const { payroll, month } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();

    const formatCurrency = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`;

    const changeMonth = (offset: number) => {
        const current = new Date(month + '-01');
        current.setMonth(current.getMonth() + offset);
        setSearchParams({ month: current.toISOString().slice(0, 7) });
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2"><DollarSign size={20} /> Earnings</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => changeMonth(-1)} className="px-3 py-1 text-sm hover:bg-zinc-100 rounded">← Prev</button>
                    <span className="text-sm font-medium">{new Date(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => changeMonth(1)} className="px-3 py-1 text-sm hover:bg-zinc-100 rounded">Next →</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                    <div className="text-sm opacity-80 mb-1">Total Earnings</div>
                    <div className="text-3xl font-bold">{formatCurrency(payroll.total || 0)}</div>
                </div>
                <div className="bg-white rounded-xl border border-zinc-200 p-5">
                    <div className="text-xs text-zinc-500 mb-1">Classes Taught</div>
                    <div className="text-2xl font-bold text-zinc-900">{payroll.classCount || 0}</div>
                </div>
                <div className="bg-white rounded-xl border border-zinc-200 p-5">
                    <div className="text-xs text-zinc-500 mb-1">Avg per Class</div>
                    <div className="text-2xl font-bold text-zinc-900">{formatCurrency(payroll.classCount ? Math.round((payroll.total || 0) / payroll.classCount) : 0)}</div>
                </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-xl border border-zinc-200">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="font-bold text-zinc-900">Breakdown</h2>
                    <button className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1"><Download size={14} /> Export</button>
                </div>
                {!payroll.items || payroll.items.length === 0 ? (
                    <p className="p-6 text-center text-zinc-500">No earnings this month</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th className="text-left p-3 font-medium text-zinc-500">Date</th>
                                <th className="text-left p-3 font-medium text-zinc-500">Class</th>
                                <th className="text-right p-3 font-medium text-zinc-500">Rate</th>
                                <th className="text-right p-3 font-medium text-zinc-500">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {payroll.items.map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-zinc-50">
                                    <td className="p-3">{new Date(item.date).toLocaleDateString()}</td>
                                    <td className="p-3">{item.classTitle}</td>
                                    <td className="p-3 text-right text-zinc-500">{item.rate}</td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
