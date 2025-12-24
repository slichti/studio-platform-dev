// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useOutletContext, Form, useNavigation } from "react-router";
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
    userBooked?: boolean; // We might calculate this on frontend or return from API? API doesn't return yet.
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

export default function StudioPublicClasses() {
    const { classes, error } = useLoaderData<{ classes: ClassEvent[], error?: string }>();
    const { member } = useOutletContext<any>() || {}; // Member might be null if guest
    const navigation = useNavigation();

    // Helper to group classes by date
    const grouped = classes.reduce((acc, cls) => {
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
                    <div className="text-sm text-zinc-500">
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
                    <div className="p-8 text-center text-zinc-500 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
                        No upcoming classes scheduled.
                    </div>
                ) : (
                    Object.entries(grouped).map(([date, events]) => (
                        <div key={date}>
                            <h3 className="text-lg font-bold text-zinc-900 mb-3 sticky top-0 bg-zinc-50/95 py-2 backdrop-blur">{date}</h3>
                            <div className="space-y-3">
                                {events.map(cls => (
                                    <div key={cls.id} className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm hover:border-zinc-300 transition-colors flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-zinc-900">{cls.title}</div>
                                            <div className="text-sm text-zinc-500">
                                                {new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {cls.durationMinutes} min
                                                {cls.price > 0 && ` • $${(cls.price / 100).toFixed(2)}`}
                                            </div>
                                        </div>
                                        <div>
                                            {member ? (
                                                <button
                                                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded hover:bg-zinc-800 disabled:opacity-50"
                                                    onClick={() => {/* Implement booking action */ }}
                                                >
                                                    Book
                                                </button>
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
