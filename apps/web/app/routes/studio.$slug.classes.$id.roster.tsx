// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Link, useParams, useFetcher } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { Check, X, FileText, AlertTriangle } from "lucide-react";

type Booking = {
    id: string;
    status: string;
    user: {
        id: string;
        email: string;
        profile: any;
    };
    createdAt: string;
    memberId: string;
    checkedInAt: string | null;
    paymentMethod?: string;
    waiverSigned: boolean;
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");
    const bookingId = formData.get("bookingId");
    const classId = params.id;

    if (intent === "check_in") {
        const checkedIn = formData.get("checkedIn") === "true";
        await apiRequest(`/classes/${classId}/bookings/${bookingId}/check-in`, token, {
            method: "PATCH",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ checkedIn })
        });
        return { success: true };
    }

    if (intent === "cancel_booking") {
        await apiRequest(`/classes/${classId}/bookings/${bookingId}/cancel`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { success: true };
    }

    if (intent === "promote") {
        await apiRequest(`/classes/${classId}/bookings/${bookingId}/promote`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { success: true };
    }

    return null;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug, id } = args.params;

    try {
        const bookings = await apiRequest(`/classes/${id}/bookings`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });

        return { bookings };
    } catch (e: any) {
        console.error("Failed to load roster", e);
        throw new Response("Failed to load roster", { status: 500 });
    }
};

export default function StudioClassRoster() {
    const { bookings } = useLoaderData<{ bookings: Booking[] }>();
    const { slug } = useParams();
    const fetcher = useFetcher();

    const confirmedBookings = bookings.filter((b: Booking) => b.status === "confirmed");
    const waitlistBookings = bookings.filter((b: Booking) => b.status === "waitlisted");

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <Link
                    to={`/studio/${slug}/schedule`}
                    className="text-zinc-500 hover:text-zinc-800 font-medium text-sm flex items-center gap-1"
                >
                    &larr; Back to Schedule
                </Link>
                <div className="h-6 w-px bg-zinc-300"></div>
                <h2 className="text-2xl font-bold">Class Roster</h2>
            </div>

            {/* Confirmed Bookings */}
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm mb-8">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-900">Attending ({confirmedBookings.length})</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Waiver</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Attendance</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {confirmedBookings.map((booking: Booking) => (
                            <tr key={booking.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
                                            {booking.user.profile?.firstName?.[0] || booking.user.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-zinc-900">
                                                {booking.user.profile?.fullName || 'Unknown Student'}
                                            </div>
                                            <div className="text-xs text-zinc-500">{booking.user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {booking.waiverSigned ? (
                                        <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                            <FileText size={14} />
                                            Signed
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-amber-600 text-xs font-bold animate-pulse">
                                            <AlertTriangle size={14} />
                                            Needs Signature
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Confirmed
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <fetcher.Form method="post">
                                        <input type="hidden" name="bookingId" value={booking.id} />
                                        <input type="hidden" name="intent" value="check_in" />
                                        {booking.checkedInAt ? (
                                            <button
                                                name="checkedIn"
                                                value="false"
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200"
                                            >
                                                <Check size={12} />
                                                Checked In
                                            </button>
                                        ) : (
                                            <button
                                                name="checkedIn"
                                                value="true"
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                            >
                                                Mark Present
                                            </button>
                                        )}
                                    </fetcher.Form>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <fetcher.Form
                                        method="post"
                                        onSubmit={(e: React.FormEvent) => {
                                            if (!confirm("Are you sure you want to cancel this booking?")) e.preventDefault();
                                        }}
                                    >
                                        <input type="hidden" name="intent" value="cancel_booking" />
                                        <input type="hidden" name="bookingId" value={booking.id} />
                                        <button className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center gap-1">
                                            <X size={12} />
                                            Cancel
                                        </button>
                                    </fetcher.Form>
                                </td>
                            </tr>
                        ))}
                        {confirmedBookings.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                    No attending students.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Waitlist */}
            {waitlistBookings.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-zinc-200 bg-amber-50 flex justify-between items-center">
                        <h3 className="font-semibold text-amber-900">Waitlist ({waitlistBookings.length})</h3>
                        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Sorted by join order</span>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined At</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {waitlistBookings.map((booking: Booking, index: number) => (
                                <tr key={booking.id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
                                                {index + 1}
                                            </div>
                                            <span className="font-medium text-zinc-900">
                                                {booking.user.profile?.fullName || 'Unknown Student'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-400 text-sm">
                                        {new Date(booking.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <fetcher.Form method="post">
                                                <input type="hidden" name="bookingId" value={booking.id} />
                                                <input type="hidden" name="intent" value="promote" />
                                                <button
                                                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                                                >
                                                    Promote
                                                </button>
                                            </fetcher.Form>
                                            <fetcher.Form
                                                method="post"
                                                onSubmit={(e: React.FormEvent) => {
                                                    if (!confirm("Remove from waitlist?")) e.preventDefault();
                                                }}
                                            >
                                                <input type="hidden" name="intent" value="cancel_booking" />
                                                <input type="hidden" name="bookingId" value={booking.id} />
                                                <button className="text-red-600 hover:text-red-800 text-xs font-medium">
                                                    Remove
                                                </button>
                                            </fetcher.Form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 flex justify-end">
                <button
                    className="px-4 py-2 border border-zinc-300 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    onClick={() => window.print()}
                >
                    Print Roster
                </button>
            </div>
        </div>
    );
}
