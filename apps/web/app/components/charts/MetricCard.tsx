import { ReactNode } from "react";

interface MetricCardProps {
    title: string;
    value: ReactNode;
    subtext?: string;
    icon?: ReactNode;
}

export function MetricCard({ title, value, subtext, icon }: MetricCardProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">{title}</p>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
                {subtext && <p className="text-xs text-zinc-500 mt-2">{subtext}</p>}
            </div>
        </div>
    );
}
