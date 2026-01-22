// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Link, useParams, useFetcher } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { Check, X, FileText, AlertTriangle, MessageSquare, StickyNote, Plus, Trash2, UserPlus, Search } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

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
    hasNotes: boolean;
};

type Note = {
    id: string;
    note: string;
    createdAt: string;
    author: {
        user: {
            profile: {
                firstName: string;
            }
        }
    }
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


// ... (loader/action same)

function PaymentBadge({ method }: { method?: string }) {
    switch (method) {
        case 'subscription':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Membership</span>;
        case 'credit':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Credit</span>;
        case 'drop_in':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pay Later</span>;
        case 'free':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Free</span>;
        default:
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-500">Unknown</span>;
    }
}

export default function StudioClassRoster() {
    const { bookings } = useLoaderData<{ bookings: Booking[] }>();
    const { slug, id } = useParams();
    const fetcher = useFetcher();

    const confirmedBookings = bookings.filter((b: Booking) => b.status === "confirmed");
    const waitlistBookings = bookings.filter((b: Booking) => b.status === "waitlisted");

    // Modal State
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [notesOpen, setNotesOpen] = useState(false);
    const [addStudentOpen, setAddStudentOpen] = useState(false);

    // Confirm States
    const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

    const handleConfirmCancel = () => {
        if (bookingToCancel) {
            fetcher.submit({ intent: "cancel_booking", bookingId: bookingToCancel }, { method: "post" });
            setBookingToCancel(null);
        }
    };

    // Selected Student Metadata
    const selectedBooking = bookings.find((b: Booking) => b.memberId === selectedStudentId);

    return (
        <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link
                        to={`/studio/${slug}/schedule`}
                        className="text-zinc-500 hover:text-zinc-800 font-medium text-sm flex items-center gap-1"
                    >
                        &larr; Back to Schedule
                    </Link>
                    <div className="h-6 w-px bg-zinc-300"></div>
                    <h2 className="text-2xl font-bold">Class Roster</h2>
                </div>
                <button
                    onClick={() => setAddStudentOpen(true)}
                    className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                    <UserPlus size={16} />
                    Add Student
                </button>
            </div>

            {/* Confirmed Bookings Table */}
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm mb-8">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-900">Attending ({confirmedBookings.length})</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">



                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment</th>
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
                                        <button
                                            onClick={() => {
                                                setSelectedStudentId(booking.memberId);
                                                setNotesOpen(true);
                                            }}
                                            className={`ml-2 p-1.5 rounded-full transition-colors ${booking.hasNotes ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'}`}
                                            title={booking.hasNotes ? "View Notes" : "Add Note"}
                                        >
                                            <StickyNote size={14} className={booking.hasNotes ? "fill-current" : ""} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <PaymentBadge method={booking.paymentMethod} />
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
                                    <button
                                        type="button"
                                        onClick={() => setBookingToCancel(booking.id)}
                                        className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center gap-1"
                                    >
                                        <X size={12} />
                                        Cancel
                                    </button>
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
                                            <div>
                                                <div className="font-medium text-zinc-900">
                                                    {booking.user.profile?.fullName || 'Unknown Student'}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedStudentId(booking.memberId);
                                                        setNotesOpen(true);
                                                    }}
                                                    className={`mt-1 text-xs flex items-center gap-1 ${booking.hasNotes ? 'text-amber-600 font-medium' : 'text-zinc-400 hover:text-zinc-600'}`}
                                                >
                                                    <StickyNote size={12} className={booking.hasNotes ? "fill-current" : ""} />
                                                    {booking.hasNotes ? "Has Notes" : "Add Note"}
                                                </button>
                                            </div>
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
                                            <button
                                                type="button"
                                                onClick={() => setBookingToCancel(booking.id)}
                                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                                            >
                                                Remove
                                            </button>
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

            {/* Notes Modal */}
            {notesOpen && selectedStudentId && (
                <NotesModal
                    memberId={selectedStudentId}
                    studentName={selectedBooking?.user.profile?.fullName || selectedBooking?.user.email || 'Student'}
                    onClose={() => setNotesOpen(false)}
                    slug={slug!}
                />
            )}

            <ConfirmDialog
                open={!!bookingToCancel}
                onOpenChange={(open) => !open && setBookingToCancel(null)}
                onConfirm={handleConfirmCancel}
                title="Cancel Booking"
                description="Are you sure you want to cancel this booking? The student will be removed from the roster."
                confirmText="Cancel Booking"
                variant="destructive"
            />
        </div>
    );
}

