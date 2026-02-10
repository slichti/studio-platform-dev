import { useEffect, useState } from 'react';

interface RetentionChartProps {
    data: any[];
}

export function RetentionChart({ data }: RetentionChartProps) {
    const [Recharts, setRecharts] = useState<any>(null);

    useEffect(() => {
        import('recharts').then(mod => setRecharts(mod));
    }, []);

    if (!Recharts) {
        return <div className="h-full w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl" />;
    }

    const {
        BarChart,
        Bar,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
        Legend,
        ResponsiveContainer
    } = Recharts;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E5" />
                <XAxis dataKey="month" stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                    cursor={{ fill: '#F4F4F5' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="total" name="New Members" fill="#E4E4E7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="retained" name="Retained Active" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
