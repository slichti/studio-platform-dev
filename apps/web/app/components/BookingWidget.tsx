import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

export function BookingWidget({ tenantSlug }: { tenantSlug: string }) {
    const [schedule, setSchedule] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [guestForm, setGuestForm] = useState({ name: '', email: '' });
    const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    useEffect(() => {
        fetchSchedule();
    }, [tenantSlug, selectedDate]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const start = startOfWeek(selectedDate).toISOString();
            const res = await fetch(`https://studio-platform-api.slichti.workers.dev/guest/schedule/${tenantSlug}?start=${start}`);
            const data = await res.json() as { classes: any[] };
            setSchedule(data.classes || []);
        } catch (e) {
            console.error("Failed to load schedule", e);
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        setBookingStatus('submitting');
        try {
            const res = await fetch(`https://studio-platform-api.slichti.workers.dev/guest/booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classId: selectedClass.id,
                    tenantId: selectedClass.tenantId,
                    guestDetails: guestForm
                })
            });

            if (res.ok) {
                setBookingStatus('success');
            } else {
                setBookingStatus('error');
            }
        } catch (e) {
            setBookingStatus('error');
        }
    };

    if (bookingStatus === 'success') {
        return (
            <div className="p-8 text-center bg-green-50 rounded-xl">
                <h3 className="text-2xl font-bold text-green-800">Booking Confirmed!</h3>
                <p className="mt-2 text-green-700">Check your email for details.</p>
                <button
                    onClick={() => { setBookingStatus('idle'); setSelectedClass(null); }}
                    className="mt-6 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    Book Another Class
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col md:flex-row h-[600px]">
            {/* Sidebar / Calendar */}
            <div className="w-full md:w-1/3 bg-zinc-50 border-r border-zinc-200 p-6 flex flex-col">
                <h2 className="text-xl font-bold text-zinc-900 mb-6">Select a Date</h2>
                {/* Mini Calendar here (simplified for mvp) */}
                <div className="space-y-2">
                    {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                        const date = addDays(startOfWeek(selectedDate), offset);
                        const isSelected = isSameDay(date, selectedDate);
                        return (
                            <button
                                key={offset}
                                onClick={() => setSelectedDate(date)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex justify-between items-center ${isSelected
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'hover:bg-zinc-200 text-zinc-700'
                                    }`}
                            >
                                <span className="font-medium">{format(date, 'EEEE')}</span>
                                <span className={isSelected ? 'text-blue-200' : 'text-zinc-500'}>
                                    {format(date, 'MMM d')}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content / Class List */}
            <div className="flex-1 p-6 overflow-y-auto bg-white">
                <h2 className="text-xl font-bold text-zinc-900 mb-6 sticky top-0 bg-white py-2 z-10">
                    Classes for {format(selectedDate, 'MMMM do')}
                </h2>

                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-100 rounded-lg" />)}
                    </div>
                ) : schedule.filter(c => isSameDay(new Date(c.startTime), selectedDate)).length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        No classes scheduled for this day.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {schedule
                            .filter(c => isSameDay(new Date(c.startTime), selectedDate))
                            .map(cls => (
                                <div key={cls.id} className="group border border-zinc-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-zinc-900 text-lg">{format(new Date(cls.startTime), 'h:mm a')}</div>
                                            <h3 className="text-zinc-800 font-semibold mt-1">{cls.title}</h3>
                                            <p className="text-sm text-zinc-500 mt-1">{cls.instructor?.user?.name || cls.instructor?.user?.email || 'Instructor'}</p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedClass(cls)}
                                            className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 group-hover:border-blue-500 group-hover:text-blue-600 transition-colors"
                                        >
                                            Book
                                        </button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}
            </div>

            {/* Booking Modal */}
            {selectedClass && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-zinc-900">Complete Booking</h3>
                            <button onClick={() => setSelectedClass(null)} className="text-zinc-400 hover:text-zinc-600">
                                <span className="sr-only">Close</span>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="bg-zinc-50 p-4 rounded-xl mb-6">
                            <p className="font-bold text-zinc-900">{selectedClass.title}</p>
                            <p className="text-sm text-zinc-600 mt-1">
                                {format(new Date(selectedClass.startTime), 'EEEE, MMMM do @ h:mm a')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={guestForm.name}
                                    onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={guestForm.email}
                                    onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="jane@example.com"
                                />
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={handleBook}
                                disabled={!guestForm.name || !guestForm.email || bookingStatus === 'submitting'}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all transform active:scale-[0.98]"
                            >
                                {bookingStatus === 'submitting' ? 'Booking...' : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