function AddStudentModal({ classId, slug, onClose }: { classId: string, slug: string, onClose: () => void }) {
    const [query, setQuery] = useState("");
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);

    // Fetch all members on mount (since no backend search yet)
    useEffect(() => {
        const fetchMembers = async () => {
            setLoading(true);
            try {
                const token = await (window as any).Clerk?.session?.getToken();
                const res = await apiRequest('/members', token, {
                    headers: { 'X-Tenant-Slug': slug }
                }) as any;
                setMembers(res.members || []);
            } catch (e) {
                console.error("Failed to load members", e);
            } finally {
                setLoading(false);
            }
        };
        fetchMembers();
    }, [slug]);

    const filteredMembers = members.filter(m => {
        const search = query.toLowerCase();
        const name = m.user?.profile?.fullName?.toLowerCase() || "";
        const email = m.user?.email?.toLowerCase() || "";
        return name.includes(search) || email.includes(search);
    }).slice(0, 5); // Limit to 5 results

    const handleAdd = async (memberId: string) => {
        setAddingId(memberId);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res = await apiRequest(`/classes/${classId}/book`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ memberId })
            }) as any;

            if (res.error) throw new Error(res.error);

            // Success
            onClose();
            // Trigger reload of the page to refresh roster
            window.location.reload();
        } catch (e: any) {
            alert("Failed to add student: " + e.message);
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200">
                    <h3 className="font-semibold text-lg">Add Student to Class</h3>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>

                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        {loading ? (
                            <div className="text-center py-4 text-zinc-400 text-sm">Loading members...</div>
                        ) : filteredMembers.length > 0 ? (
                            filteredMembers.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 border border-zinc-100 rounded-lg hover:bg-zinc-50">
                                    <div className="min-w-0 flex-1 mr-4">
                                        <div className="font-medium text-zinc-900 truncate">
                                            {member.user?.profile?.fullName || 'Unknown'}
                                        </div>
                                        <div className="text-xs text-zinc-500 truncate">{member.user?.email}</div>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(member.id)}
                                        disabled={!!addingId}
                                        className="bg-white border border-zinc-300 text-zinc-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
                                    >
                                        {addingId === member.id ? "Adding..." : "Add"}
                                    </button>
                                </div>
                            ))
                        ) : query ? (
                            <div className="text-center py-4 text-zinc-400 text-sm">No members found matching "{query}"</div>
                        ) : (
                            <div className="text-center py-4 text-zinc-400 text-sm">Start typing to search members</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NotesModal({ memberId, studentName, onClose, slug }: { memberId: string, studentName: string, onClose: () => void, slug: string }) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNote, setNewNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadNotes();
    }, [memberId]);

    const loadNotes = async () => {
        setLoading(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res = await apiRequest(`/members/${memberId}/notes`, token, {
                headers: { 'X-Tenant-Slug': slug }
            }) as { notes: Note[] };
            setNotes(res.notes || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/members/${memberId}/notes`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ note: newNote })
            });
            setNewNote("");
            loadNotes(); // Reload
        } catch (e) {
            alert("Failed to add note");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (noteId: string) => {
        setNoteToDelete(noteId);
    };

    const handleConfirmDelete = async () => {
        if (!noteToDelete) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/members/${memberId}/notes/${noteToDelete}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug }
            });
            setNotes(notes.filter(n => n.id !== noteToDelete));
            setNoteToDelete(null);
        } catch (e) { }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200">
                    <h3 className="font-semibold text-lg">Notes: {studentName}</h3>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="text-center py-4 text-zinc-400">Loading notes...</div>
                    ) : notes.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400 italic bg-zinc-50 rounded-lg">No notes yet.</div>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm relative group">
                                <p className="text-zinc-800 whitespace-pre-wrap">{note.note}</p>
                                <div className="mt-2 text-xs text-zinc-500 flex justify-between items-center">
                                    <span>{new Date(note.createdAt).toLocaleDateString()} by {note.author?.user?.profile?.firstName || 'Staff'}</span>
                                    <button onClick={() => handleDelete(note.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-zinc-200 bg-zinc-50">
                    <form onSubmit={handleAddNote}>
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a medical note, injury, or preference..."
                            className="w-full text-sm border-zinc-300 rounded-md mb-2 focus:ring-blue-500 min-h-[80px]"
                            required
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-zinc-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {submitting ? "Adding..." : "Add Note"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ConfirmDialog
                open={!!noteToDelete}
                onOpenChange={(open) => !open && setNoteToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Note"
                description="Are you sure you want to delete this note?"
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    );
}
