
import { useState, useEffect } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router";
import { Search, CheckCircle, XCircle, User, Calendar, RotateCcw, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function KioskMode() {
    const { tenant } = useOutletContext<any>();
    const params = useParams();
    const navigate = useNavigate();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkingIn, setCheckingIn] = useState<string | null>(null);
    const [showWalkIn, setShowWalkIn] = useState<string | null>(null); // memberId for walk-in
    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [successMember, setSuccessMember] = useState<{ name: string; credits?: number | null; className?: string } | null>(null);

    // Check Auth on Mount
    useEffect(() => {
        const token = localStorage.getItem(`kiosk_token_${params.slug}`);
        if (!token) {
            navigate(`/kiosk/${params.slug}/login`);
        }
    }, [params.slug, navigate]);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const token = localStorage.getItem(`kiosk_token_${params.slug}`);
                const API_URL = (window as any).ENV.API_URL;
                const res = await fetch(`${API_URL}/kiosk/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.status === 401) {
                    navigate(`/kiosk/${params.slug}/login`);
                    return;
                }
                const data = await res.json();
                setResults(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, params.slug, navigate]);

    const handleCheckIn = async (bookingId: string, memberName: string) => {
        setCheckingIn(bookingId);
        try {
            const token = localStorage.getItem(`kiosk_token_${params.slug}`);
            const API_URL = (window as any).ENV.API_URL;
            const res = await fetch(`${API_URL}/kiosk/checkin/${bookingId}`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Check-in failed");

            // Show success overlay
            setSuccessMember({ name: memberName });

            setTimeout(() => {
                setSuccessMember(null);
                setQuery("");
                setResults([]);
            }, 3000);

        } catch (e) {
            toast.error("Could not check in. Please see desk.");
        } finally {
            setCheckingIn(null);
        }
    };

    const handleWalkIn = async (memberId: string, memberName: string) => {
        // Fetch today's classes
        try {
            const token = localStorage.getItem(`kiosk_token_${params.slug}`);
            const API_URL = (window as any).ENV.API_URL;
            const res = await fetch(`${API_URL}/kiosk/today-classes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json() as any[];;
                setTodayClasses(data);
                setShowWalkIn(memberId);
            }
        } catch (e) {
            toast.error("Could not load classes.");
        }
    };

    const handleWalkInBook = async (classId: string) => {
        if (!showWalkIn) return;
        const member = results.find(r => r.memberId === showWalkIn);
        const memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'Student';

        try {
            const token = localStorage.getItem(`kiosk_token_${params.slug}`);
            const API_URL = (window as any).ENV.API_URL;
            const res = await fetch(`${API_URL}/kiosk/walk-in`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ memberId: showWalkIn, classId })
            });

            if (!res.ok) {
                const err = await res.json() as { error?: string };
                throw new Error(err.error || 'Walk-in failed');
            }

            const data = await res.json() as any;
            setShowWalkIn(null);
            setSuccessMember({
                name: memberName,
                credits: data.creditsRemaining,
                className: data.className
            });

            setTimeout(() => {
                setSuccessMember(null);
                setQuery("");
                setResults([]);
            }, 4000);

        } catch (e: unknown) {
            toast.error((e as Error).message || "Walk-in failed. Please see desk.");
        }
    };

    // Success Overlay
    if (successMember) {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-green-500 to-emerald-600 flex flex-col items-center justify-center text-white animate-in zoom-in duration-300">
                <div className="relative mb-8">
                    <Sparkles className="h-24 w-24 animate-pulse" />
                    <div className="absolute -top-2 -right-2 animate-bounce">
                        <CheckCircle className="h-12 w-12 text-green-200" />
                    </div>
                </div>
                <h1 className="text-5xl font-bold mb-4">Welcome, {successMember.name}!</h1>
                {successMember.className && (
                    <p className="text-2xl text-green-100 mb-2">Booked into: {successMember.className}</p>
                )}
                {successMember.credits !== null && successMember.credits !== undefined && (
                    <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-4 flex items-center gap-3">
                        <CreditCard className="h-6 w-6" />
                        <span className="text-xl font-semibold">{successMember.credits} credits remaining</span>
                    </div>
                )}
                <p className="mt-8 text-green-200 text-lg">You're all checked in. Enjoy your class!</p>
            </div>
        );
    }

    // Walk-in Class Selection
    if (showWalkIn) {
        const member = results.find(r => r.memberId === showWalkIn);
        return (
            <div className="h-full flex flex-col items-center pt-16 px-6 max-w-2xl mx-auto">
                <button
                    onClick={() => setShowWalkIn(null)}
                    className="self-start mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                    <RotateCcw className="h-5 w-5" /> Back to search
                </button>
                <h2 className="text-3xl font-bold mb-2">Select a Class</h2>
                <p className="text-zinc-500 mb-8 text-lg">
                    Walk-in for {member?.firstName} {member?.lastName}
                </p>

                <div className="w-full space-y-3">
                    {todayClasses.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">No upcoming classes today.</p>
                        </div>
                    ) : todayClasses.map(cls => (
                        <button
                            key={cls.id}
                            onClick={() => handleWalkInBook(cls.id)}
                            disabled={cls.spotsRemaining <= 0}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex items-center justify-between hover:border-purple-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <div className="text-left">
                                <div className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{cls.title}</div>
                                <div className="text-zinc-500 text-sm mt-1">
                                    {format(new Date(cls.startTime), 'h:mm a')}
                                    {cls.endTime && ` – ${format(new Date(cls.endTime), 'h:mm a')}`}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-sm font-medium ${cls.spotsRemaining > 5 ? 'text-green-600' : cls.spotsRemaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                    {cls.spotsRemaining > 0 ? `${cls.spotsRemaining} spots` : 'Full'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center pt-20 px-6 max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-2">Welcome to {tenant.name}</h1>
            <p className="text-zinc-500 mb-10 text-lg">Search for your name to check in.</p>

            {/* Search Bar */}
            <div className="relative w-full mb-12">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400" />
                <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type your name..."
                    className="w-full h-20 pl-20 pr-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm text-2xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(""); setResults([]); }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full"
                    >
                        <XCircle className="h-6 w-6 text-zinc-400" />
                    </button>
                )}
            </div>

            {/* Results */}
            <div className="w-full space-y-4">
                {results.map((member) => (
                    <div
                        key={member.memberId}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden">
                                {member.portraitUrl ? (
                                    <img src={member.portraitUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="h-6 w-6 text-zinc-400" />
                                )}
                            </div>
                            <div>
                                <div className="font-bold text-lg">{member.firstName} {member.lastName}</div>
                                {member.nextBooking ? (
                                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                                        <Calendar className="h-4 w-4" />
                                        {member.nextBooking.className}
                                        <span className="text-zinc-400 font-normal">
                                            • {format(new Date(member.nextBooking.startTime), 'h:mm a')}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-zinc-400 text-sm">No bookings today</div>
                                )}
                                {member.availableCredits > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-purple-600 mt-0.5">
                                        <CreditCard className="h-3 w-3" />
                                        {member.availableCredits} credits available
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {member.nextBooking ? (
                                member.nextBooking.checkedInAt ? (
                                    <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5" />
                                        Checked In
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleCheckIn(member.nextBooking.id, member.firstName)}
                                        disabled={!!checkingIn}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-sm active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {checkingIn === member.nextBooking.id ? '...' : 'Check In'}
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={() => handleWalkIn(member.memberId, `${member.firstName || ''} ${member.lastName || ''}`)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-bold text-base shadow-sm active:scale-95 transition-all"
                                >
                                    Walk-In
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {results.length === 0 && query.length > 2 && !loading && (
                <div className="text-zinc-400 mt-10 flex flex-col items-center">
                    <Search className="h-12 w-12 mb-4 opacity-50" />
                    <p>No students found matching "{query}"</p>
                </div>
            )}
        </div>
    );
}
