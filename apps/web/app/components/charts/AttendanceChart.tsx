import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

interface AttendanceChartProps {
    data: any[];
}

export function AttendanceChart({ data }: AttendanceChartProps) {
    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <div className="mb-2">No attendance data for this period</div>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717A', fontSize: 12 }}
                    dy={10}
                    tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717A', fontSize: 12 }}
                />
                <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [value, 'Attendees']}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                />
                <Area type="monotone" dataKey="value" stroke="#10B981" fill="#ECFDF5" strokeWidth={2} />
            </AreaChart>
        </ResponsiveContainer>
    );
}
