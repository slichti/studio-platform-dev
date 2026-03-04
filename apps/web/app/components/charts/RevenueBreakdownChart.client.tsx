import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface RevenueBreakdownChartProps {
    data: Array<{ month: string; packs: number; pos: number; memberships: number }>;
}

export function RevenueBreakdownChart({ data }: RevenueBreakdownChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <div className="mb-2">No revenue data available</div>
                <div className="text-xs text-zinc-500">Revenue will appear as sales are recorded</div>
            </div>
        );
    }

    const formatMonth = (month: string) => {
        const [y, m] = month.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[parseInt(m) - 1] || month;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717A', fontSize: 12 }}
                    tickFormatter={formatMonth}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717A', fontSize: 12 }}
                    tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any, name: any) => [`$${Number(value).toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    labelFormatter={(l: any) => formatMonth(String(l))}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => <span style={{ color: '#71717A', fontSize: 12 }}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>}
                />
                <Bar dataKey="memberships" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} name="Memberships" />
                <Bar dataKey="packs" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} name="Packs" />
                <Bar dataKey="pos" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} name="POS / Retail" />
            </BarChart>
        </ResponsiveContainer>
    );
}
