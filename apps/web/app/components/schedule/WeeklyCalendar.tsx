import { startOfWeek, addDays, format, isSameDay, isWithinInterval, addMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/utils/cn';

interface Event {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource?: any;
}

interface WeeklyCalendarProps {
    events: Event[];
    onSelectEvent: (event: any) => void;
    onSelectSlot: (slot: { start: Date }) => void;
    defaultDate?: Date;
}

export function WeeklyCalendar({ events, onSelectEvent, onSelectSlot, defaultDate = new Date() }: WeeklyCalendarProps) {
    const [currentDate, setCurrentDate] = useState(defaultDate);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    const timeSlots = Array.from({ length: 14 }).map((_, i) => i + 6); // 6 AM to 8 PM (approx)

    const navigate = (direction: 'prev' | 'next' | 'today') => {
        if (direction === 'today') setCurrentDate(new Date());
        else if (direction === 'prev') setCurrentDate(addDays(currentDate, -7));
        else setCurrentDate(addDays(currentDate, 7));
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800" role="region" aria-label="Weekly Calendar">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('prev')}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                        aria-label="Previous Week"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => navigate('next')}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                        aria-label="Next Week"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <h2 className="text-lg font-semibold ml-2">
                        {format(weekStart, 'MMMM yyyy')}
                    </h2>
                </div>
                <button
                    onClick={() => navigate('today')}
                    className="text-sm font-medium px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 transition-colors"
                >
                    Today
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto min-h-[600px]" role="grid" tabIndex={0} aria-label="Calendar Grid">
                {/* Header Row */}
                <div className="grid grid-cols-8 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10" role="row">
                    <div className="p-2 border-r border-zinc-100 dark:border-zinc-800 w-16" role="columnheader">
                        <span className="sr-only">Time</span>
                    </div>
                    {weekDays.map((day) => (
                        <div
                            key={day.toISOString()}
                            className={cn(
                                "p-2 text-center border-r border-zinc-100 dark:border-zinc-800 min-w-[120px]",
                                isSameDay(day, new Date()) && "bg-blue-50 dark:bg-blue-900/20"
                            )}
                            role="columnheader"
                            aria-label={format(day, 'EEEE, MMMM do')}
                        >
                            <div className={cn("text-xs font-medium uppercase", isSameDay(day, new Date()) ? "text-blue-600" : "text-zinc-500")}>
                                {format(day, 'EEE')}
                            </div>
                            <div className={cn("text-lg font-bold", isSameDay(day, new Date()) ? "text-blue-700" : "text-zinc-900")}>
                                {format(day, 'd')}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Body - Single Row containing Columns as Cells */}
                <div className="relative grid grid-cols-8" role="row">
                    {/* Time Column (Row Header) */}
                    <div className="w-16 flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50" role="rowheader">
                        {timeSlots.map(hour => (
                            <div key={hour} className="h-20 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 p-1 text-right pr-2 sticky left-0">
                                {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </div>
                        ))}
                    </div>

                    {/* Day Columns (Grid Cells) */}
                    {weekDays.map((day) => {
                        // Filter events for this day
                        const dayEvents = events.filter(e => isSameDay(e.start, day));

                        return (
                            <div
                                key={day.toISOString()}
                                className="relative border-r border-zinc-100 dark:border-zinc-800 min-w-[120px]"
                                role="gridcell"
                                onClick={() => onSelectSlot({ start: day })} // Simplified slot selection (whole day/column focus)
                            >
                                {/* Time Grid Lines */}
                                {timeSlots.map(hour => (
                                    <div key={hour} className="h-20 border-b border-zinc-50 dark:border-zinc-800/50 pointer-events-none" />
                                ))}

                                {/* Events */}
                                {dayEvents.map(event => {
                                    // Calculate position
                                    const startHour = event.start.getHours();
                                    const startMin = event.start.getMinutes();
                                    const endHour = event.end.getHours();
                                    const endMin = event.end.getMinutes();

                                    const startOffset = (startHour - 6) * 80 + (startMin / 60) * 80; // 80px per hour
                                    const durationMins = (event.end.getTime() - event.start.getTime()) / 60000;
                                    const height = (durationMins / 60) * 80;

                                    if (startHour < 6) return null; // Skip early events for now

                                    return (
                                        <button
                                            key={event.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectEvent({ resource: event.resource });
                                            }}
                                            className="absolute left-1 right-1 rounded px-2 py-1 text-xs text-left overflow-hidden hover:brightness-95 transition-all shadow-sm focus:ring-2 focus:ring-blue-500 z-10"
                                            style={{
                                                top: `${startOffset}px`,
                                                height: `${Math.max(height, 24)}px`, // Min height
                                                backgroundColor: 'var(--calendar-event-bg, #eff6ff)',
                                                border: '1px solid var(--calendar-event-border, #bfdbfe)',
                                                color: 'var(--calendar-event-text, #1e40af)',
                                            }}
                                            aria-label={`${event.title}, ${format(event.start, 'h:mm a')} to ${format(event.end, 'h:mm a')}`}
                                        >
                                            <div className="font-semibold truncate">{event.title}</div>
                                            <div className="opacity-75">{format(event.start, 'h:mm a')}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
