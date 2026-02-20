
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ReferenceLine
} from "recharts";

interface ProjectionsChartsProps {
    projectionData: any[];
    costBreakdown: any[];
    formatCurrency: (val: number) => string;
}

export default function ProjectionsCharts({ projectionData, costBreakdown, formatCurrency }: ProjectionsChartsProps) {
    return (
        <div className="space-y-8">
            {/* Main Area Chart */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[400px]">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4">Projected Profit vs. Cost</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                        <XAxis dataKey="name" fontSize={12} stroke="#71717A" />
                        <YAxis fontSize={12} stroke="#71717A" tickFormatter={(val) => `$${val / 1000}k`} />
                        <Tooltip
                            formatter={(value: any) => formatCurrency(Number(value) || 0)}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#18181b', color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                        <Area type="monotone" dataKey="infraCost" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" name="Infra Cost" />
                        <ReferenceLine y={0} stroke="#000" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Cost Breakdown */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[300px] flex flex-col">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4">Infra Cost Breakdown</h3>
                    {costBreakdown.length > 0 ? (
                        <div className="flex-1 flex text-xs">
                            <ResponsiveContainer width="60%">
                                <PieChart>
                                    <Pie
                                        data={costBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {costBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col justify-center space-y-2">
                                {costBreakdown.map(item => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-400">No Costs Selected</div>
                    )}
                </div>

                {/* Tenant Profitability Chart */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[300px]">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4">Avg Tenant Profit History</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projectionData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" hide />
                            <YAxis hide />
                            <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                            <Area type="monotone" dataKey="tenantNet" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-zinc-400 text-center mt-2">
                        * Simulates single studio profit after fees & payroll
                    </p>
                </div>
            </div>
        </div>
    );
}
