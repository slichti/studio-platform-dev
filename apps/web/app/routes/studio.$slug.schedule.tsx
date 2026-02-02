import { useParams, useOutletContext } from "react-router";
import { useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { WeeklyCalendar } from "../components/schedule/WeeklyCalendar";
import { CreateClassModal } from "../components/CreateClassModal";
import { ClassDetailModal } from "../components/ClassDetailModal";
import { BookingModal } from "../components/BookingModal";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { Button } from "~/components/ui/button";

import { useClasses } from "~/hooks/useClasses";
import { useUser } from "~/hooks/useUser";
import { useStudioData } from "~/hooks/useStudioData";

export default function StudioSchedule() {
    const { slug } = useParams();
    const queryClient = useQueryClient();

    // Context & Hooks
    const { tenant, me, features, roles, isStudentView } = useOutletContext<any>() || {};
    const canSchedule = !isStudentView && (roles?.includes('owner') || roles?.includes('instructor'));

    // Data Fetching
    const { data: classesData = [], isLoading: isLoadingClasses, error } = useClasses(slug!);
    const { data: studioData } = useStudioData(slug!);
    const { data: userData } = useUser(slug);

    const family = userData?.family || [];
    const locations = studioData?.locations || [];
    const instructors = studioData?.instructors || [];

    // Local State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<any>(null);

    // Derived State
    const events = useMemo(() => classesData.map((c: any) => ({
        id: c.id,
        title: c.title,
        start: new Date(c.startTime),
        end: new Date(new Date(c.startTime).getTime() + c.durationMinutes * 60000),
        resource: c
    })), [classesData]);

    // Handlers
    const handleCreateSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['classes', slug] });
        setIsCreateOpen(false);
    };

    const handleSelectSlot = useCallback(
        ({ start }: { start: Date }) => {
            if (canSchedule) {
                setIsCreateOpen(true);
            }
        },
        [canSchedule]
    );

    const handleSelectEvent = useCallback((event: any) => {
        setSelectedClass(event.resource);
        setIsDetailOpen(true);
    }, []);

    const refreshClasses = () => {
        queryClient.invalidateQueries({ queryKey: ['classes', slug] });
    };

    return (
        <div className="p-6 h-screen flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Schedule</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        {isStudentView ? "View upcoming classes and book sessions." : "Manage your class calendar and bookings."}
                    </p>
                </div>
                {canSchedule && (
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Schedule Class
                    </Button>
                )}
            </div>

            <ComponentErrorBoundary>
                <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <WeeklyCalendar
                        events={events}
                        onSelectEvent={handleSelectEvent}
                        onSelectSlot={handleSelectSlot}
                        defaultDate={new Date()}
                    />
                </div>
            </ComponentErrorBoundary>

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

                onRecordingAdded={refreshClasses}
                onRecordingDeleted={refreshClasses}
                canAttachRecording={features?.has('vod')}

                currentUserMemberId={me?.member?.id}
                userRoles={me?.roles}
                tenantSlug={tenant?.slug}
                onSubRequested={refreshClasses}
                onBookRequested={() => {
                    setIsDetailOpen(false);
                    setIsBookingOpen(true);
                }}
            />

            <BookingModal
                isOpen={isBookingOpen}
                onClose={() => setIsBookingOpen(false)}
                classEvent={selectedClass}
                family={family}
            />
        </div>
    );
}
