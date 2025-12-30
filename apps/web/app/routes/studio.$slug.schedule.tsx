// @ts-ignore
import { useLoaderData, useOutletContext } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { CreateClassModal } from "../components/CreateClassModal";
import { ClassDetailModal } from "../components/ClassDetailModal";
import { Plus } from "lucide-react";

// Setup Localizer
const locales = {
    "en-US": enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken, userId } = await getAuth(args);
    if (!userId) {
        return { classes: [], locations: [], instructors: [], error: "Unauthorized" };
    }
    const token = await getToken();

    // Fetch classes, locations, and instructors parallel
    try {
        const [classes, locationsRes, instructorsRes] = await Promise.all([
            apiRequest("/classes", token),
            apiRequest("/locations", token, { headers: { 'X-Tenant-Slug': params.slug! } }),
            apiRequest("/members?role=instructor", token, { headers: { 'X-Tenant-Slug': params.slug! } })
        ]);

        return {
            classes: classes || [],
            locations: (locationsRes as any).locations || [],
            instructors: (instructorsRes as any).members || [],
            error: null
        };
    } catch (e: any) {
        console.error("Failed to fetch schedule data", e);
        return { classes: [], locations: [], instructors: [], error: "Failed to load schedule" };
    }
};

export default function StudioSchedule() {
    const { classes: initialClasses, locations, instructors, error } = useLoaderData<any>();
    const { tenant, features } = useOutletContext<any>() || {};
    const [classes, setClasses] = useState(initialClasses || []);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<any>(null);

    // Map API classes to Calendar events
    const events = classes.map((c: any) => ({
        id: c.id,
        title: c.title,
        start: new Date(c.startTime),
        end: new Date(new Date(c.startTime).getTime() + c.durationMinutes * 60000),
        resource: c
    }));

    const handleCreateSuccess = (newClass: any) => {
        setClasses([...classes, newClass]);
    };

    const handleSelectSlot = useCallback(
        ({ start }: { start: Date }) => {
            // Optional: Pre-fill date when clicking on calendar slot
            // For now just open modal
            setIsCreateOpen(true);
        },
        []
    );

    const handleSelectEvent = useCallback((event: any) => {
        setSelectedClass(event.resource);
        setIsDetailOpen(true);
    }, []);

    const handleRecordingAdded = (classId: string, videoId: string) => {
        // Update local state to reflect change
        setClasses(classes.map((c: any) => {
            if (c.id === classId) {
                return {
                    ...c,
                    cloudflareStreamId: videoId,
                    recordingStatus: 'processing'
                };
            }
            return c;
        }));
    };

    return (
        <div className="p-6 h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Schedule</h1>
                    <p className="text-zinc-500 text-sm mt-1">Manage your class calendar and bookings.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                    <Plus size={16} />
                    Schedule Class
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    {error}
                </div>
            )}

            <div className="flex-1 bg-white rounded-lg shadow border border-zinc-200 p-4">
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    defaultView={Views.WEEK}
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={(event) => ({
                        style: {
                            backgroundColor: '#eff6ff', // blue-50
                            border: '1px solid #bfdbfe', // blue-200
                            color: '#1e40af', // blue-800
                            fontSize: '0.85rem',
                            borderRadius: '4px'
                        }
                    })}
                />
            </div>

            <CreateClassModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleCreateSuccess}
                tenantId={tenant?.id}
                locations={locations}
                instructors={instructors}
            />

            <ClassDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                classEvent={selectedClass}
                classEvent={selectedClass}
                onRecordingAdded={handleRecordingAdded}
                canAttachRecording={features?.has('vod')}
            />
        </div>
    );
}
