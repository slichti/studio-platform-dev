const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface UtilizationHeatmapProps {
    data: any[];
    // data is array of { day: string(0-6), hour: string(0-23), bookingCount: number }
}

export function UtilizationHeatmap({ data }: UtilizationHeatmapProps) {
    const getHeatmapValue = (dayIndex: number, hourIndex: number) => {
        const found = data.find((u: any) => parseInt(u.day) === dayIndex && parseInt(u.hour) === hourIndex);
        return found ? found.bookingCount : 0;
    };

    const maxHeat = Math.max(...(data.map((u: any) => u.bookingCount) || [0]), 1);

    const getHeatColor = (value: number) => {
        if (value === 0) return 'bg-zinc-50 dark:bg-zinc-900';
        const intensity = value / maxHeat;
        if (intensity < 0.25) return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300';
        if (intensity < 0.5) return 'bg-indigo-300 dark:bg-indigo-700/60 text-indigo-900 dark:text-indigo-100';
        if (intensity < 0.75) return 'bg-indigo-500 text-white';
        return 'bg-indigo-700 text-white';
    };

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[800px]">
                <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-1">
                    {/* Hour Headers */}
                    <div className="h-8 w-16" /> {/* Corner Spacer */}
                    {Array.from({ length: 24 }).map((_, h) => (
                        <div key={`h-${h}`} className="h-8 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                            {h}
                        </div>
                    ))}

                    {/* Rows */}
                    {DAYS.map((day, d) => (
                        <>
                            <div key={`d-${d}`} className="h-10 flex items-center pr-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                {day}
                            </div>
                            {Array.from({ length: 24 }).map((_, h) => {
                                const val = getHeatmapValue(d, h);
                                return (
                                    <div
                                        key={`${d}-${h}`}
                                        title={`${day} @ ${h}:00 - ${val} bookings`}
                                        className={`h-10 rounded-md flex items-center justify-center text-xs font-medium transition-all hover:scale-110 ${getHeatColor(val)}`}
                                    >
                                        {val > 0 ? val : ''}
                                    </div>
                                );
                            })}
                        </>
                    ))}
                </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-zinc-500">
                <span>Less Busy</span>
                <div className="flex gap-1">
                    <div className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/40" />
                    <div className="w-4 h-4 rounded bg-indigo-300 dark:bg-indigo-700/60" />
                    <div className="w-4 h-4 rounded bg-indigo-500" />
                    <div className="w-4 h-4 rounded bg-indigo-700" />
                </div>
                <span>More Busy</span>
            </div>
        </div>
    );
}
