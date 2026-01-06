
import { useState, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    AreaChart,
    Area
} from 'recharts';
import { Calculator, TrendingUp, DollarSign, Users } from 'lucide-react';

export function ProjectionsCalculator() {
    const [inputs, setInputs] = useState({
        studentCount: 50,
        avgMembershipPrice: 120,
        avgDropInPrice: 25,
        membershipSplit: 60, // 60% members, 40% drop-in
        classesPerDropIn: 4, // avg classes/mo for drop-in users
        rent: 2000,
        payrollPerClass: 40,
        classesPerMonth: 60,
        otherExpenses: 500
    });

    const projection = useMemo(() => {
        // Revenue
        const memberCount = Math.round(inputs.studentCount * (inputs.membershipSplit / 100));
        const dropInCount = inputs.studentCount - memberCount;

        const membershipRevenue = memberCount * inputs.avgMembershipPrice;
        const dropInRevenue = dropInCount * inputs.classesPerDropIn * inputs.avgDropInPrice;
        const totalRevenue = membershipRevenue + dropInRevenue;

        // Expenses
        const payroll = inputs.classesPerMonth * inputs.payrollPerClass;
        const totalExpenses = inputs.rent + payroll + inputs.otherExpenses;

        // Profit
        const profit = totalRevenue - totalExpenses;
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalExpenses,
            profit,
            margin,
            breakdown: { membershipRevenue, dropInRevenue }
        };
    }, [inputs]);

    // Generate Chart Data (Scaling Student Count)
    const chartData = useMemo(() => {
        const data = [];
        // Scale from 0 to 2x current student count or at least 100
        const maxStudents = Math.max(inputs.studentCount * 2, 100);
        const step = Math.ceil(maxStudents / 20);

        for (let count = 0; count <= maxStudents; count += step) {
            const memberCount = Math.round(count * (inputs.membershipSplit / 100));
            const dropInCount = count - memberCount;
            const revenue = (memberCount * inputs.avgMembershipPrice) + (dropInCount * inputs.classesPerDropIn * inputs.avgDropInPrice);
            const payroll = inputs.classesPerMonth * inputs.payrollPerClass;
            const expenses = inputs.rent + payroll + inputs.otherExpenses;

            data.push({
                students: count,
                revenue,
                expenses,
                profit: revenue - expenses
            });
        }
        return data;
    }, [inputs]);

    const handleInputChange = (field: keyof typeof inputs, value: string) => {
        const num = parseFloat(value) || 0;
        setInputs(prev => ({ ...prev, [field]: num }));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Controls */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-fit">
                <div className="flex items-center gap-2 mb-6 text-zinc-900 dark:text-zinc-100 font-bold text-lg">
                    <Calculator className="text-blue-600" />
                    <h3>Simulator Inputs</h3>
                </div>

                <div className="space-y-6">
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Students & Pricing</h4>
                        <InputGroup label="Total Active Students" value={inputs.studentCount} onChange={v => handleInputChange('studentCount', v)} />
                        <InputGroup label="Avg. Membership Price ($)" value={inputs.avgMembershipPrice} onChange={v => handleInputChange('avgMembershipPrice', v)} />
                        <InputGroup label="Avg. Class Drop-In Price ($)" value={inputs.avgDropInPrice} onChange={v => handleInputChange('avgDropInPrice', v)} />

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex justify-between">
                                <span>Membership vs Drop-In Split</span>
                                <span className="text-zinc-500">{inputs.membershipSplit}% Members</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={inputs.membershipSplit}
                                onChange={e => handleInputChange('membershipSplit', e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Expenses (Monthly)</h4>
                        <InputGroup label="Rent & Utilities" value={inputs.rent} onChange={v => handleInputChange('rent', v)} />
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Instructor Pay / Class" value={inputs.payrollPerClass} onChange={v => handleInputChange('payrollPerClass', v)} />
                            <InputGroup label="Classes / Month" value={inputs.classesPerMonth} onChange={v => handleInputChange('classesPerMonth', v)} />
                        </div>
                        <InputGroup label="Other Expenses" value={inputs.otherExpenses} onChange={v => handleInputChange('otherExpenses', v)} />
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">

                {/* Scorecards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">Projected Revenue</p>
                        <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">${projection.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="text-sm font-normal text-zinc-400">/mo</span></div>
                        <div className="text-xs text-zinc-500 mt-2 flex gap-2">
                            <span className="text-blue-600">${projection.breakdown.membershipRevenue.toLocaleString()} Members</span>
                            <span>•</span>
                            <span className="text-purple-600">${projection.breakdown.dropInRevenue.toLocaleString()} Drop-ins</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">Estimated Expenses</p>
                        <div className="text-3xl font-black text-red-600 dark:text-red-400">${projection.totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="text-sm font-normal text-zinc-400">/mo</span></div>
                        <p className="text-xs text-zinc-500 mt-2">Rent, Payroll, Ops</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 ${projection.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            <DollarSign size={64} />
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">Net Profit</p>
                        <div className={`text-3xl font-black ${projection.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {projection.profit >= 0 ? '+' : ''}${projection.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">{projection.margin.toFixed(1)}% Margin</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[400px]">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-zinc-400" />
                        Profitability Curve
                    </h3>
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="students"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#71717A' }}
                                label={{ value: 'Number of Students', position: 'insideBottomRight', offset: -10, fontSize: 12, fill: '#71717A' }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#71717A' }}
                                tickFormatter={val => `$${val / 1000}k`}
                            />
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E4E4E7" />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '']}
                            />

                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                            <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />

                            <ReferenceLine x={inputs.studentCount} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'top', value: 'Current', fill: '#F59E0B', fontSize: 12 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function InputGroup({ label, value, onChange }: { label: string, value: number, onChange: (v: string) => void }) {
    return (
        <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
            <input
                type="number"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
        </div>
    );
}
