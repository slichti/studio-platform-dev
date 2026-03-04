import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts';

interface ChurnChartProps {
    data: { safe: number; at_risk: number; churned: number; total: number };
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];
const LABELS = ['Safe', 'At Risk', 'Churned'];

export function ChurnChart({ data }: ChurnChartProps) {
    if (!data || data.total === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <div className="mb-2">No member data available</div>
                <div className="text-xs text-zinc-500">Members will appear as they join</div>
            </div>
        );
    }

    const chartData = [
        { name: 'Safe', value: data.safe, color: COLORS[0] },
        { name: 'At Risk', value: data.at_risk, color: COLORS[1] },
        { name: 'Churned', value: data.churned, color: COLORS[2] },
    ].filter(d => d.value > 0);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any, name: any) => [`${value} members`, name]}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => <span style={{ color: '#71717A', fontSize: 12 }}>{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
