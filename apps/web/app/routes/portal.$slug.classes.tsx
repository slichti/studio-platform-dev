
import { useLoaderData, useOutletContext, Form, useNavigation, useSubmit } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Calendar as CalendarIcon, Clock, MapPin, User, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    // [E2E BYPASS] Allow impersonation/bypass for testing
    let userId: string | null = null;
    let token: string | null = null;
    let getToken: (() => Promise<string | null>) | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) {
            userId = match[1];
            token = userId;
            console.warn(`[SECURITY WARNING] E2E Bypass Active for User: ${userId}`);
        }
    }

    // Only call getAuth if we didn't bypass
    if (!userId) {
        const authResult = await getAuth(args);
        userId = authResult.userId;
        getToken = authResult.getToken;
    }

    if (!token && getToken) token = await getToken();
    const { slug } = args.params;
    const url = new URL(args.request.url);
    const date = url.searchParams.get("date") || new Date().toISOString();

    try {
        // Fetch Classes for the selected date (or week)
        const [classes, myBookings] = await Promise.all([
            apiRequest(`/classes?date=${date}&scope=week`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => []),
            apiRequest(`/bookings/my-upcoming`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => [])
        ]);
        return { classes, myBookings, selectedDate: date };
    } catch (e) {
        console.error("Portal Classes Loader Error:", e);
        return { classes: [], myBookings: [], selectedDate: date };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    try {
        if (intent === "book") {
            const classId = formData.get("classId");
            await apiRequest(`/bookings`, token, {
                method: "POST",
                body: JSON.stringify({ classId }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { success: true };
        }

        if (intent === "cancel") {
            const bookingId = formData.get("bookingId");
            await apiRequest(`/bookings/${bookingId}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { success: true };
        }

        return null;
    } catch (e: any) {
        return { error: e.message || "Action failed" };
    }
};

export default function StudentPortalClasses() {
    const { classes: rawClasses, myBookings, selectedDate } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    // Generate dates for tabs (Today + 6 days)
    const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

    // Filter classes for currently selected viewDate (client-side filter for smoother UX if redundant data loaded)
    const classes = (rawClasses || []).filter((c: any) => isSameDay(new Date(c.startTime), viewDate));

    const isBooking = (id: string) => navigation.formData?.get("classId") === id && navigation.state === "submitting";

    // Helper to find if I booked this class
    const getBooking = (classId: string) => myBookings?.find((b: any) => b.class.id === classId || b.classId === classId); // Adjust based on API structure

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Class Schedule</h1>
            </div>

            {/* Date Tabs */}
            <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
                {dates.map((date) => {
                    const isSelected = isSameDay(date, viewDate);
                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => setViewDate(date)}
                            className={cn(
                                "flex flex-col items-center min-w-[4.5rem] p-3 rounded-xl border transition-all",
                                isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700"
                            )}
                        >
                            <span className="text-xs font-medium opacity-80 uppercase">{format(date, 'EEE')}</span>
                            <span className="text-xl font-bold">{format(date, 'd')}</span>
                        </button>
                    );
                })}
            </div>

            {/* Class List */}
            <div className="space-y-4">
                {classes.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                        <CalendarIcon className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No classes scheduled</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">There are no classes available on this day.</p>
                    </div>
                ) : (
                    classes.map((cls: any) => {
                        const booking = getBooking(cls.id);
                        const isFull = cls.capacity > 0 && (cls.bookedCount || 0) >= cls.capacity;
                        const startTime = new Date(cls.startTime);
                        const endTime = new Date(startTime.getTime() + cls.durationMinutes * 60000);

                        return (
                            <div key={cls.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-5 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors">
                                <div className="flex flex-col items-center justify-center min-w-[5rem] border-r border-zinc-100 dark:border-zinc-800 pr-5">
                                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{format(startTime, 'h:mm a')}</span>
                                    <span className="text-xs text-zinc-500">{cls.durationMinutes} min</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg mb-1">{cls.title}</h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} />
                                            <span>{cls.instructor?.profile?.firstName || "Staff"}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin size={14} />
                                            <span>{cls.location?.name || "Main Studio"}</span>
                                        </div>
                                    </div>
                                    {cls.description && (
                                        <p className="text-sm text-zinc-500 mt-2 line-clamp-2">{cls.description}</p>
                                    )}
                                </div>

                                <div className="flex flex-col justify-center min-w-[8rem]">
                                    {booking ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg justify-center">
                                                <CheckCircle2 size={16} />
                                                Booked
                                            </div>
                                            <Form method="post">
                                                <input type="hidden" name="bookingId" value={booking.id} />
                                                <input type="hidden" name="intent" value="cancel" />
                                                <button className="text-xs text-red-500 hover:text-red-600 hover:underline w-full text-center">
                                                    Cancel Booking
                                                </button>
                                            </Form>
                                        </div>
                                    ) : (
                                        <Form method="post">
                                            <input type="hidden" name="classId" value={cls.id} />
                                            <input type="hidden" name="intent" value="book" />
                                            <button
                                                disabled={isFull || isBooking(cls.id)}
                                                className={cn(
                                                    "w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                                                    isFull
                                                        ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                                        : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg shadow-indigo-200 dark:shadow-none"
                                                )}
                                            >
                                                {isBooking(cls.id) ? "Booking..." : isFull ? "Full" : "Book Class"}
                                            </button>
                                            {isFull && <div className="text-center text-xs text-zinc-400 mt-1">Waitlist Available</div>}
                                        </Form>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
