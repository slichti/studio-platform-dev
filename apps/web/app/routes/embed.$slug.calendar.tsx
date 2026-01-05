// @ts-ignore
import { useLoaderData, useOutletContext } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { format } from "date-fns";
import { ExternalLink, Calendar as CalendarIcon, MapPin, Video } from "lucide-react";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const { slug } = params;
    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";

    try {
        const res = await fetch(`${API_URL}/classes`, {
            headers: { 'X-Tenant-Slug': slug as string }
        });
        if (!res.ok) throw new Error("Failed to load classes");
        const classes = await res.json();
        return { classes: Array.isArray(classes) ? classes : [] };
    } catch (e) {
        return { classes: [], error: "Could not load schedule." };
    }
};

export default function EmbedCalendar() {
    const { classes, error } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>() as any;

    const grouped = (classes || []).reduce((acc: any, cls: any) => {
        const date = new Date(cls.startTime);
        const key = format(date, "EEEE, MMMM d");
        if (!acc[key]) acc[key] = [];
        acc[key].push(cls);
        return acc;
    }, {});

    const handleBook = () => {
        const url = `${window.location.origin}/studio/${tenant.slug}/classes`;
        window.open(url, '_blank');
    };

    if (error) {
        return <div className="p-4 text-red-500 text-sm text-center">{error}</div>;
    }

    if (classes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-zinc-500 bg-white border rounded">
                <CalendarIcon className="mb-2 opacity-50" />
                <p className="text-sm">No classes scheduled.</p>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-[400px]">
            {(Object.entries(grouped) as [string, any[]][]).map(([date, events]) => (
                <div key={date} className="mb-6 last:mb-0">
                    <h3 className="sticky top-0 z-10 bg-white/95 backdrop-blur py-2 px-4 border-b border-zinc-100 font-bold text-zinc-900 text-lg shadow-sm">
                        {date}
                    </h3>
                    <div className="divide-y divide-zinc-100">
                        {events.map((cls) => (
                            <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-zinc-900 truncate">{cls.title}</span>
                                        {cls.zoomEnabled && <Video size={14} className="text-blue-500" />}
                                    </div>
                                    <div className="text-sm text-zinc-500 flex flex-wrap gap-x-3 items-center">
                                        <span className="font-medium text-zinc-700">
                                            {format(new Date(cls.startTime), "h:mm a")}
                                        </span>
                                        <span className="text-zinc-300">•</span>
                                        <span>{cls.durationMinutes} min</span>
                                        {cls.instructor?.user?.profile?.firstName && (
                                            <>
                                                <span className="text-zinc-300">•</span>
                                                <span>{cls.instructor.user.profile.firstName}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleBook}
                                    className="shrink-0 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                >
                                    Book
                                    <ExternalLink size={14} className="opacity-70" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
