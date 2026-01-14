// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Form, useNavigation, useFetcher, useActionData, useSearchParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { CreateClassModal } from "../components/CreateClassModal";
import { Plus, Archive, ArchiveRestore } from "lucide-react";
import { BookingModal } from "../components/BookingModal";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

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
        id: string; // Booking ID
        attendanceType: 'in_person' | 'zoom';
    };
    status: 'active' | 'cancelled' | 'archived';
};

type FamilyMember = {
    userId: string;
    memberId: string | null;
    firstName: string;
    lastName: string;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { params, request } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    try {
        const [classes, familyRes, locationsRes, instructorsRes, plansRes] = await Promise.all([
            apiRequest(`/classes${includeArchived ? '?includeArchived=true' : ''}`, token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }),
            apiRequest("/users/me/family", token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }).catch(() => ({ family: [] })) as Promise<{ family: FamilyMember[] }>,
            apiRequest("/locations", token, { headers: { 'X-Tenant-Slug': params.slug! } }).catch(() => ({ locations: [] })),
            apiRequest("/members?role=instructor", token, { headers: { 'X-Tenant-Slug': params.slug! } }).catch(() => ({ members: [] })),
            apiRequest("/memberships/plans", token, { headers: { 'X-Tenant-Slug': params.slug! } }).catch(() => [])
        ]);

        return {
            classes,
            family: familyRes.family || [],
            locations: (locationsRes as any).locations || [],
            instructors: (instructorsRes as any).members || [],
            plans: plansRes || []
        };
    } catch (e: any) {
        console.error("Failed to load classes", e);
        return { classes: [], family: [], locations: [], instructors: [], error: e.message };
    }
};


export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const formData = await request.formData();
    const intent = formData.get("intent");
    const classId = formData.get("classId") as string;
    const attendanceType = formData.get("attendanceType");
    const memberId = formData.get("memberId"); // For family booking

    if (!token) return { error: "Unauthorized" };

    try {
        if (intent === "book") {
            const body: any = { classId, attendanceType: attendanceType || 'in_person' };
            if (memberId) body.memberId = memberId;

            await apiRequest("/bookings", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify(body)
            });
            return { success: true };
        }

        if (intent === "waitlist") {
            // New Waitlist Logic
            const body: any = {};
            if (memberId) body.userId = memberId; // Assuming waitlist API handles family via userId or we need memberId logic. 
            // My waitlist API uses `c.get('user')`. If booking for family, user ID might differ? 
            // Waitlist table is `userId`. Family member has `userId`.
            // Ideally passing `memberId` to waitlist API and resolving user is better. 
            // BUT, for now, simple implementation assuming acting user.
            // If family member, we need to handle that.
            // Let's stick to simple user waitlist for now.
            // Or pass memberId if my API supports it (it doesn't yet).

            await apiRequest(`/waitlist/${classId}/join`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify(body) // Body ignored by current impl but good for future
            });
            return { success: true };
        }

        if (intent === "cancel_booking") {
            const bookingId = formData.get("bookingId") as string;
            await apiRequest(`/bookings/${bookingId}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': params.slug! }
            });
            return { success: true };
        }

        if (intent === "switch_attendance") {
            const bookingId = formData.get("bookingId") as string;
            await apiRequest(`/bookings/${bookingId}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ attendanceType })
            });
            return { success: true };
        }

    } catch (e: any) {
        return { error: e.message || "Action failed" };
    }
    return null;
};


