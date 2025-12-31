// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Form, useNavigation, useFetcher, useActionData } from "react-router"; // Added useFetcher, useActionData
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

type ClassEvent = {
    id: string;
    title: string;
    description: string;
    startTime: string;
    durationMinutes: number;
    instructorId: string;
    price: number;
    userBooked?: boolean;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        // Public Access: Token might be null, apiRequest handles that?
        // apiRequest helper might need update if it enforces auth?
        // Let's check api.ts.
        const classes = await apiRequest("/classes", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { classes };
    } catch (e: any) {
        console.error("Failed to load classes", e);
        return { classes: [], error: e.message };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");
    const classId = formData.get("classId");

    if (intent === "book") {
        try {
            const res = await apiRequest(`/classes/${classId}/book`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! }
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
    const { classes, error } = useLoaderData<{ classes: ClassEvent[], error?: string }>();
    const { member } = useOutletContext<any>() || {}; // Member might be null if guest
    const navigation = useNavigation();
    const fetcher = useFetcher();
    const actionData = useActionData<{ error?: string, success?: boolean, classId?: string }>();

    // Helper to group classes by date
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
                                                {(cls as any).location && (
                                                    <span className="text-zinc-400 dark:text-zinc-500">@ {(cls as any).location.name}</span>
                                                )}
                                                {cls.price > 0 && <span>• ${(cls.price / 100).toFixed(2)}</span>}
                                            </div>
                                        </div>
                                        <div>
                                            {member ? (
                                                <fetcher.Form method="post">
                                                    <input type="hidden" name="intent" value="book" />
                                                    <input type="hidden" name="classId" value={cls.id} />

                                                    {actionData?.error && actionData.classId === cls.id && (
                                                        <div className="text-xs text-red-600 mb-1 absolute -mt-6 right-0 bg-white p-1 border border-red-200 rounded shadow-sm z-10">
                                                            {actionData.error}
                                                        </div>
                                                    )}

                                                    <button
                                                        type="submit"
                                                        disabled={(fetcher.state !== "idle" && fetcher.formData?.get("classId") === cls.id) || (cls as any).userBooked}
                                                        className={`px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${(cls as any).userBooked
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 cursor-default'
                                                            : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                                                            }`}
                                                    >
                                                        {(fetcher.state !== "idle" && fetcher.formData?.get("classId") === cls.id)
                                                            ? "Booking..."
                                                            : ((cls as any).userBooked || (actionData?.success && actionData.classId === cls.id))
                                                                ? "Booked"
                                                                : "Book"
                                                        }
                                                    </button>
                                                </fetcher.Form>
                                            ) : (
                                                <a href="/sign-in" className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
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
