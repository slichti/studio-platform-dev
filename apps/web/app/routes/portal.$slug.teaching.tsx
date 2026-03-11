import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Calendar as CalendarIcon, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    if (!token || !slug) {
        return { classes: [] };
    }

    try {
        // First resolve the current member to get their instructor memberId
        const me = await apiRequest<{ member: any }>(`/members/me`, token, {
            headers: { 'X-Tenant-Slug': slug }
        }).catch(() => null);

        const member = (me as any)?.member;
        const isInstructor = Array.isArray(member?.roles) && member.roles.some((r: any) => r.role === 'instructor');
        if (!member || !isInstructor) {
            return { classes: [], isInstructor: false };
        }

        // Fetch upcoming classes where this member is the primary instructor
        const nowIso = new Date().toISOString();
        const classes = await apiRequest<any[]>(`/classes?instructorId=${member.id}&start=${nowIso}`, token, {
            headers: { 'X-Tenant-Slug': slug }
        }).catch(() => []);

        return { classes, isInstructor: true };
    } catch (e) {
        console.error("Teaching Schedule Loader Error:", e);
        return { classes: [], isInstructor: false };
    }
};

export default function InstructorTeachingSchedule() {
    const data = useLoaderData<typeof loader>();
    const classes = data.classes || [];

    if (!data.isInstructor) {
        return (
            <div className="max-w-3xl mx-auto py-12 text-center text-zinc-500">
                <p>This page is only available for instructors.</p>
            </div>
        );
    }

    const grouped = (classes || []).reduce((acc: Record<string, any[]>, cls: any) => {
        const dateKey = format(new Date(cls.startTime), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(cls);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Teaching Schedule</h1>
            </div>

            {classes.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                    <CalendarIcon className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No upcoming classes</h3>
                    <p className="text-zinc-500 dark:text-zinc-400">Once you’re assigned to teach, your classes will appear here.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(grouped).map(([dateKey, items]) => (
                        <div key={dateKey} className="space-y-4">
                            <div className="sticky top-0 bg-zinc-50/95 dark:bg-zinc-950/95 py-2 z-10 backdrop-blur border-b border-zinc-100 dark:border-zinc-900 flex items-center gap-2">
                                <CalendarIcon size={16} className="text-zinc-400" />
                                <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    {format(new Date(dateKey), 'EEEE, MMMM do')}
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {items.map((cls: any) => {
                                    const startTime = new Date(cls.startTime);
                                    return (
                                        <div key={cls.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-5">
                                            <div className="flex flex-col items-center justify-center min-w-[5rem] border-r border-zinc-100 dark:border-zinc-800 pr-5">
                                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                    {format(startTime, 'h:mm a')}
                                                </span>
                                                <span className="text-xs text-zinc-500">{cls.durationMinutes} min</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg mb-1">{cls.title}</h3>
                                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                                                    <div className="flex items-center gap-1.5">
                                                        <User size={14} />
                                                        <span>{cls.instructor?.user?.profile?.firstName || "You"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={14} />
                                                        <span>{cls.location?.name || "Main Studio"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={14} />
                                                        <span>{format(startTime, 'p')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

