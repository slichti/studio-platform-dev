
import { useLoaderData, Link, useParams, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { Check, X, FileText, AlertTriangle, StickyNote, UserPlus, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { apiRequest } from "../../utils/api";

type Booking = {
    id: string;
    status: string;
    user: { id: string; email: string; profile: any; };
    createdAt: string;
    memberId: string;
    checkedInAt: string | null;
    paymentMethod?: string;
    waiverSigned: boolean;
    hasNotes: boolean;
};

type Note = {
    id: string;
    note: string;
    createdAt: string;
    author: { user: { profile: { firstName: string; } } }
};

function PaymentBadge({ method }: { method?: string }) {
    switch (method) {
        case 'subscription': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Membership</span>;
        case 'credit': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Credit</span>;
        case 'drop_in': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pay Later</span>;
        case 'free': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Free</span>;
        default: return <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-500">Unknown</span>;
    }
}

export default function ClassRosterPageComponent() {
    const { bookings } = useLoaderData<{ bookings: Booking[] }>();
    const { slug, id } = useParams();
    const fetcher = useFetcher();

    const confirmedBookings = bookings.filter((b: Booking) => b.status === "confirmed");
    const waitlistBookings = bookings.filter((b: Booking) => b.status === "waitlisted");

    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [notesOpen, setNotesOpen] = useState(false);
    const [addStudentOpen, setAddStudentOpen] = useState(false);
    const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

    const handleConfirmCancel = () => {
        if (bookingToCancel) {
            fetcher.submit({ intent: "cancel_booking", bookingId: bookingToCancel }, { method: "post" });
            setBookingToCancel(null);
        }
    };

    const selectedBooking = bookings.find((b: Booking) => b.memberId === selectedStudentId);

    return (
        <div className="relative">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link to={`/studio/${slug}/schedule`} className="text-zinc-500 hover:text-zinc-800 font-medium text-sm flex items-center gap-1">
                        &larr; Back to Schedule
                    </Link>
                    <div className="h-6 w-px bg-zinc-300"></div>
                    <h2 className="text-2xl font-bold">Class Roster</h2>
                </div>
                <button onClick={() => setAddStudentOpen(true)} className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800">
                    <UserPlus size={16} /> Add Student
                </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm mb-8">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 text-zinc-900 font-semibold text-zinc-900">Attending ({confirmedBookings.length})</div>
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Student</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Payment</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Waiver</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Attendance</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {confirmedBookings.map((booking: Booking) => (
                            <tr key={booking.id} className="hover:bg-zinc-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
                                            {booking.user.profile?.firstName?.[0] || booking.user.email[0].toUpperCase()}
                                        </div>
                                        <div className="font-medium text-zinc-900">{booking.user.profile?.fullName || 'Unknown Student'}</div>
                                        <button onClick={() => { setSelectedStudentId(booking.memberId); setNotesOpen(true); }} className={`p-1.5 rounded-full ${booking.hasNotes ? 'bg-amber-100 text-amber-600' : 'text-zinc-400'}`}>
                                            <StickyNote size={14} className={booking.hasNotes ? "fill-current" : ""} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4"><PaymentBadge method={booking.paymentMethod} /></td>
                                <td className="px-6 py-4">
                                    {booking.waiverSigned ? <span className="text-green-600 text-xs font-medium">Signed</span> : <span className="text-amber-600 text-xs font-bold animate-pulse">Needs Signature</span>}
                                </td>
                                <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Confirmed</span></td>
                                <td className="px-6 py-4">
                                    <fetcher.Form method="post">
                                        <input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="intent" value="check_in" />
                                        <button name="checkedIn" value={booking.checkedInAt ? "false" : "true"} className={`px-2.5 py-1 rounded-full text-xs font-medium ${booking.checkedInAt ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-500'}`}>
                                            {booking.checkedInAt ? "Checked In" : "Mark Present"}
                                        </button>
                                    </fetcher.Form>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => setBookingToCancel(booking.id)} className="text-red-600 text-xs font-medium">Cancel</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {waitlistBookings.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-zinc-200 bg-amber-50 flex justify-between items-center text-amber-900 font-semibold text-amber-900">
                        Waitlist ({waitlistBookings.length})
                    </div>
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-zinc-100">
                            {waitlistBookings.map((booking: Booking, index: number) => (
                                <tr key={booking.id} className="hover:bg-zinc-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-zinc-500 text-sm">{index + 1}.</span>
                                            <div className="font-medium text-zinc-900">{booking.user.profile?.fullName || 'Unknown Student'}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <fetcher.Form method="post" className="inline mr-3">
                                            <input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="intent" value="promote" />
                                            <button className="bg-green-600 text-white px-3 py-1 rounded text-xs">Promote</button>
                                        </fetcher.Form>
                                        <button onClick={() => setBookingToCancel(booking.id)} className="text-red-600 text-xs text-red-600">Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {addStudentOpen && <AddStudentModal classId={id!} slug={slug!} onClose={() => setAddStudentOpen(false)} />}
            {notesOpen && selectedStudentId && <NotesModal memberId={selectedStudentId} studentName={selectedBooking?.user.profile?.fullName || selectedBooking?.user.email || 'Student'} onClose={() => setNotesOpen(false)} slug={slug!} />}

            <ConfirmDialog open={!!bookingToCancel} onOpenChange={(open) => !open && setBookingToCancel(null)} onConfirm={handleConfirmCancel} title="Cancel Booking" description="Are you sure you want to cancel this booking?" confirmText="Cancel" variant="destructive" />
        </div>
    );
}

function AddStudentModal({ classId, slug, onClose }: { classId: string, slug: string, onClose: () => void }) {
    const [query, setQuery] = useState("");
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const token = await (window as any).Clerk?.session?.getToken();
                const res = await apiRequest('/members', token, { headers: { 'X-Tenant-Slug': slug } }) as any;
                setMembers(res.members || []);
            } finally { setLoading(false); }
        })();
    }, [slug]);

    const filtered = members.filter(m => (m.user?.profile?.fullName || "").toLowerCase().includes(query.toLowerCase()) || (m.user?.email || "").toLowerCase().includes(query.toLowerCase())).slice(0, 5);

    const handleAdd = async (memberId: string) => {
        setAddingId(memberId);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/classes/${classId}/book`, token, { method: "POST", headers: { 'X-Tenant-Slug': slug }, body: JSON.stringify({ memberId }) });
            onClose(); window.location.reload();
        } catch (e: any) { alert(e.message); }
        finally { setAddingId(null); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
                <div className="flex justify-between items-center mb-4 text-zinc-900">
                    <h3 className="font-bold">Add Student</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-full p-2 border rounded mb-4" />
                <div className="space-y-2">
                    {loading ? "Loading..." : filtered.map(m => (
                        <div key={m.id} className="flex justify-between items-center p-2 border rounded">
                            <div className="text-zinc-900 font-medium">{m.user?.profile?.fullName || m.user?.email}</div>
                            <button onClick={() => handleAdd(m.id)} disabled={!!addingId} className="px-3 py-1 bg-zinc-900 text-white rounded text-xs">{addingId === m.id ? "..." : "Add"}</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function NotesModal({ memberId, studentName, onClose, slug }: { memberId: string, studentName: string, onClose: () => void, slug: string }) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNote, setNewNote] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const token = await (window as any).Clerk?.session?.getToken();
                const res = await apiRequest(`/members/${memberId}/notes`, token, { headers: { 'X-Tenant-Slug': slug } }) as any;
                setNotes(res.notes || []);
            } finally { setLoading(false); }
        })();
    }, [memberId]);

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/members/${memberId}/notes`, token, { method: "POST", headers: { 'X-Tenant-Slug': slug }, body: JSON.stringify({ note: newNote }) });
            setNewNote(""); window.location.reload();
        } catch (e) { alert("Error adding note"); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh] p-4 text-zinc-900">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">Notes: {studentName}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {loading ? "Loading..." : notes.map(n => (
                        <div key={n.id} className="p-3 bg-yellow-50 border rounded-lg text-sm text-zinc-800">
                            {n.note}
                            <div className="mt-1 text-[10px] text-zinc-500">{new Date(n.createdAt).toLocaleDateString()} by staff</div>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea value={newNote} onChange={e => setNewNote(e.target.value)} required className="w-full p-2 border rounded" placeholder="Add note..." />
                    <button type="submit" className="w-full py-2 bg-zinc-900 text-white rounded text-sm">Add Note</button>
                </form>
            </div>
        </div>
    );
}
