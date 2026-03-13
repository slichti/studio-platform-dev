import { startOfWeek, startOfMonth, addDays, addMonths, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '~/utils/cn';

// Helper to compute side-by-side layout for overlapping events
function computeEventLayouts(dayEvents: Event[]) {
    if (dayEvents.length === 0) return new Map<string, { left: number; width: number }>();

    const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
    const groups: Event[][] = [];
    let currentGroup: Event[] = [];
    let groupEnd: number | null = null;

    for (const event of sorted) {
        if (groupEnd === null || event.start.getTime() < groupEnd) {
            currentGroup.push(event);
            groupEnd = Math.max(groupEnd || 0, event.end.getTime());
        } else {
            groups.push(currentGroup);
            currentGroup = [event];
            groupEnd = event.end.getTime();
        }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    const layouts = new Map<string, { left: number; width: number }>();

    for (const group of groups) {
        const columns: Event[][] = [];
        for (const event of group) {
            let colIndex = columns.findIndex(col => col[col.length - 1].end.getTime() <= event.start.getTime());
            if (colIndex === -1) {
                columns.push([event]);
            } else {
                columns[colIndex].push(event);
            }
        }

        const count = columns.length;
        columns.forEach((col, i) => {
            col.forEach(event => {
                layouts.set(event.id, { left: i / count, width: 1 / count });
            });
        });
    }

    return layouts;
}

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
    startHour?: number; // 0-23, default 5 (5 AM)
    endHour?: number;   // 1-24, default 24 (midnight)
}

export function WeeklyCalendar({ events, onSelectEvent, onSelectSlot, defaultDate = new Date(), startHour = 5, endHour = 24 }: WeeklyCalendarProps) {
    const [currentDate, setCurrentDate] = useState(defaultDate);
    const [view, setView] = useState<'day' | 'workweek' | 'week' | 'month'>('week');

    // Auto-advance to the week of the next upcoming event if the current week
    // has no future events (e.g. today is Saturday and the next class is Sunday).
    const hasAutoAdvanced = useRef(false);
    const initialWeekEndRef = useRef(addDays(startOfWeek(defaultDate, { weekStartsOn: 0 }), 6));
    useEffect(() => {
        if (!hasAutoAdvanced.current && events.length > 0) {
            hasAutoAdvanced.current = true;
            const now = new Date();
            const initialWeekEnd = initialWeekEndRef.current;
            const hasEventsThisWeek = events.some(e => e.start >= now && e.start <= initialWeekEnd);
            if (!hasEventsThisWeek) {
                const next = events
                    .filter(e => e.start > initialWeekEnd)
                    .sort((a, b) => a.start.getTime() - b.start.getTime());
                if (next.length > 0) setCurrentDate(next[0].start);
            }
        }
    }, [events]);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start

    // Visible days based on view mode
    const visibleDays = (() => {
        if (view === 'day') {
            return [currentDate];
        }
        if (view === 'workweek') {
            const workWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
            return Array.from({ length: 5 }).map((_, i) => addDays(workWeekStart, i));
        }
        if (view === 'week') {
            return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
        }
        // Month view handled separately
        return [];
    })();

    const slotCount = endHour - startHour + 1; // +1 to include end hour label
    const timeSlots = Array.from({ length: slotCount }).map((_, i) => i + startHour);

    const navigate = (direction: 'prev' | 'next' | 'today') => {
        if (direction === 'today') {
            setCurrentDate(new Date());
            return;
        }

        const delta = direction === 'prev' ? -1 : 1;

        if (view === 'day') {
            setCurrentDate(addDays(currentDate, delta));
        } else if (view === 'workweek' || view === 'week') {
            setCurrentDate(addDays(currentDate, delta * 7));
        } else if (view === 'month') {
            setCurrentDate(addMonths(currentDate, delta));
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800" role="region" aria-label="Weekly Calendar">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('prev')}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                        aria-label="Previous"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => navigate('next')}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                        aria-label="Next"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <h2 className="text-lg font-semibold ml-2">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full text-xs">
                        <button
                            type="button"
                            onClick={() => setView('day')}
                            className={cn(
                                "px-2.5 py-1 rounded-full",
                                view === 'day' ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-50" : "text-zinc-500"
                            )}
                        >
                            Day
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('workweek')}
                            className={cn(
                                "px-2.5 py-1 rounded-full",
                                view === 'workweek' ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-50" : "text-zinc-500"
                            )}
                        >
                            5-Day
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('week')}
                            className={cn(
                                "px-2.5 py-1 rounded-full",
                                view === 'week' ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-50" : "text-zinc-500"
                            )}
                        >
                            Week
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('month')}
                            className={cn(
                                "px-2.5 py-1 rounded-full",
                                view === 'month' ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-50" : "text-zinc-500"
                            )}
                        >
                            Month
                        </button>
                    </div>
                    <button
                        onClick={() => navigate('today')}
                        className="text-sm font-medium px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 transition-colors"
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto" role="grid" tabIndex={0} aria-label="Calendar Grid">
                {view === 'month' ? (
                    <>
                        {/* Month header row (weekdays) */}
                        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const day = addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i);
                                return (
                                    <div
                                        key={i}
                                        className="p-2 text-center text-xs font-medium uppercase text-zinc-500 border-r border-zinc-100 dark:border-zinc-800"
                                    >
                                        {format(day, 'EEE')}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Month grid (6 weeks) */}
                        <div className="grid grid-cols-7 auto-rows-[120px]">
            {Array.from({ length: 42 }).map((_, index) => {
                                const gridStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
                                const day = addDays(gridStart, index);

                                // Match events by local calendar date (same behavior as list view)
                                const dayKey = day.toLocaleDateString('en-CA'); // YYYY-MM-DD
                                const dayEvents = events.filter(e => {
                                    const d = e.start instanceof Date ? e.start : new Date(e.start);
                                    const eventKey = d.toLocaleDateString('en-CA');
                                    return eventKey === dayKey;
                                });
                                const isToday = isSameDay(day, new Date());
                                const isOtherMonth = day.getMonth() !== currentDate.getMonth();

                                return (
                                    <button
                                        key={day.toISOString()}
                                        type="button"
                                        className={cn(
                                            "border border-zinc-100 dark:border-zinc-800 p-1.5 text-left align-top relative hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors",
                                            isOtherMonth && "bg-zinc-50/40 dark:bg-zinc-900/20"
                                        )}
                                        onClick={() => onSelectSlot({ start: day })}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span
                                                className={cn(
                                                    "text-xs font-semibold",
                                                    isToday ? "text-blue-600" : "text-zinc-600"
                                                )}
                                            >
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayEvents.map(event => (
                                                <div
                                                    key={event.id}
                                                    className="text-[11px] px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100 cursor-pointer leading-tight"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectEvent({ resource: event.resource });
                                                    }}
                                                >
                                                    <span className="font-medium mr-1 whitespace-nowrap">
                                                        {format(event.start, 'p')}
                                                    </span>
                                                    <span className="inline-block align-middle whitespace-normal break-words">
                                                        {event.title}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Header Row */}
                        <div className="flex border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10" role="row">
                            <div className="p-2 border-r border-zinc-100 dark:border-zinc-800 w-16" role="columnheader">
                                <span className="sr-only">Time</span>
                            </div>
                            <div
                                className="flex-1 grid"
                                style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(120px, 1fr))` }}
                            >
                                {visibleDays.map((day) => (
                                    <div
                                        key={day.toISOString()}
                                        className={cn(
                                            "p-2 text-center border-r border-zinc-100 dark:border-zinc-800",
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
                        </div>

                        {/* Body - Time column + day columns */}
                        <div className="relative flex pb-20" role="row">
                            {/* Time Column (Row Header) */}
                            <div className="w-16 flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50" role="rowheader">
                                {timeSlots.map(hour => (
                                    <div key={hour} className="h-20 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 p-1 text-right pr-2 sticky left-0">
                                        {hour === 0 || hour === 24 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                    </div>
                                ))}
                            </div>

                            {/* Day Columns (Grid Cells) */}
                            <div
                                className="flex-1 grid"
                                style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(120px, 1fr))` }}
                            >
                                {visibleDays.map((day) => {
                                    // Filter events for this day using local calendar date (same as list view)
                                    const dayKey = day.toLocaleDateString('en-CA'); // YYYY-MM-DD
                                    const dayEvents = events.filter(e => {
                                        const d = e.start instanceof Date ? e.start : new Date(e.start);
                                        const eventKey = d.toLocaleDateString('en-CA');
                                        return eventKey === dayKey;
                                    });

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className="relative border-r border-zinc-100 dark:border-zinc-800"
                                            role="gridcell"
                                        >
                                            {/* Time Grid Lines - clickable */}
                                            {timeSlots.map(hour => {
                                                const slotDate = new Date(day);
                                                slotDate.setHours(hour, 0, 0, 0);
                                                return (
                                                    <div
                                                        key={hour}
                                                        className="h-20 border-b border-zinc-50 dark:border-zinc-800/50 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                                                        onClick={() => onSelectSlot({ start: slotDate })}
                                                    />
                                                );
                                            })}

                                            {(() => {
                                                const layouts = computeEventLayouts(dayEvents);
                                                return dayEvents.map(event => {
                                                    const layout = layouts.get(event.id) || { left: 0, width: 1 };
                                                    // Calculate position
                                                    const evStartHour = event.start.getHours();
                                                    const startMin = event.start.getMinutes();

                                                    const startOffset = (evStartHour - startHour) * 80 + (startMin / 60) * 80; // 80px per hour
                                                    const durationMins = (event.end.getTime() - event.start.getTime()) / 60000;
                                                    const height = (durationMins / 60) * 80;

                                                    if (evStartHour < startHour) return null; // Skip events before calendar start

                                                    const gradient = event.resource?.gradientColor1 && event.resource?.gradientColor2
                                                        ? `linear-gradient(${event.resource.gradientDirection || 135}deg, ${event.resource.gradientColor1}, ${event.resource.gradientColor2})`
                                                        : event.resource?.gradientColor1 || 'var(--calendar-event-bg, #eff6ff)';

                                                    return (
                                                        <button
                                                            key={event.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelectEvent({ resource: event.resource });
                                                            }}
                                                            className="absolute rounded px-2 py-1 text-xs text-left overflow-hidden hover:brightness-95 transition-all shadow-sm focus:ring-2 focus:ring-blue-500 z-10"
                                                            style={{
                                                                top: `${startOffset}px`,
                                                                height: `${Math.max(height, 24)}px`, // Min height
                                                                left: `${layout.left * 100}%`,
                                                                width: `${layout.width * 98}%`, // Slightly less than 100% to show gap
                                                                background: gradient,
                                                                border: event.resource?.gradientColor1 ? 'none' : '1px solid var(--calendar-event-border, #bfdbfe)',
                                                                color: event.resource?.gradientColor1 ? '#ffffff' : 'var(--calendar-event-text, #1e40af)',
                                                                textShadow: event.resource?.gradientColor1 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                                                            }}
                                                            aria-label={`${event.title}, ${format(event.start, 'h:mm a')} to ${format(event.end, 'h:mm a')}`}
                                                        >
                                                        <div className="font-semibold truncate">{event.title}</div>
                                                        <div className="opacity-75">{format(event.start, 'h:mm a')}</div>
                                                        
                                                        {/* Instructors */}
                                                        {height > 40 && (
                                                            <div className="mt-1 flex -space-x-1 overflow-hidden">
                                                                {event.resource?.instructors?.length > 0 ? (
                                                                    event.resource.instructors.map((inst: any) => {
                                                                        const photoUrl = inst.user?.profile?.portraitUrl || inst.user?.profile?.avatarUrl;
                                                                        const name = inst.user?.profile?.firstName || '?';
                                                                        return photoUrl ? (
                                                                            <img key={inst.id} src={photoUrl} alt={name} className="inline-block h-4 w-4 rounded-full ring-1 ring-white dark:ring-zinc-900 object-cover" title={name} />
                                                                        ) : (
                                                                            <div key={inst.id} className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-1 ring-white dark:ring-zinc-900" title={name}>
                                                                                <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300">{name.charAt(0)}</span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : event.resource?.instructor ? (
                                                                    (() => {
                                                                        const inst = event.resource.instructor;
                                                                        const photoUrl = inst.user?.profile?.portraitUrl || inst.user?.profile?.avatarUrl;
                                                                        const name = inst.user?.profile?.firstName || '?';
                                                                        return photoUrl ? (
                                                                            <img src={photoUrl} alt={name} className="inline-block h-4 w-4 rounded-full ring-1 ring-white dark:ring-zinc-900 object-cover" title={name} />
                                                                        ) : (
                                                                            <div className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-1 ring-white dark:ring-zinc-900" title={name}>
                                                                                <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300">{name.charAt(0)}</span>
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            });
                                        })()}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
