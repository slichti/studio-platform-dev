// @ts-ignore
import { useState, useEffect } from "react";
// @ts-ignore
import { useLoaderData, useOutletContext, useParams, Link } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import {
    CheckCircle2,
    Circle,
    Users,
    Calendar,
    ArrowLeft,
    Search,
    Loader2,
    UserPlus,
    CreditCard,
    AlertCircle
} from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    // Fetch classes for "Today"
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    try {
        const classes: any = await apiRequest(`/classes?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return { classes, token };
    } catch (e) {
        console.error("Check-in loader failed", e);
        return { classes: [], token };
    }
}

export default function StaffCheckInPage() {
    const { classes: initialClasses, token } = useLoaderData<typeof loader>();
    const { slug } = useParams();
    const { roles } = useOutletContext<any>();

    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [roster, setRoster] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Load roster when a class is selected
    useEffect(() => {
        if (selectedClass) {
            loadRoster(selectedClass.id);
        }
    }, [selectedClass]);

    const loadRoster = async (classId: string) => {
        setLoading(true);
        try {
            const res: any = await apiRequest(`/classes/${classId}/bookings`, token, {
                headers: { 'X-Tenant-Slug': slug! }
            });
            setRoster(res || []);
        } catch (e) {
            alert("Failed to load roster");
        } finally {
            setLoading(false);
        }
    };

    const toggleCheckIn = async (booking: any) => {
        const isCheckingIn = !booking.checkedInAt;
        // Optimistic UI
        setRoster(prev => prev.map(b =>
            b.id === booking.id ? { ...b, checkedInAt: isCheckingIn ? new Date() : null } : b
        ));

        try {
            await apiRequest(`/classes/${selectedClass.id}/bookings/${booking.id}/check-in`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ checkedIn: isCheckingIn })
            });
        } catch (e) {
            alert("Check-in failed. Please try again.");
            // Revert
            setRoster(prev => prev.map(b =>
                b.id === booking.id ? { ...b, checkedInAt: !isCheckingIn ? new Date() : null } : b
            ));
        }
    };

    if (!roles.includes('instructor') && !roles.includes('owner')) {
        return <div className="p-8 text-center">Access Denied: Instructor portal only.</div>;
    }

    // View Roster View
    if (selectedClass) {
        const filteredRoster = roster.filter(b =>
            b.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            JSON.stringify(b.user.profile).toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
                    <button onClick={() => setSelectedClass(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold truncate text-zinc-900 dark:text-zinc-100">{selectedClass.title}</h2>
                        <p className="text-xs text-zinc-500">{new Date(selectedClass.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {selectedClass.location?.name || 'Studio Main'}</p>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-950 sticky top-[73px] z-10 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Find student..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-24">
                    {loading && roster.length === 0 ? (
                        <div className="p-12 text-center text-zinc-400">
                            <Loader2 className="animate-spin mx-auto h-8 w-8 mb-2" />
                            <p className="text-sm">Loading Roster...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50 dark:divide-zinc-900">
                            {filteredRoster.map((booking) => (
                                <button
                                    key={booking.id}
                                    onClick={() => toggleCheckIn(booking)}
                                    className="w-full flex items-center gap-4 p-4 active:bg-zinc-50 dark:active:bg-zinc-900 transition-colors text-left group"
                                >
                                    <div className="flex-shrink-0">
                                        {booking.checkedInAt ? (
                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-full">
                                                <CheckCircle2 size={24} />
                                            </div>
                                        ) : (
                                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-full group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                <Circle size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                            {booking.user.profile?.firstName || 'Student'} {booking.user.profile?.lastName || ''}
                                        </div>
                                        <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                                            {booking.status === 'confirmed' ? (
                                                <span className="text-emerald-500 font-bold uppercase tracking-tighter text-[9px]">Reserved</span>
                                            ) : (
                                                <span className="text-amber-500 font-bold uppercase tracking-tighter text-[9px]">{booking.status}</span>
                                            )}
                                            <span>•</span>
                                            <span>{booking.user.email}</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {booking.checkedInAt ? (
                                            <span className="text-[10px] text-zinc-400 font-medium">Checked in {new Date(booking.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        ) : (
                                            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">CHECK IN</span>
                                        )}
                                    </div>
                                </button>
                            ))}

                            {filteredRoster.length === 0 && (
                                <div className="p-12 text-center text-zinc-400">
                                    <Users className="mx-auto h-12 w-12 mb-4 opacity-20" />
                                    <p className="text-sm">No students booked yet.</p>
                                    <p className="text-xs mt-1">Bookings for this class will appear here.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex gap-4 sticky bottom-0 shadow-2xl">
                    <button className="flex-1 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                        <UserPlus size={20} />
                        Quick Add Student
                    </button>
                </div>
            </div>
        );
    }

    // Class Selection View
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-12">
            <div className="p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <CheckCircle2 className="text-blue-600" /> Instructor Check-in
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Select today's session to start checking in students.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {initialClasses.length > 0 ? (
                        initialClasses.map((cls: any) => (
                            <button
                                key={cls.id}
                                onClick={() => setSelectedClass(cls)}
                                className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left group shadow-sm flex flex-col gap-4"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
                                        <Calendar size={20} />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                        {new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight mb-1">{cls.title}</h3>
                                    <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                                        <Users size={12} />
                                        {cls.confirmedCount || 0} students booked
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                                    Start Check-in
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="col-span-full py-24 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                            <AlertCircle className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
                            <h3 className="text-zinc-500 font-bold mb-1">No Classes Today</h3>
                            <p className="text-xs text-zinc-400">Enjoy your day off! Classes will appear here automatically.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
