import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface InstructorRoiChartProps {
    data: any[];
}

export function InstructorRoiChart({ data }: InstructorRoiChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <div className="mb-2">No profitability data for this period</div>
                <div className="text-xs text-zinc-500">Run payroll and track class revenue to see ROI</div>
            </div>
        );
    }

    const chartData = data.map(item => ({
        name: item.name,
        revenue: item.revenue / 100,
        cost: item.cost / 100,
        profit: (item.revenue - item.cost) / 100
    }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717A', fontSize: 12 }}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717A', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="cost" name="Payroll Cost" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
        </ResponsiveContainer>
    );
}