export default function StudioPublicClasses() {
    const { classes: initialClasses, family, error, locations, instructors, plans } = useLoaderData<any>();
    const { member, roles, tenant, me } = useOutletContext<any>() || {};
    const fetcher = useFetcher();
    const [searchParams, setSearchParams] = useSearchParams();

    // Local State
    const [classes, setClasses] = useState(initialClasses);

    useEffect(() => {
        setClasses(initialClasses);
    }, [initialClasses]);

    // Booking Modal State
    const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const isAdmin = roles?.includes('owner') || roles?.includes('instructor');

    // Confirm Dialog States
    const [confirmArchiveData, setConfirmArchiveData] = useState<{ id: string, archive: boolean } | null>(null);
    const [confirmCancelData, setConfirmCancelData] = useState<{ bookingId: string, classId: string } | null>(null);

    // Helpers
    const handleBookClick = (cls: ClassEvent) => {
        if (family.length > 0) {
            setSelectedClass(cls);
        } else {
            // Direct click logic handled in render, but if we need modal for zoom choice:
            if (cls.zoomEnabled) {
                setSelectedClass(cls);
            }
        }
    };

    const handleCreateSuccess = (newClass: any) => {
        setClasses([...classes, newClass]);
    };

    const handleArchiveClick = (classId: string, archive: boolean) => {
        setConfirmArchiveData({ id: classId, archive });
    };

    const confirmArchiveAction = async () => {
        if (!confirmArchiveData) return;
        const { id, archive } = confirmArchiveData;

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/classes/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ status: archive ? 'archived' : 'active' })
            });
            setClasses(classes.map((c: ClassEvent) => c.id === id ? { ...c, status: archive ? 'archived' : 'active' } : c));
            toast.success(archive ? "Class archived" : "Class restored");
        } catch (e) {
            toast.error("Failed to update class status");
        } finally {
            setConfirmArchiveData(null);
        }
    };

    const confirmCancelAction = () => {
        if (!confirmCancelData) return;
        fetcher.submit(
            { intent: "cancel_booking", bookingId: confirmCancelData.bookingId, classId: confirmCancelData.classId },
            { method: "post" }
        );
        setConfirmCancelData(null);
    };

    const grouped = classes.reduce((acc: Record<string, ClassEvent[]>, cls: ClassEvent) => {
        const date = new Date(cls.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(cls);
        return acc;
    }, {} as Record<string, ClassEvent[]>);

    return (
        <div>
            <CreateClassModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleCreateSuccess}
                tenantId={tenant?.id}
                locations={locations}
                instructors={instructors}
                plans={plans}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Class Schedule</h2>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <>
                            <label className="flex items-center gap-1.5 text-sm cursor-pointer mr-2">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-300"
                                    checked={searchParams.get("includeArchived") === "true"}
                                    onChange={(e) => {
                                        const newParams = new URLSearchParams(searchParams);
                                        if (e.target.checked) newParams.set("includeArchived", "true");
                                        else newParams.delete("includeArchived");
                                        setSearchParams(newParams);
                                    }}
                                />
                                <span className="text-zinc-600 dark:text-zinc-400">Show Archived</span>
                            </label>
                            <button
                                onClick={() => setIsCreateOpen(true)}
                                className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md hover:opacity-90 transition-opacity font-medium text-sm"
                            >
                                <Plus size={16} />
                                Create Class
                            </button>
                        </>
                    )}
                    {!me && (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Sign in to book classes.
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    Failed to load schedule: {error}
                </div>
            )}

            {/* Booking Modal */}
            <BookingModal
                isOpen={!!selectedClass}
                onClose={() => setSelectedClass(null)}
                classEvent={selectedClass}
                family={family}
                member={member}
            />

            <div className="space-y-8">
                {Object.keys(grouped).length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                        No upcoming classes scheduled.
                    </div>
                ) : (
                    (Object.entries(grouped) as [string, ClassEvent[]][]).map(([date, events]) => (
                        <div key={date}>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3 sticky top-0 bg-zinc-50/95 dark:bg-zinc-950/95 py-2 backdrop-blur">{date}</h3>
                            <div className="space-y-3">
                                {events.map((cls: ClassEvent) => (
                                    <div key={cls.id} className={`p-4 rounded-lg border shadow-sm transition-colors flex justify-between items-center ${cls.status === 'archived' ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-60' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-zinc-900 dark:text-zinc-100">{cls.title}</div>
                                                {cls.status === 'archived' && <span className="text-[10px] uppercase bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">Archived</span>}
                                            </div>
                                            <div className="text-sm text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-3">
                                                <span>{new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {cls.durationMinutes} min</span>
                                                {(cls as any).instructor?.user?.profile && (
                                                    <span>with {(cls as any).instructor.user.profile.firstName}</span>
                                                )}
                                                {cls.capacity && (
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <span className={`px-1.5 py-0.5 rounded ${((cls.inPersonCount || 0) >= cls.capacity) ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                                            In-Person: {(cls.inPersonCount || 0)} / {cls.capacity}
                                                        </span>
                                                        {cls.zoomEnabled && (
                                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                                Virtual: {(cls.virtualCount || 0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {/* Admin Actions */}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleArchiveClick(cls.id, cls.status !== 'archived')}
                                                    className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded"
                                                    title={cls.status === 'archived' ? 'Restore Class' : 'Archive Class'}
                                                >
                                                    {cls.status === 'archived' ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                                                </button>
                                            )}

                                            {/* Booking Actions */}
                                            {cls.status !== 'archived' && (
                                                <div>
                                                    {member ? (
                                                        <>
                                                            {family.length > 0 ? (
                                                                <button
                                                                    onClick={() => handleBookClick(cls)}
                                                                    disabled={(cls as any).userBookingStatus === 'confirmed'}
                                                                    className={`px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${((cls as any).userBookingStatus === 'confirmed')
                                                                        ? 'bg-zinc-100 text-zinc-500 cursor-default'
                                                                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                                                                        }`}
                                                                >
                                                                    {(cls as any).userBookingStatus === 'confirmed' ? "Booked" :
                                                                        (!cls.zoomEnabled && (cls.inPersonCount || 0) >= (cls.capacity || Infinity)) ? "Join Waitlist" : "Book"
                                                                    }
                                                                </button>
                                                            ) : (
                                                                <div className="flex flex-col gap-2 items-end">
                                                                    {(cls as any).userBookingStatus === 'confirmed' ? (
                                                                        <div className="flex items-center gap-2">
                                                                            {cls.zoomEnabled && cls.userBooking ? (
                                                                                <fetcher.Form method="post">
                                                                                    <input type="hidden" name="intent" value="switch_attendance" />
                                                                                    <input type="hidden" name="classId" value={cls.id} />
                                                                                    <input type="hidden" name="bookingId" value={cls.userBooking.id} />
                                                                                    <input type="hidden" name="attendanceType" value={cls.userBooking.attendanceType === 'zoom' ? 'in_person' : 'zoom'} />
                                                                                    <button
                                                                                        type="submit"
                                                                                        title="Switch Attendance Type"
                                                                                        disabled={fetcher.state !== "idle"}
                                                                                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                                                                                    >
                                                                                        Switch to {cls.userBooking.attendanceType === 'zoom' ? 'In-Person' : 'Zoom'}
                                                                                    </button>
                                                                                </fetcher.Form>
                                                                            ) : null}

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setConfirmCancelData({ bookingId: cls.userBooking!.id, classId: cls.id })}
                                                                                disabled={fetcher.state !== "idle"}
                                                                                className="text-xs text-red-600 hover:underline disabled:opacity-50"
                                                                            >
                                                                                Cancel
                                                                            </button>

                                                                            <span className="px-4 py-2 text-sm font-medium rounded bg-zinc-100 text-zinc-500 cursor-default">
                                                                                Booked {cls.userBooking?.attendanceType === 'zoom' ? '(Virtual)' : '(In-Person)'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <fetcher.Form method="post">
                                                                            <input type="hidden" name="intent" value={((cls.confirmedCount || 0) >= (cls.capacity || Infinity)) ? "waitlist" : "book"} />
                                                                            <input type="hidden" name="classId" value={cls.id} />
                                                                            <button
                                                                                type="submit"
                                                                                onClick={(e) => {
                                                                                    if (cls.zoomEnabled) {
                                                                                        e.preventDefault();
                                                                                        setSelectedClass(cls);
                                                                                    }
                                                                                }}
                                                                                disabled={(fetcher.state !== "idle" && fetcher.formData?.get("classId") === cls.id) || (cls as any).userBookingStatus === 'confirmed' || (cls as any).userBookingStatus === 'waitlisted'}
                                                                                className={`px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${((cls as any).userBookingStatus === 'confirmed' || (cls as any).userBookingStatus === 'waitlisted')
                                                                                    ? 'bg-zinc-100 text-zinc-500 cursor-default'
                                                                                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                                                                                    }`}
                                                                            >
                                                                                {(fetcher.state !== "idle" && fetcher.formData?.get("classId") === cls.id)
                                                                                    ? "Processing..."
                                                                                    : (cls as any).userBookingStatus === 'confirmed'
                                                                                        ? "Booked"
                                                                                        : (cls as any).userBookingStatus === 'waitlisted'
                                                                                            ? "On Waitlist"
                                                                                            : (!cls.zoomEnabled && (cls.inPersonCount || 0) >= (cls.capacity || Infinity)) ? "Join Waitlist" : "Book"
                                                                                }
                                                                            </button>
                                                                        </fetcher.Form>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <a href="/sign-in" className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded hover:bg-zinc-50">
                                                            Login to Book
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

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
        </div >
    );
}
