// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Link, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

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
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug, id } = args.params;

    try {
        // Fetch Bookings
        const bookings = await apiRequest(`/classes/${id}/bookings`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });

        // Fetch Class Details (for title/context) - Optional but good for UI
        // We can reuse the list endpoint filtering or add a GET /classes/:id endpoint.
        // For now, let's just show bookings.

        return { bookings };
    } catch (e: any) {
        console.error("Failed to load roster", e);
        throw new Response("Failed to load roster", { status: 500 });
    }
};

export default function StudioClassRoster() {
    const { bookings } = useLoaderData<{ bookings: Booking[] }>();
    const { slug } = useParams();

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

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Booked At</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {bookings.map((booking) => (
                            <tr key={booking.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
                                            {booking.user.profile?.firstName?.[0] || booking.user.email[0].toUpperCase()}
                                        </div>
                                        <span className="font-medium text-zinc-900">
                                            {booking.user.profile?.fullName || 'Unknown'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-600 text-sm">{booking.user.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${booking.status === 'confirmed'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-zinc-100 text-zinc-800'
                                        }`}>
                                        {booking.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-400 text-sm">
                                    {new Date(booking.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <button className="text-red-600 hover:text-red-800 text-xs font-medium">
                                        Cancel
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {bookings.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                    No bookings yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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
