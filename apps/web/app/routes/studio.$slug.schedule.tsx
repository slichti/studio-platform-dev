import { useParams, useOutletContext } from "react-router";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Plus, Settings, CalendarClock, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { WeeklyCalendar } from "../components/schedule/WeeklyCalendar";
import { CreateClassModal } from "../components/CreateClassModal";
import { EditClassModal } from "../components/EditClassModal";
import { ClassDetailModal } from "../components/ClassDetailModal";
import { BookingModal } from "../components/BookingModal";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { Button } from "~/components/ui/button";
import { ListIcon, Calendar as CalendarIcon } from "lucide-react";

import { useInfiniteClasses } from "~/hooks/useClasses";
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


function StudioScheduleCalendarView({ slug, isStudentView, roles, features, tenant, coursesData, me, token }: any) {
    const queryClient = useQueryClient();
    const canSchedule = !isStudentView && (roles?.includes('owner') || roles?.includes('instructor'));
    const [searchParams, setSearchParams] = useSearchParams();
    const includeArchived = searchParams.get("includeArchived") === "true";

    // Data Fetching (mirror list view: useInfiniteClasses)
    // Fetch from the start of the previous month to ensure current and recent upcoming classes are seen
    const startDate = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const {
        data: infiniteData,
        isLoading: isLoadingClasses,
    } = useInfiniteClasses(slug!, {
        status: includeArchived ? 'all' : 'active',
        limit: 200,
        dateRange: { start: startDate, end: new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 365) } // Fetch 1 year window
    }, token);

    const classesData = infiniteData?.pages.flat() || [];
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
    const events = useMemo(
        () =>
            (classesData as any[])
                .filter((c: any) => c.status !== 'cancelled')
                .map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    start: new Date(c.startTime),
                    end: new Date(new Date(c.startTime).getTime() + c.durationMinutes * 60000),
                    resource: c,
                })),
        [classesData]
    );

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
        refreshClasses();
        setIsCreateOpen(false);
    };

    const handleEditSuccess = () => {
        refreshClasses();
        setIsEditOpen(false);
    };

    const [slotStartTime, setSlotStartTime] = useState<Date | null>(null);

    const handleSelectSlot = useCallback(
        ({ start }: { start: Date }) => {
            if (canSchedule) {
                setSlotStartTime(start);
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
        queryClient.invalidateQueries({ queryKey: ['classes-infinite', slug] });
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

    const gotoListView = () => {
        const p = new URLSearchParams(searchParams);
        p.set('view', 'list');
        setSearchParams(p);
    };

    return (
        <div className="p-6 h-screen flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Class Schedule</h1>
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

                    {!isStudentView && (
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer mr-2 select-none">
                            <input
                                type="checkbox"
                                className="rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800"
                                checked={includeArchived}
                                onChange={(e) => {
                                    const newParams = new URLSearchParams(searchParams);
                                    if (e.target.checked) newParams.set("includeArchived", "true");
                                    else newParams.delete("includeArchived");
                                    setSearchParams(newParams);
                                }}
                            />
                            <span className="text-zinc-600 dark:text-zinc-400">Show Archived</span>
                        </label>
                    )}

                    {canSchedule && (
                        <>
                            <Button
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
                                onClick={gotoListView}
                            >
                                <CalendarClock className="h-4 w-4 mr-2" /> Bulk Reschedule
                            </Button>
                            <Button
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                                onClick={gotoListView}
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Bulk Cancel
                            </Button>
                            <Button
                                variant="outline"
                                onClick={gotoListView}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Bulk Schedule
                            </Button>
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Schedule Class
                            </Button>
                        </>
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
                onClose={() => { setIsCreateOpen(false); setSlotStartTime(null); }}
                onSuccess={handleCreateSuccess}
                tenantId={tenant?.id}
                locations={locations}
                instructors={instructors}
                courses={coursesData}
                plans={plansData}
                initialStartTime={slotStartTime}
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
    const { tenant, me, features, roles, isStudentView, token } = useOutletContext<any>() || {};

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
            token={token}
        />
    );
}
