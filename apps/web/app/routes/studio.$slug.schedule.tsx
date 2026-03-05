import { useParams, useOutletContext } from "react-router";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Plus, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { WeeklyCalendar } from "../components/schedule/WeeklyCalendar";
import { CreateClassModal } from "../components/CreateClassModal";
import { EditClassModal } from "../components/EditClassModal";
import { ClassDetailModal } from "../components/ClassDetailModal";
import { BookingModal } from "../components/BookingModal";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { Button } from "~/components/ui/button";
import { ListIcon, Calendar as CalendarIcon } from "lucide-react";

import { useClasses } from "~/hooks/useClasses";
import { useUser } from "~/hooks/useUser";
import { useStudioData } from "~/hooks/useStudioData";
import { useCourses } from "~/hooks/useCourses";
import { usePlans } from "~/hooks/useMemberships";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";
import { useSearchParams } from "react-router";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";

const ClassesPage = lazy(() => import("~/components/routes/ClassesPage"));


function StudioScheduleCalendarView({ slug, isStudentView, roles, features, tenant, coursesData, me }: any) {
    const queryClient = useQueryClient();
    const canSchedule = !isStudentView && (roles?.includes('owner') || roles?.includes('instructor'));
    const [searchParams, setSearchParams] = useSearchParams();

    // Data Fetching
    const { data: classesData = [], isLoading: isLoadingClasses, error } = useClasses(slug!);
    const { data: studioData } = useStudioData(slug!);
    const { data: userData } = useUser(slug);
    const { data: plansData = [] } = usePlans(slug!);

    const family = userData?.family || [];
    const locations = studioData?.locations || [];
    const instructors = studioData?.instructors || [];


    // Local State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<any>(null);

    // Derived State
    const events = useMemo(() => classesData
        .filter((c: any) => c.status !== 'cancelled')
        .map((c: any) => ({
            id: c.id,
            title: c.title,
            start: new Date(c.startTime),
            end: new Date(new Date(c.startTime).getTime() + c.durationMinutes * 60000),
            resource: c
        })), [classesData]);

    // Keep selectedClass in sync with classesData updates (e.g. after booking)
    useEffect(() => {
        if (selectedClass) {
            const updated = classesData.find((c: any) => c.id === selectedClass.id);
            if (updated) {
                if (JSON.stringify(updated) !== JSON.stringify(selectedClass)) {
                    setSelectedClass(updated);
                }
            } else {
                // Class was removed or no longer in data — close detail modal
                setIsDetailOpen(false);
            }
        }
    }, [classesData]);

    // Handlers
    const handleCreateSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['classes', slug] });
        setIsCreateOpen(false);
    };

    const handleEditSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['classes', slug] });
        setIsEditOpen(false);
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

    // Calendar settings
    const isAdmin = !isStudentView && (roles?.includes('owner') || roles?.includes('admin'));
    const [showCalSettings, setShowCalSettings] = useState(false);
    const [calStart, setCalStart] = useState<number>((tenant?.settings as any)?.calendarStartHour ?? 5);
    const [calEnd, setCalEnd] = useState<number>((tenant?.settings as any)?.calendarEndHour ?? 24);
    const calSettingsRef = useRef<HTMLDivElement>(null);
    const { getToken } = useAuth();

    // Close popover on outside click
    useEffect(() => {
        if (!showCalSettings) return;
        const handler = (e: MouseEvent) => {
            if (calSettingsRef.current && !calSettingsRef.current.contains(e.target as Node)) setShowCalSettings(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCalSettings]);

    const saveCalendarSettings = async (start: number, end: number) => {
        if (start >= end) return;
        setCalStart(start);
        setCalEnd(end);
        try {
            const token = await getToken();
            await apiRequest(`/studios/${tenant?.id}/calendar-settings`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ calendarStartHour: start, calendarEndHour: end })
            });
        } catch (e) { console.error('Failed to save calendar settings', e); }
    };

    const hourLabel = (h: number) => h === 0 ? '12 AM' : h === 12 ? '12 PM' : h === 24 ? '12 AM' : h > 12 ? `${h - 12} PM` : `${h} AM`;

    return (
        <div className="p-6 h-screen flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Schedule</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        {isStudentView ? "View upcoming classes and book sessions." : "Manage your class calendar and bookings."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 mr-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                        >
                            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Calendar
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs text-zinc-500 hover:text-zinc-900"
                            onClick={() => {
                                const p = new URLSearchParams(searchParams);
                                p.set('view', 'list');
                                setSearchParams(p);
                            }}
                        >
                            <ListIcon className="h-3.5 w-3.5 mr-1.5" /> List
                        </Button>
                    </div>

                    {canSchedule && (
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Schedule Class
                        </Button>
                    )}
                    {isAdmin && (
                        <div className="relative" ref={calSettingsRef}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowCalSettings(!showCalSettings)} title="Calendar Settings">
                                <Settings className="h-4 w-4" />
                            </Button>
                            {showCalSettings && (
                                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-4 z-50 w-64">
                                    <h3 className="text-sm font-semibold mb-3 text-zinc-900 dark:text-zinc-100">Calendar Hours</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-zinc-500 mb-1 block">Start Time</label>
                                            <select className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700" value={calStart} onChange={(e) => saveCalendarSettings(Number(e.target.value), calEnd)}>
                                                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{hourLabel(i)}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500 mb-1 block">End Time</label>
                                            <select className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700" value={calEnd} onChange={(e) => saveCalendarSettings(calStart, Number(e.target.value))}>
                                                {Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{hourLabel(h === 24 ? 0 : h)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ComponentErrorBoundary>
                <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
                    {isLoadingClasses ? (
                        <div className="p-8 h-full">
                            <SkeletonLoader type="card" count={1} className="h-full" />
                        </div>
                    ) : (
                        <WeeklyCalendar
                            events={events}
                            onSelectEvent={handleSelectEvent}
                            onSelectSlot={handleSelectSlot}
                            defaultDate={new Date()}
                            startHour={calStart}
                            endHour={calEnd}
                        />
                    )}
                </div>
            </ComponentErrorBoundary>

            <CreateClassModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleCreateSuccess}
                tenantId={tenant?.id}
                locations={locations}
                instructors={instructors}
                courses={coursesData}
                plans={plansData}
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
                onEditRequested={() => {
                    setIsDetailOpen(false);
                    setIsEditOpen(true);
                }}
                onClassUpdated={refreshClasses}
            />

            {isEditOpen && selectedClass && (
                <EditClassModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    onSuccess={handleEditSuccess}
                    tenantId={tenant?.id}
                    locations={locations}
                    instructors={instructors}
                    courses={coursesData}
                    plans={plansData}
                    initialData={selectedClass}
                />
            )}

            <BookingModal
                isOpen={isBookingOpen}
                onClose={() => setIsBookingOpen(false)}
                classEvent={selectedClass}
                family={family}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['classes', slug] });
                    queryClient.invalidateQueries({ queryKey: ['user'] });
                }}
            />
        </div>
    );
}

export default function StudioSchedule() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const viewMode = searchParams.get('view') || 'calendar';

    // Context & Hooks
    const { tenant, me, features, roles, isStudentView } = useOutletContext<any>() || {};

    const { data: coursesData = [] } = useCourses(slug!, { status: 'active' });

    if (viewMode === 'list') {
        return (
            <ClientOnly fallback={<div className="p-8">Loading Schedule...</div>}>
                <Suspense fallback={<div className="p-8">Loading Schedule...</div>}>
                    <div className="max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8">
                        <ClassesPage />
                    </div>
                </Suspense>
            </ClientOnly>
        );
    }

    return (
        <StudioScheduleCalendarView
            slug={slug}
            isStudentView={isStudentView}
            roles={roles}
            features={features}
            tenant={tenant}
            coursesData={coursesData}
            me={me}
        />
    );
}
