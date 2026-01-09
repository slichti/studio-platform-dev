
import { useState, useMemo, useEffect } from 'react';
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
    Area,
    Legend
} from 'recharts';
import { Calculator, TrendingUp, DollarSign, Users, Save, FolderOpen, Trash2, Calendar, ArrowRight } from 'lucide-react';
import { Toast } from './Toast'; // Assuming standard Toast or simple alert fallback

export function ProjectionsCalculator() {
    // Mode: 'static' (Profitability Curve) or 'growth' (Time Series)
    const [mode, setMode] = useState<'static' | 'growth'>('growth');

    // Scenarios logic
    const [scenarios, setScenarios] = useState<{ name: string, data: any }[]>([]);
    const [scenarioName, setScenarioName] = useState('');
    const [isSaveOpen, setIsSaveOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('studio_projection_scenarios');
        if (saved) {
            try {
                setScenarios(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load scenarios", e);
            }
        }
    }, []);

    const [inputs, setInputs] = useState({
        studentCount: 50,
        avgMembershipPrice: 120,
        avgDropInPrice: 25,
        membershipSplit: 60, // 60% members, 40% drop-in
        classesPerDropIn: 4.5,
        rent: 2000,
        payrollPerClass: 40,
        classesPerMonth: 60,
        otherExpenses: 500,
        // New Growth Inputs
        churnRate: 5, // % per month
        growthRate: 8, // New students per month
        seasonalityResult: 15, // % drop in bad months
        seasonalityEnabled: false
    });

    const projection = useMemo(() => {
        // Current Monthly Snaphot
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

    // Static Curve (Students 0 -> 2x)
    const chartData = useMemo(() => {
        const data = [];
        const maxStudents = Math.max(inputs.studentCount * 3, 200);
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

    // Time Series Growth (12 Months)
    const timeSeriesData = useMemo(() => {
        const data = [];
        let currentStudents = inputs.studentCount;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Start from next month for projection
        const startMonthIndex = new Date().getMonth();

        for (let i = 0; i < 24; i++) {
            const monthIndex = (startMonthIndex + i) % 12;
            const monthName = months[monthIndex];

            // Seasonality: Summer slump (Jun/Jul/Aug) or Winter (Dec/Jan)
            // Simplified: Dip in summer
            let impact = 1.0;
            if (inputs.seasonalityEnabled) {
                if (monthIndex === 5 || monthIndex === 6 || monthIndex === 7) { // Jun, Jul, Aug
                    impact = 1.0 - (inputs.seasonalityResult / 100);
                }
            }

            // Churn & Growth
            const churned = currentStudents * (inputs.churnRate / 100);
            const newStudents = inputs.growthRate * impact;

            // Net Change
            currentStudents = Math.max(0, currentStudents - churned + newStudents);

            // Financials
            const memberCount = Math.round(currentStudents * (inputs.membershipSplit / 100));
            const dropInCount = currentStudents - memberCount;
            const revenue = (memberCount * inputs.avgMembershipPrice) + (dropInCount * inputs.classesPerDropIn * inputs.avgDropInPrice);
            // Assuming expenses scale slightly? Let's keep fixed + slight variable if we wanted, but fixed for now.
            // Maybe add per-student var cost? 
            const payroll = inputs.classesPerMonth * inputs.payrollPerClass;
            const expenses = inputs.rent + payroll + inputs.otherExpenses;

            data.push({
                month: i === 0 ? 'Now' : i <= 11 ? monthName : `${monthName} '25`, // Rough Year
                students: Math.round(currentStudents),
                revenue,
                expenses,
                profit: revenue - expenses
            });
        }
        return data;
    }, [inputs]);

    const handleInputChange = (field: keyof typeof inputs, value: string | number | boolean) => {
        if (typeof value === 'boolean') {
            setInputs(prev => ({ ...prev, [field]: value }));
            return;
        }
        const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
        setInputs(prev => ({ ...prev, [field]: num }));
    };

    const saveScenario = () => {
        if (!scenarioName) return;
        const newScenarios = [...scenarios, { name: scenarioName, data: inputs }];
        setScenarios(newScenarios);
        localStorage.setItem('studio_projection_scenarios', JSON.stringify(newScenarios));
        setScenarioName('');
        setIsSaveOpen(false);
    };

    const loadScenario = (idx: number) => {
        setInputs(scenarios[idx].data);
    };

    const deleteScenario = (idx: number) => {
        const newScenarios = scenarios.filter((_, i) => i !== idx);
        setScenarios(newScenarios);
        localStorage.setItem('studio_projection_scenarios', JSON.stringify(newScenarios));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Controls */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-fit space-y-8">
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-lg">
                            <Calculator className="text-blue-600" />
                            <h3>Simulator Inputs</h3>
                        </div>

                        {/* Save/Load Controls */}
                        <div className="flex gap-2">
                            <div className="relative group">
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
                                    <FolderOpen size={18} />
                                </button>
                                {/* Load Menu */}
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 hidden group-hover:block z-50">
                                    <div className="text-xs font-semibold text-zinc-400 px-2 py-1 mb-1">LOAD SCENARIO</div>
                                    {scenarios.length === 0 && <div className="px-2 py-1 text-xs text-zinc-500 italic">No saved scenarios</div>}
                                    {scenarios.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer group/item">
                                            <span onClick={() => loadScenario(i)} className="text-sm truncate flex-1">{s.name}</span>
                                            <Trash2 size={12} className="text-red-400 opacity-0 group-hover/item:opacity-100 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteScenario(i); }} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setIsSaveOpen(!isSaveOpen)}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-blue-600"
                                >
                                    <Save size={18} />
                                </button>
                                {isSaveOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-3 z-50">
                                        <div className="text-xs font-semibold text-zinc-400 mb-2">SAVE CURRENT SCENARIO</div>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-sm"
                                                placeholder="Scenario Name..."
                                                value={scenarioName}
                                                onChange={(e) => setScenarioName(e.target.value)}
                                            />
                                            <button onClick={saveScenario} disabled={!scenarioName} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50">Save</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <Users size={14} /> Current Status
                            </h4>
                            <InputGroup label="Total Active Students" value={inputs.studentCount} onChange={v => handleInputChange('studentCount', v)} />
                            <InputGroup label="Avg. Membership Price ($)" value={inputs.avgMembershipPrice} onChange={v => handleInputChange('avgMembershipPrice', v)} />
                            <InputGroup label="Avg. Drop-In Price ($)" value={inputs.avgDropInPrice} onChange={v => handleInputChange('avgDropInPrice', v)} />

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex justify-between">
                                    <span>Membership Split</span>
                                    <span className="text-zinc-500">{inputs.membershipSplit}% Members</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={inputs.membershipSplit}
                                    onChange={e => handleInputChange('membershipSplit', e.target.value)}
                                    className="w-full accent-blue-600"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                            <h4 className="text-xs font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={14} /> Growth & Churn
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="New Students / Mo" value={inputs.growthRate} onChange={v => handleInputChange('growthRate', v)} />
                                <InputGroup label="Churn Rate (%)" value={inputs.churnRate} onChange={v => handleInputChange('churnRate', v)} />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Seasonality</label>
                                    <div className="text-xs text-zinc-500">Summer slump simulation</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {inputs.seasonalityEnabled && (
                                        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                            -{inputs.seasonalityResult}%
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleInputChange('seasonalityEnabled', !inputs.seasonalityEnabled)}
                                        className={`w-10 h-6 rounded-full transition-colors relative ${inputs.seasonalityEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${inputs.seasonalityEnabled ? 'left-5' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <DollarSign size={14} /> Expenses (Monthly)
                            </h4>
                            <InputGroup label="Rent & Utilities" value={inputs.rent} onChange={v => handleInputChange('rent', v)} />
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Pay / Class" value={inputs.payrollPerClass} onChange={v => handleInputChange('payrollPerClass', v)} />
                                <InputGroup label="Classes / Mo" value={inputs.classesPerMonth} onChange={v => handleInputChange('classesPerMonth', v)} />
                            </div>
                            <InputGroup label="Other Expenses" value={inputs.otherExpenses} onChange={v => handleInputChange('otherExpenses', v)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">

                {/* Tabs */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
                    <button
                        onClick={() => setMode('growth')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'growth' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                    >
                        <Calendar size={16} />
                        24-Month Forecast
                    </button>
                    <button
                        onClick={() => setMode('static')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'static' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                    >
                        <TrendingUp size={16} />
                        Profitability Curve
                    </button>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">Current Revenue</p>
                        <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">${projection.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="text-sm font-normal text-zinc-400">/mo</span></div>
                        <div className="text-xs text-zinc-500 mt-2 flex gap-2">
                            Margins: <span className={projection.margin > 20 ? 'text-green-600' : 'text-zinc-600'}>{projection.margin.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">12-Month Outlook</p>
                        <div className="text-3xl font-black text-blue-600 flex items-center gap-2">
                            ${timeSeriesData[11].revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            {timeSeriesData[11].revenue > projection.totalRevenue ? <TrendingUp size={20} /> : <ArrowRight size={20} />}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                            {timeSeriesData[11].students} Active Students (+{timeSeriesData[11].students - inputs.studentCount})
                        </p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">Net Income (12mo)</p>
                        <div className={`text-3xl font-black ${timeSeriesData[11].profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {timeSeriesData[11].profit >= 0 ? '+' : ''}${timeSeriesData[11].profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">Projected for {timeSeriesData[11].month}</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[450px]">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        {mode === 'growth' ? '24-Month Growth Forecast' : 'Profitability Analysis'}
                    </h3>
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                        {mode === 'growth' ? (
                            <LineChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717A' }} />
                                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717A' }} tickFormatter={val => `$${val / 1000}k`} />
                                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717A' }} />
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E4E4E7" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: any, name: string) => [name === 'Students' ? val : `$${Number(val).toLocaleString()}`, name]}
                                />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" strokeWidth={3} dot={false} />
                                <Line yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                <Line yAxisId="right" type="monotone" dataKey="students" name="Students" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                            </LineChart>
                        ) : (
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
                                <XAxis dataKey="students" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717A' }} label={{ value: 'Number of Students', position: 'insideBottomRight', offset: -10, fontSize: 12, fill: '#71717A' }} />
                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#71717A' }} tickFormatter={val => `$${val / 1000}k`} />
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E4E4E7" />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '']} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                                <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                                <ReferenceLine x={inputs.studentCount} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'top', value: 'Current', fill: '#F59E0B', fontSize: 12 }} />
                            </AreaChart>
                        )}
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
