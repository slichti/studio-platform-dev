
import { useState, useEffect } from "react";
import { useLoaderData, useOutletContext, useParams, Link } from "react-router";
import { apiRequest } from "../../utils/api";
import {
    CheckCircle2, Circle, Users, Calendar, ArrowLeft,
    Search, Loader2, UserPlus, AlertCircle
} from "lucide-react";
import { loader } from "../../routes/studio.$slug.checkin";

export default function CheckInPageComponent() {
    const { classes: initialClasses, token } = useLoaderData<typeof loader>();
    const { slug } = useParams();
    const { roles, isStudentView } = useOutletContext<any>();

    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [roster, setRoster] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isKioskMode, setIsKioskMode] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => { if (selectedClass) loadRoster(selectedClass.id); }, [selectedClass]);

    const loadRoster = async (classId: string) => {
        setLoading(true);
        try {
            const res: any = await apiRequest(`/classes/${classId}/bookings`, token, { headers: { 'X-Tenant-Slug': slug! } });
            setRoster(res || []);
        } catch (e) { console.error("Failed to load roster"); }
        finally { setLoading(false); }
    };

    const toggleCheckIn = async (booking: any) => {
        const isCheckingIn = !booking.checkedInAt;
        setRoster(prev => prev.map(b => b.id === booking.id ? { ...b, checkedInAt: isCheckingIn ? new Date() : null } : b));
        try {
            await apiRequest(`/classes/${selectedClass.id}/bookings/${booking.id}/check-in`, token, {
                method: "PATCH", headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ checkedIn: isCheckingIn })
            });
        } catch (e) {
            setRoster(prev => prev.map(b => b.id === booking.id ? { ...b, checkedInAt: !isCheckingIn ? new Date() : null } : b));
        }
    };

    useEffect(() => {
        if (isKioskMode && feedback?.type === 'success') {
            const timer = setTimeout(() => { setFeedback(null); setSearchQuery(""); }, 3000);
            return () => clearTimeout(timer);
        }
    }, [feedback, isKioskMode]);

    const handleKioskCheckIn = async (booking: any) => {
        if (booking.checkedInAt) { setFeedback({ message: `Already checked in!`, type: 'error' }); return; }
        await toggleCheckIn(booking);
        setFeedback({ message: `Welcome, ${booking.user.profile?.firstName}!`, type: 'success' });
    };

    if (isStudentView || (!roles.includes('instructor') && !roles.includes('owner'))) {
        const [history, setHistory] = useState<any[]>([]);
        const [loadingHistory, setLoadingHistory] = useState(true);

        useEffect(() => {
            const fetchHistory = async () => {
                setLoadingHistory(true);
                try {
                    const res: any = await apiRequest('/members/me/bookings', token, { headers: { 'X-Tenant-Slug': slug! } });
                    setHistory(res.bookings || []);
                } catch (e) { console.error("Failed into fetch history", e); }
                finally { setLoadingHistory(false); }
            };
            fetchHistory();
        }, [token, slug]);

        const completed = history.filter(b => b.status === 'confirmed' && b.checkedInAt).length;
        const upcoming = history.filter(b => b.status === 'confirmed' && new Date(b.class.startTime) > new Date()).length;

        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-500" size={32} /> Attendance History
                    </h1>
                    <p className="text-zinc-500 mt-2">Track your class attendance and upcoming sessions.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 shadow-sm">
                        <div className="text-sm font-bold text-zinc-500 uppercase mb-1">Classes Attended</div>
                        <div className="text-4xl font-black text-emerald-600">{completed}</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 shadow-sm">
                        <div className="text-sm font-bold text-zinc-500 uppercase mb-1">Upcoming Classes</div>
                        <div className="text-4xl font-black text-blue-600">{upcoming}</div>
                    </div>
                </div>

                <h2 className="text-xl font-bold mb-4">Your Classes</h2>
                {loadingHistory ? (
                    <div className="p-12 text-center text-zinc-400"><Loader2 className="animate-spin mx-auto h-8 w-8 mb-2" />Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200">
                        <Calendar className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="font-bold mb-1">No classes yet</h3>
                        <Link to={`/studio/${slug}/classes`} className="inline-block px-6 py-2 bg-zinc-900 text-white font-bold rounded-lg mt-4">Book a Class</Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((booking) => {
                            const isPast = new Date(booking.class.startTime) < new Date();
                            const isCancelled = booking.status === 'cancelled';
                            return (
                                <div key={booking.id} className={`bg-white dark:bg-zinc-900 p-6 rounded-2xl border ${isCancelled ? 'border-red-200 bg-red-50/50' : 'border-zinc-200'} shadow-sm flex flex-col md:flex-row md:items-center gap-6`}>
                                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                                        <span className="text-xs font-bold text-zinc-500 uppercase">{new Date(booking.class.startTime).toLocaleDateString([], { month: 'short' })}</span>
                                        <span className="text-2xl font-black">{new Date(booking.class.startTime).getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold mb-1">{booking.class.title}</h3>
                                        <div className="text-sm text-zinc-500 flex gap-4">
                                            <span className="flex items-center gap-1.5"><Calendar size={14} />{new Date(booking.class.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        {isCancelled ? <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-bold">Cancelled</span> : booking.checkedInAt ? <span className="flex items-center gap-2 text-emerald-600 font-bold"><CheckCircle2 size={18} />Checked In</span> : isPast ? <span className="text-zinc-400">Completed</span> : <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">Upcoming</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (selectedClass) {
        const filteredRoster = roster.filter(b => b.user.email.toLowerCase().includes(searchQuery.toLowerCase()) || JSON.stringify(b.user.profile).toLowerCase().includes(searchQuery.toLowerCase()));
        return (
            <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
                    <button onClick={() => setSelectedClass(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"><ArrowLeft size={20} /></button>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold truncate">{selectedClass.title}</h2>
                        <p className="text-xs text-zinc-500">{new Date(selectedClass.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button onClick={() => setIsKioskMode(!isKioskMode)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${isKioskMode ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200'}`}>
                        {isKioskMode ? 'Exit Kiosk' : 'Kiosk Mode'}
                    </button>
                </div>

                {isKioskMode ? (
                    <div className="flex-1 flex flex-col items-center justify-start pt-24 px-8 bg-zinc-50 dark:bg-zinc-950">
                        <div className="max-w-2xl w-full">
                            <h1 className="text-4xl font-extrabold text-center mb-8">Welcome!</h1>
                            {feedback ? (
                                <div className={`p-12 rounded-3xl text-center ${feedback.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                    <CheckCircle2 size={64} className="mx-auto mb-4" />
                                    <h2 className="text-3xl font-bold">{feedback.message}</h2>
                                    <p className="mt-2 opacity-80 uppercase tracking-widest font-medium text-sm">Enjoy your class!</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="relative">
                                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400" />
                                        <input type="text" placeholder="Enter your name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-20 pr-8 py-8 bg-white dark:bg-zinc-900 border-2 border-zinc-200 rounded-3xl text-3xl font-bold outline-none shadow-xl" autoFocus />
                                    </div>
                                    {searchQuery.length > 1 && (
                                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 overflow-hidden">
                                            {filteredRoster.map(booking => (
                                                <button key={booking.id} onClick={() => handleKioskCheckIn(booking)} className="w-full flex items-center justify-between p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 last:border-0 transition-colors">
                                                    <span className="text-xl font-bold">{booking.user.profile?.firstName} {booking.user.profile?.lastName}</span>
                                                    {booking.checkedInAt ? <span className="text-emerald-500 font-bold flex items-center gap-2"><CheckCircle2 /> Checked In</span> : <span className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm">Check In</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input type="text" placeholder="Find student..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-sm outline-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto pb-24">
                            {loading && roster.length === 0 ? <Loader2 className="animate-spin mx-auto h-8 w-8 mt-12" /> : (
                                <div className="divide-y divide-zinc-50 dark:divide-zinc-900">
                                    {filteredRoster.map((booking) => (
                                        <button key={booking.id} onClick={() => toggleCheckIn(booking)} className="w-full flex items-center gap-4 p-4 active:bg-zinc-50 dark:active:bg-zinc-900 transition-colors text-left group">
                                            <div className="flex-shrink-0">{booking.checkedInAt ? <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><CheckCircle2 size={24} /></div> : <div className="p-2 bg-zinc-100 text-zinc-400 rounded-full group-hover:text-blue-500"><Circle size={24} /></div>}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold truncate">{booking.user.profile?.firstName} {booking.user.profile?.lastName}</div>
                                                <div className="text-xs text-zinc-500 flex gap-2 mt-0.5"><span>{booking.status}</span> • <span>{booking.user.email}</span></div>
                                            </div>
                                            <div className="flex-shrink-0">{booking.checkedInAt ? <span className="text-[10px] text-zinc-400 font-medium">Checked in</span> : <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded uppercase">CHECK IN</span>}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex gap-4 sticky bottom-0 shadow-2xl">
                            <button className="flex-1 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><UserPlus size={20} />Quick Add Student</button>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-12">
            <div className="p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold flex items-center gap-2"><CheckCircle2 className="text-blue-600" /> Instructor Check-in</h1>
                    <p className="text-sm text-zinc-500 mt-1">Select today's session to start checking in students.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {initialClasses.length > 0 ? initialClasses.map((cls: any) => (
                        <button key={cls.id} onClick={() => setSelectedClass(cls)} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 hover:border-blue-500 transition-all text-left shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600"><Calendar size={20} /></div>
                                <span className="text-[10px] font-bold uppercase text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">{new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold line-clamp-2 leading-tight mb-1">{cls.title}</h3>
                                <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1"><Users size={12} />{cls.confirmedCount || 0} students booked</p>
                            </div>
                            <div className="pt-4 border-t border-zinc-100 flex items-center gap-2 text-blue-600 text-xs font-bold uppercase">Start Check-in <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /></div>
                        </button>
                    )) : (
                        <div className="col-span-full py-24 text-center bg-white rounded-3xl border border-dashed border-zinc-200">
                            <AlertCircle className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
                            <h3 className="text-zinc-500 font-bold mb-1">No Classes Today</h3>
                            <p className="text-xs text-zinc-400">Enjoy your day off!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
