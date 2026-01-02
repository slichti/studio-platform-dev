// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Form, useNavigation, useFetcher, useActionData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";

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
};

type FamilyMember = {
    userId: string;
    memberId: string | null;
    firstName: string;
    lastName: string;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const [classes, familyRes] = await Promise.all([
            apiRequest("/classes", token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }),
            apiRequest("/users/me/family", token, {
                headers: { 'X-Tenant-Slug': params.slug! }
            }).catch(() => ({ family: [] })) as Promise<{ family: FamilyMember[] }>
        ]);

        return { classes, family: familyRes.family || [] };
    } catch (e: any) {
        console.error("Failed to load classes", e);
        return { classes: [], family: [], error: e.message };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");
    const classId = formData.get("classId");
    const memberId = formData.get("memberId"); // Optional child ID

    if (intent === "book" || intent === "waitlist") {
        try {
            const body = { intent, memberId: memberId || undefined };
            const res = await apiRequest(`/classes/${classId}/book`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify(body)
            }) as any;

            if (res.error) {
                return { error: res.error, classId };
            }
            return { success: true, classId };
        } catch (e: any) {
            return { error: e.message || "Booking failed", classId };
        }
    }
    return null;
};

export default function StudioPublicClasses() {
    const { classes, family, error } = useLoaderData<{ classes: ClassEvent[], family: FamilyMember[], error?: string }>();
    const { member } = useOutletContext<any>() || {};
    const fetcher = useFetcher();
    const actionData = useActionData<{ error?: string, success?: boolean, classId?: string }>();

    // Booking Modal State
    const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);

    // Helpers
    const handleBookClick = (cls: ClassEvent) => {
        if (family.length > 0) {
            setSelectedClass(cls);
        } else {
            // Direct submit if no family options
            // We can't easily trigger the fetcher from here without a form ref or similar, 
            // but the button itself is usually type=submit inside a form.
            // If family exists, we intercept.
            // Actually, simplest is two different buttons/UI paths.
        }
    };

    const grouped = classes.reduce((acc: Record<string, ClassEvent[]>, cls: ClassEvent) => {
        const date = new Date(cls.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(cls);
        return acc;
    }, {} as Record<string, ClassEvent[]>);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Class Schedule</h2>
                {!member && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        Sign in to book classes.
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
                    Failed to load schedule: {error}
                </div>
            )}

            {/* Booking Modal for Family */}
            {selectedClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-sm w-full p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-bold mb-4">Book {selectedClass.title}</h3>
                        <p className="text-sm text-zinc-500 mb-4">Who would you like to book for?</p>

                        <div className="space-y-2">
                            {/* Self */}
                            <fetcher.Form method="post" onSubmit={() => setSelectedClass(null)}>
                                <input type="hidden" name="classId" value={selectedClass.id} />
                                <input type="hidden" name="intent" value={((selectedClass.confirmedCount || 0) >= (selectedClass.capacity || Infinity)) ? "waitlist" : "book"} />
                                <button type="submit" className="w-full text-left px-4 py-3 rounded border hover:bg-zinc-50 flex justify-between items-center group">
                                    <span className="font-medium">Myself</span>
                                    <span className="text-zinc-400 group-hover:text-zinc-900">&rarr;</span>
                                </button>
                            </fetcher.Form>

                            {/* Family Members */}
                            {family.map((f: FamilyMember) => (
                                <fetcher.Form key={f.userId} method="post" onSubmit={() => setSelectedClass(null)}>
                                    <input type="hidden" name="classId" value={selectedClass.id} />
                                    <input type="hidden" name="intent" value={((selectedClass.confirmedCount || 0) >= (selectedClass.capacity || Infinity)) ? "waitlist" : "book"} />
                                    <input type="hidden" name="memberId" value={f.memberId || ''} />
                                    {/* Note: If memberId is null (not joined tenant), backend might fail or auto-join logic needed. Backend handles auto-join if standard user, but might need logic for child. Currently backend checks tenantMembers table. Our /me/family endpoint auto-joins them on creation, so f.memberId should be present. */}

                                    <button type="submit" className="w-full text-left px-4 py-3 rounded border hover:bg-zinc-50 flex justify-between items-center group">
                                        <span className="font-medium">{f.firstName} {f.lastName}</span>
                                        <span className="text-zinc-400 group-hover:text-zinc-900">&rarr;</span>
                                    </button>
                                </fetcher.Form>
                            ))}
                        </div>

                        <button
                            onClick={() => setSelectedClass(null)}
                            className="mt-4 w-full py-2 text-zinc-500 hover:text-zinc-800 text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

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
                                    <div key={cls.id} className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-zinc-900 dark:text-zinc-100">{cls.title}</div>
                                            <div className="text-sm text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-3">
                                                <span>{new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {cls.durationMinutes} min</span>
                                                {(cls as any).instructor?.user?.profile && (
                                                    <span>with {(cls as any).instructor.user.profile.firstName}</span>
                                                )}
                                                {cls.capacity && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${((cls.confirmedCount || 0) >= cls.capacity) ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                                        {(cls.confirmedCount || 0)} / {cls.capacity} filled
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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
                                                                ((cls.confirmedCount || 0) >= (cls.capacity || Infinity) ? "Join Waitlist" : "Book")
                                                            }
                                                        </button>
                                                    ) : (
                                                        <fetcher.Form method="post">
                                                            <input type="hidden" name="intent" value={((cls.confirmedCount || 0) >= (cls.capacity || Infinity)) ? "waitlist" : "book"} />
                                                            <input type="hidden" name="classId" value={cls.id} />
                                                            <button
                                                                type="submit"
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
                                                                            : ((cls.confirmedCount || 0) >= (cls.capacity || Infinity) ? "Join Waitlist" : "Book")
                                                                }
                                                            </button>
                                                        </fetcher.Form>
                                                    )}
                                                </>
                                            ) : (
                                                <a href="/sign-in" className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded hover:bg-zinc-50">
                                                    Login to Book
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
