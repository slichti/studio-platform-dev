import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { format, isSameDay } from "date-fns";
import { ExternalLink, Calendar as CalendarIcon, Video, X } from "lucide-react";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const { slug } = params;
    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";

    try {
        const res = await fetch(`${API_URL}/guest/schedule/${slug}`);
        if (!res.ok) throw new Error("Failed to load classes");
        const data = await res.json() as { classes: any[] };
        return { classes: data.classes || [] };
    } catch (e) {
        return { classes: [], error: "Could not load schedule." };
    }
};

export default function EmbedCalendar() {
    const { classes, error } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>() as any;
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [guestForm, setGuestForm] = useState({ name: '', email: '' });

    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";

    const grouped = (classes || []).reduce((acc: any, cls: any) => {
        const date = new Date(cls.startTime);
        const key = format(date, "EEEE, MMMM d");
        if (!acc[key]) acc[key] = [];
        acc[key].push(cls);
        return acc;
    }, {});

    const handleBook = async () => {
        setBookingStatus('submitting');
        try {
            const res = await fetch(`${API_URL}/guest/booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classId: selectedClass.id,
                    tenantId: tenant.id,
                    guestDetails: guestForm
                })
            });

            if (res.ok) {
                setBookingStatus('success');
                // Optional: window.parent.postMessage({ type: 'studio-booked', slug: tenant.slug }, '*');
            } else {
                setBookingStatus('error');
            }
        } catch (e) {
            setBookingStatus('error');
        }
    };

    if (error) {
        return <div className="p-4 text-red-500 text-sm text-center">{error}</div>;
    }

    if (classes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-zinc-500 bg-white border rounded">
                <CalendarIcon className="mb-2 opacity-50" />
                <p className="text-sm">No classes scheduled.</p>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-[400px]">
            {(Object.entries(grouped) as [string, any[]][]).map(([date, events]) => (
                <div key={date} className="mb-6 last:mb-0">
                    <h3 className="sticky top-0 z-10 bg-white/95 backdrop-blur py-2 px-4 border-b border-zinc-100 font-bold text-zinc-900 text-lg shadow-sm">
                        {date}
                    </h3>
                    <div className="divide-y divide-zinc-100">
                        {events.map((cls) => (
                            <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-zinc-900 truncate">{cls.title}</span>
                                        {cls.zoomEnabled && <Video size={14} className="text-blue-500" />}
                                    </div>
                                    <div className="text-sm text-zinc-500 flex flex-wrap gap-x-3 items-center">
                                        <span className="font-medium text-zinc-700">
                                            {format(new Date(cls.startTime), "h:mm a")}
                                        </span>
                                        <span className="text-zinc-300">•</span>
                                        <span>{cls.durationMinutes} min</span>
                                        {cls.instructor?.user?.profile?.firstName && (
                                            <>
                                                <span className="text-zinc-300">•</span>
                                                <span>{cls.instructor.user.profile.firstName}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedClass(cls)}
                                    className="shrink-0 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                                >
                                    Book
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Booking Modal */}
            {selectedClass && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        {bookingStatus === 'success' ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                                <h3 className="text-xl font-bold text-zinc-900">Booking Confirmed!</h3>
                                <p className="text-zinc-600 mt-2 mb-6">We've sent a confirmation to {guestForm.email}</p>
                                <button
                                    onClick={() => { setSelectedClass(null); setBookingStatus('idle'); }}
                                    className="w-full py-3 bg-zinc-900 text-white font-bold rounded-xl"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-zinc-900">Book Class</h3>
                                    <button onClick={() => setSelectedClass(null)} className="text-zinc-400 hover:text-zinc-600">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="bg-zinc-50 p-4 rounded-xl mb-6">
                                    <p className="font-bold text-zinc-900">{selectedClass.title}</p>
                                    <p className="text-sm text-zinc-600 mt-1">
                                        {format(new Date(selectedClass.startTime), "EEEE, MMMM do @ h:mm a")}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={guestForm.name}
                                            onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-500 outline-none"
                                            placeholder="Jane Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={guestForm.email}
                                            onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-500 outline-none"
                                            placeholder="jane@example.com"
                                        />
                                    </div>
                                </div>

                                {bookingStatus === 'error' && (
                                    <p className="text-red-500 text-sm mt-4">Failed to book class. Please try again.</p>
                                )}

                                <button
                                    onClick={handleBook}
                                    disabled={!guestForm.name || !guestForm.email || bookingStatus === 'submitting'}
                                    className="w-full mt-8 py-3 bg-zinc-900 text-white font-bold rounded-xl disabled:opacity-50"
                                >
                                    {bookingStatus === 'submitting' ? 'Booking...' : 'Confirm Booking'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
