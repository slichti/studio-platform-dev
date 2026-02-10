
import { useState, useEffect } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router";
import { Search, CheckCircle, XCircle, User, Calendar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function KioskMode() {
    const { tenant } = useOutletContext<any>();
    const params = useParams();
    const navigate = useNavigate();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkingIn, setCheckingIn] = useState<string | null>(null); // bookingId

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

            // Success Animation/Toast
            toast.success(`Welcome, ${memberName}!`);

            // Clear Search after 2 seconds to reset for next person
            setTimeout(() => {
                setQuery("");
                setResults([]);
            }, 2000);

        } catch (e) {
            toast.error("Could not check in. Please see desk.");
        } finally {
            setCheckingIn(null);
        }
    };

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
                            </div>
                        </div>

                        <div>
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
                                <span className="text-zinc-400 text-sm font-medium">See Front Desk</span>
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
