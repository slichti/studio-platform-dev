// @ts-ignore
import { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, redirect, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, MapPin, Video } from "lucide-react";
import { useState, useMemo } from "react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const url = new URL(args.request.url);
    const weekStart = url.searchParams.get("week") || new Date().toISOString().split("T")[0];
    const token = await getToken();

    try {
        const scheduleData = await apiRequest(`/instructor/schedule?weekStart=${weekStart}`, token, { headers: { 'X-Tenant-Slug': slug } }) as any;
        return { classes: scheduleData || [], weekStart };
    } catch (e) {
        console.error("Schedule Loader Error", e);
        return { classes: [], weekStart };
    }
};

export default function InstructorSchedule() {
    const { classes, weekStart } = useLoaderData<typeof loader>();

    // Generate week dates
    const weekDates = useMemo(() => {
        const start = new Date(weekStart);
        const dayOfWeek = start.getDay();
        const monday = new Date(start);
        monday.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return { date: date.toISOString().split("T")[0], day: date };
        });
    }, [weekStart]);

    const getClassesForDay = (dateStr: string) => {
        return classes.filter((cls: any) => {
            const clsDate = new Date(cls.startTime).toISOString().split("T")[0];
            return clsDate === dateStr;
        }).sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    };

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    const navigateWeek = (direction: number) => {
        const current = new Date(weekDates[0].date);
        current.setDate(current.getDate() + (direction * 7));
        window.location.search = `?week=${current.toISOString().split("T")[0]}`;
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2"><Calendar size={20} /> My Schedule</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronLeft size={18} /></button>
                    <span className="text-sm font-medium">
                        {weekDates[0].day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {weekDates[6].day.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronRight size={18} /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-4">
                {weekDates.map(({ date, day }) => {
                    const dayClasses = getClassesForDay(date);
                    const isToday = date === new Date().toISOString().split("T")[0];

                    return (
                        <div key={date} className={`bg-white rounded-xl border ${isToday ? 'border-purple-300 ring-2 ring-purple-100' : 'border-zinc-200'} overflow-hidden`}>
                            <div className={`p-3 text-center ${isToday ? 'bg-purple-50' : 'bg-zinc-50'} border-b border-zinc-100`}>
                                <div className="text-xs font-medium text-zinc-500">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                <div className={`text-lg font-bold ${isToday ? 'text-purple-700' : 'text-zinc-900'}`}>{day.getDate()}</div>
                            </div>
                            <div className="p-2 space-y-2 min-h-[200px]">
                                {dayClasses.length === 0 ? (
                                    <p className="text-xs text-zinc-400 text-center py-4">No classes</p>
                                ) : (
                                    dayClasses.map((cls: any) => (
                                        <div key={cls.id} className="p-2 bg-purple-50 rounded-lg text-xs">
                                            <div className="font-medium text-purple-800 truncate">{cls.title}</div>
                                            <div className="text-purple-600 flex items-center gap-1 mt-1">
                                                <Clock size={10} /> {formatTime(cls.startTime)}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-zinc-500">
                                                <span className="flex items-center gap-1"><Users size={10} /> {cls.confirmedCount || 0}</span>
                                                {cls.videoProvider === 'livekit' && <Video size={10} />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
