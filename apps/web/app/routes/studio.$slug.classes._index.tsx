import { useParams, useOutletContext, useSearchParams } from "react-router";
import { useState } from "react";
import { Plus, Archive, ArchiveRestore, Filter, Calendar as CalendarIcon, Clock, Users, Video } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { CreateClassModal } from "../components/CreateClassModal";
import { BookingModal } from "../components/BookingModal";

import { useClasses } from "~/hooks/useClasses";
import { useUser } from "~/hooks/useUser";
import { useMembers } from "~/hooks/useMembers"; // Hijack for instructors
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

// Types
type ClassEvent = {
    id: string;
    title: string;
    description: string;
    startTime: string;
    durationMinutes: number;
    instructorId: string;
    price: number;
    capacity?: number;
    confirmedCount?: number;
    userBookingStatus?: string;
    zoomEnabled?: boolean;
    virtualCount?: number;
    inPersonCount?: number;
    userBooking?: {
        id: string;
        attendanceType: 'in_person' | 'zoom';
    };
    status: 'active' | 'cancelled' | 'archived';
    instructor?: {
        user?: {
            profile?: {
                firstName: string;
                lastName: string;
            }
        }
    }
};

export default function StudioPublicClasses() {
    const { slug } = useParams();
    const { roles, tenant, me, member } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // Permissions
    const isAdmin = roles?.includes('owner') || roles?.includes('instructor');
    const includeArchived = searchParams.get("includeArchived") === "true";

    // Hooks
    const { data: classes = [], isLoading: isLoadingClasses, error } = useClasses(slug!, {
        status: includeArchived ? 'all' : 'active'
    });

    // User Data (for bookings)
    const { data: userData } = useUser(slug);
    const family = userData?.family || [];

    // Metadata (Instructors, Locations, Plans) - Could be hooks too, but we might fetch on demand or simply use existing endpoints
    // For now, let's keep separate simple fetch since useClasses only returns classes.
    // Ideally we pass metadata to Modals.
    // I'll stick to a simple useEffect fetch for metadata if Modals need it, OR assume Modals handle their own fetching?
    // Checking original file: CreateClassModal needs locations, instructors, plans.
    // I will fetch these once or create quick hooks. 
    // Let's create a quick combined hook or just fetch in component for now to keep it simple.

    const [metadata, setMetadata] = useState<{ locations: any[], instructors: any[], plans: any[] }>({ locations: [], instructors: [], plans: [] });

    // Fetch Metadata on mount (only if admin)
    useState(() => {
        if (!isAdmin) return;
        const fetchMetadata = async () => {
            const token = await getToken();
            if (!token) return;
            try {
                const [locs, insts, plns] = await Promise.all([
                    apiRequest("/locations", token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => ({ locations: [] })),
                    apiRequest("/members?role=instructor", token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => ({ members: [] })),
                    apiRequest("/memberships/plans", token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => [])
                ]);
                setMetadata({
                    locations: (locs as any).locations || [],
                    instructors: (insts as any).members || [],
                    plans: plns || []
                });
            } catch (e) { console.error("Metadata fetch error", e); }
        };
        fetchMetadata();
    });

    // State
    const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [confirmArchiveData, setConfirmArchiveData] = useState<{ id: string, archive: boolean } | null>(null);
    const [confirmCancelData, setConfirmCancelData] = useState<{ bookingId: string, classId: string } | null>(null);

    // Group Classes
    const grouped = classes.reduce((acc: Record<string, ClassEvent[]>, cls: ClassEvent) => {
        const date = new Date(cls.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(cls);
        return acc;
    }, {} as Record<string, ClassEvent[]>);

    // Handlers
    const handleBookClick = (cls: ClassEvent) => {
        if (family.length > 0 || cls.zoomEnabled) {
            setSelectedClass(cls);
        } else {
            // Direct book logic (could be modal-less but keeping modal for simplicity/consistency)
            setSelectedClass(cls);
        }
    };

    const handleCreateSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['classes', slug] });
        setIsCreateOpen(false);
    };

    const confirmArchiveAction = async () => {
        if (!confirmArchiveData) return;
        const { id, archive } = confirmArchiveData;
        try {
            const token = await getToken();
            const res = await apiRequest(`/classes/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ status: archive ? 'archived' : 'active' })
            });

            // Optimistic update or refetch
            queryClient.invalidateQueries({ queryKey: ['classes', slug] });
            toast.success(archive ? "Class archived" : "Class restored");
        } catch (e) {
            toast.error("Failed to update class status");
        } finally {
            setConfirmArchiveData(null);
        }
    };

    const confirmCancelAction = async () => {
        if (!confirmCancelData) return;
        try {
            const token = await getToken();
            await apiRequest(`/bookings/${confirmCancelData.bookingId}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            });
            queryClient.invalidateQueries({ queryKey: ['classes', slug] });
            toast.success("Booking cancelled");
        } catch (e: any) {
            toast.error(e.message || "Failed to cancel");
        } finally {
            setConfirmCancelData(null);
        }
    };

    const joinWaitlist = async (cls: ClassEvent) => {
        try {
            const token = await getToken();
            const res = await apiRequest(`/waitlist/${cls.id}/join`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({})
            });
            queryClient.invalidateQueries({ queryKey: ['classes', slug] });
            toast.success("Joined waitlist");
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleQuickBook = async (cls: ClassEvent) => {
        // If simply booking for self in-person
        try {
            const token = await getToken();
            const res = await apiRequest("/bookings", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ classId: cls.id, attendanceType: 'in_person' })
            });
            queryClient.invalidateQueries({ queryKey: ['classes', slug] });
            toast.success("Class booked!");
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Class Schedule</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">View and book upcoming classes.</p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <>
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
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" /> Create Class
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <ComponentErrorBoundary>
                <div className="space-y-8">
                    {isLoadingClasses ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="opacity-50">
                                <CardContent className="p-6 h-24 animate-pulse bg-zinc-100 dark:bg-zinc-800">
                                    <div />
                                </CardContent>
                            </Card>
                        ))
                    ) : Object.keys(grouped).length === 0 ? (
                        <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                            No upcoming classes scheduled.
                        </div>
                    ) : (
                        (Object.entries(grouped) as [string, ClassEvent[]][]).map(([date, events]) => (
                            <div key={date} className="space-y-4">
                                <div className="sticky top-0 bg-white/95 dark:bg-zinc-950/95 py-2 z-10 backdrop-blur border-b border-zinc-100 dark:border-zinc-900">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <CalendarIcon className="h-5 w-5 text-zinc-400 ml-1" />
                                        {date}
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {events.map((cls) => (
                                        <Card key={cls.id} className={cn(
                                            "transition-all hover:shadow-md",
                                            cls.status === 'archived' && "opacity-60 bg-zinc-50 dark:bg-zinc-900/50"
                                        )}>
                                            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{cls.title}</span>
                                                        {cls.status === 'archived' && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                                                        {cls.userBookingStatus === 'confirmed' && <Badge variant="success" className="text-xs">Booked</Badge>}
                                                        {cls.userBookingStatus === 'waitlisted' && <Badge variant="warning" className="text-xs">Waitlisted</Badge>}
                                                    </div>

                                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="h-4 w-4" />
                                                            {new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                            {cls.durationMinutes} min
                                                        </div>
                                                        {cls.instructor?.user?.profile && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Users className="h-4 w-4" />
                                                                with {cls.instructor.user.profile.firstName}
                                                            </div>
                                                        )}
                                                        {cls.zoomEnabled && (
                                                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                                <Video className="h-4 w-4" />
                                                                Virtual Option
                                                            </div>
                                                        )}
                                                    </div>

                                                    {cls.capacity && (
                                                        <div className="flex gap-2 pt-1">
                                                            <Badge variant="outline" className={cn("font-normal", (cls.inPersonCount || 0) >= cls.capacity ? "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30" : "")}>
                                                                In-Person: {cls.inPersonCount || 0} / {cls.capacity}
                                                            </Badge>
                                                            {cls.zoomEnabled && (
                                                                <Badge variant="outline" className="font-normal text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-900/30">
                                                                    Virtual: {cls.virtualCount || 0}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    {isAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setConfirmArchiveData({ id: cls.id, archive: cls.status !== 'archived' })}
                                                            title={cls.status === 'archived' ? 'Restore Class' : 'Archive Class'}
                                                        >
                                                            {cls.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                        </Button>
                                                    )}

                                                    {cls.status !== 'archived' && (
                                                        me ? (
                                                            cls.userBookingStatus === 'confirmed' ? (
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => setConfirmCancelData({ bookingId: cls.userBooking!.id, classId: cls.id })}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            ) : cls.userBookingStatus === 'waitlisted' ? (
                                                                <Button variant="secondary" disabled size="sm">On Waitlist</Button>
                                                            ) : (
                                                                ((cls.inPersonCount || 0) >= (cls.capacity || Infinity) && !cls.zoomEnabled) ? (
                                                                    <Button variant="secondary" onClick={() => joinWaitlist(cls)}>Join Waitlist</Button>
                                                                ) : (
                                                                    <Button onClick={() => family.length > 0 || cls.zoomEnabled ? setSelectedClass(cls) : handleQuickBook(cls)}>
                                                                        Book Class
                                                                    </Button>
                                                                )
                                                            )
                                                        ) : (
                                                            <a href="/sign-in" className={cn(buttonVariants({ variant: "outline" }))}>
                                                                Login to Book
                                                            </a>
                                                        )
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ComponentErrorBoundary>

            <CreateClassModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleCreateSuccess}
                tenantId={tenant?.id}
                locations={metadata.locations}
                instructors={metadata.instructors}
                plans={metadata.plans}
            />

            <BookingModal
                isOpen={!!selectedClass}
                onClose={() => setSelectedClass(null)}
                classEvent={selectedClass}
                family={family}
                member={userData?.profile?.id ? { id: userData.profile.id, ...userData.profile } : member} // Adjust member object for modal
            />

            <ConfirmationDialog
                isOpen={!!confirmArchiveData}
                onClose={() => setConfirmArchiveData(null)}
                onConfirm={confirmArchiveAction}
                title={confirmArchiveData?.archive ? "Archive Class" : "Restore Class"}
                message={`Are you sure you want to ${confirmArchiveData?.archive ? 'archive' : 'unarchive'} this class?`}
                confirmText={confirmArchiveData?.archive ? "Archive" : "Restore"}
                isDestructive={confirmArchiveData?.archive}
            />

            <ConfirmationDialog
                isOpen={!!confirmCancelData}
                onClose={() => setConfirmCancelData(null)}
                onConfirm={confirmCancelAction}
                title="Cancel Booking"
                message="Are you sure you want to cancel this booking?"
                confirmText="Cancel Booking"
                isDestructive
            />
        </div>
    );
}
