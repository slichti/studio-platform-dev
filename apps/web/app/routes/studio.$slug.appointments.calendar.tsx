
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { useLoaderData, useSubmit, Form, redirect, useSearchParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState, useMemo } from "react";
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight, X, Check, Video, MapPin, DollarSign } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const url = new URL(args.request.url);
    const weekStart = url.searchParams.get("week") || new Date().toISOString().split("T")[0];

    const token = await getToken();

    try {
        const [appointmentsData, servicesData, instructorsData] = await Promise.all([
            apiRequest(`/appointments?weekStart=${weekStart}`, token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/appointment-services', token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/members?role=instructor', token, { headers: { 'X-Tenant-Slug': slug } })
        ]) as any[];

        return {
            appointments: appointmentsData || [],
            services: servicesData || [],
            instructors: instructorsData || [],
            weekStart
        };
    } catch (e) {
        console.error("Appointments Loader Error", e);
        return { appointments: [], services: [], instructors: [], weekStart };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'create') {
        await apiRequest('/appointments', token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({
                serviceId: formData.get("serviceId"),
                instructorId: formData.get("instructorId"),
                memberId: formData.get("memberId"),
                startTime: formData.get("startTime"),
                notes: formData.get("notes")
            })
        });
    }

    if (intent === 'update-status') {
        const id = formData.get("id");
        await apiRequest(`/appointments/${id}`, token, {
            method: 'PATCH',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ status: formData.get("status") })
        });
    }

    if (intent === 'cancel') {
        const id = formData.get("id");
        await apiRequest(`/appointments/${id}`, token, {
            method: 'PATCH',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ status: 'cancelled' })
        });
    }

    return { success: true };
};

export default function AppointmentsCalendar() {
    const { appointments, services, instructors, weekStart } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const submit = useSubmit();

    const [selectedSlot, setSelectedSlot] = useState<{ date: string, hour: number } | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Generate week dates
    const weekDates = useMemo(() => {
        const start = new Date(weekStart);
        const dayOfWeek = start.getDay();
        const monday = new Date(start);
        monday.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return date.toISOString().split("T")[0];
        });
    }, [weekStart]);

    const navigateWeek = (direction: number) => {
        const current = new Date(weekDates[0]);
        current.setDate(current.getDate() + (direction * 7));
        setSearchParams({ week: current.toISOString().split("T")[0] });
    };

    const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM

    const getAppointmentsForSlot = (date: string, hour: number) => {
        return appointments.filter((apt: any) => {
            const aptDate = new Date(apt.startTime);
            return aptDate.toISOString().split("T")[0] === date && aptDate.getHours() === hour;
        });
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        confirmed: 'bg-blue-100 border-blue-300 text-blue-800',
        completed: 'bg-green-100 border-green-300 text-green-800',
        cancelled: 'bg-zinc-100 border-zinc-300 text-zinc-500'
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-lg text-white"><Calendar size={20} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Appointments</h1>
                            <p className="text-sm text-zinc-500">Private sessions calendar</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 flex items-center gap-2"
                    >
                        <Plus size={16} /> New Appointment
                    </button>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center justify-between mt-4">
                    <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronLeft size={20} /></button>
                    <span className="font-medium text-zinc-900">
                        {new Date(weekDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(weekDates[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronRight size={20} /></button>
                </div>
            </header>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto">
                <div className="min-w-[800px]">
                    {/* Day Headers */}
                    <div className="grid grid-cols-8 border-b border-zinc-200 bg-white sticky top-0 z-10">
                        <div className="p-3 text-xs font-medium text-zinc-500">Time</div>
                        {weekDates.map((date) => {
                            const d = new Date(date);
                            const isToday = date === new Date().toISOString().split("T")[0];
                            return (
                                <div key={date} className={`p-3 text-center border-l border-zinc-200 ${isToday ? 'bg-zinc-900 text-white' : ''}`}>
                                    <div className="text-xs font-medium">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                    <div className={`text-lg font-bold ${isToday ? '' : 'text-zinc-900'}`}>{d.getDate()}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time Slots */}
                    {hours.map((hour) => (
                        <div key={hour} className="grid grid-cols-8 border-b border-zinc-100">
                            <div className="p-2 text-xs text-zinc-500 text-right pr-4">
                                {hour % 12 || 12}:00 {hour < 12 ? 'AM' : 'PM'}
                            </div>
                            {weekDates.map((date) => {
                                const slotAppointments = getAppointmentsForSlot(date, hour);
                                return (
                                    <div
                                        key={`${date}-${hour}`}
                                        className="border-l border-zinc-100 min-h-[60px] p-1 hover:bg-zinc-50 cursor-pointer transition"
                                        onClick={() => setSelectedSlot({ date, hour })}
                                    >
                                        {slotAppointments.map((apt: any) => (
                                            <div
                                                key={apt.id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                                                className={`p-1.5 rounded text-xs mb-1 border cursor-pointer ${statusColors[apt.status] || statusColors.pending}`}
                                            >
                                                <div className="font-medium truncate">{apt.service?.title || 'Session'}</div>
                                                <div className="truncate opacity-75">{apt.member?.user?.profile?.firstName || 'Client'}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Appointment Modal */}
            {(isCreating || selectedSlot) && (
                <CreateAppointmentModal
                    services={services}
                    instructors={instructors}
                    defaultSlot={selectedSlot}
                    onClose={() => { setIsCreating(false); setSelectedSlot(null); }}
                    onSave={(data: any) => {
                        const formData = new FormData();
                        formData.append("intent", "create");
                        Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
                        submit(formData, { method: "post" });
                        setIsCreating(false);
                        setSelectedSlot(null);
                    }}
                />
            )}

            {/* View Appointment Modal */}
            {selectedAppointment && (
                <AppointmentDetailModal
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdateStatus={(id: any, status: any) => {
                        submit({ intent: 'update-status', id, status }, { method: 'post' });
                        setSelectedAppointment(null);
                    }}
                />
            )}
        </div>
    );
}

function CreateAppointmentModal({ services, instructors, defaultSlot, onClose, onSave }: any) {
    const [serviceId, setServiceId] = useState("");
    const [instructorId, setInstructorId] = useState("");
    const [memberId, setMemberId] = useState("");
    const [date, setDate] = useState(defaultSlot?.date || new Date().toISOString().split("T")[0]);
    const [time, setTime] = useState(defaultSlot ? `${String(defaultSlot.hour).padStart(2, '0')}:00` : "09:00");
    const [notes, setNotes] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const startTime = new Date(`${date}T${time}`).toISOString();
        onSave({ serviceId, instructorId, memberId, startTime, notes });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">New Appointment</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Service *</label>
                        <select required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg">
                            <option value="">Select service...</option>
                            {services.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.title} ({s.durationMinutes} min)</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Instructor *</label>
                        <select required value={instructorId} onChange={(e) => setInstructorId(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg">
                            <option value="">Select instructor...</option>
                            {instructors.map((i: any) => (
                                <option key={i.id} value={i.id}>{i.user?.profile?.firstName} {i.user?.profile?.lastName}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Time</label>
                            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-zinc-200 rounded-lg resize-none" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800">Create</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AppointmentDetailModal({ appointment, onClose, onUpdateStatus }: any) {
    const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">{appointment.service?.title || 'Appointment'}</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3 text-sm"><Clock size={16} className="text-zinc-400" />{formatTime(appointment.startTime)}</div>
                    <div className="flex items-center gap-3 text-sm"><User size={16} className="text-zinc-400" />{appointment.member?.user?.profile?.firstName} {appointment.member?.user?.profile?.lastName}</div>
                    {appointment.notes && <p className="text-sm text-zinc-600 bg-zinc-50 p-3 rounded-lg">{appointment.notes}</p>}

                    <div className="pt-4 border-t space-y-2">
                        <p className="text-xs font-medium text-zinc-500 uppercase">Update Status</p>
                        <div className="flex gap-2">
                            <button onClick={() => onUpdateStatus(appointment.id, 'confirmed')} className="flex-1 py-2 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Confirm</button>
                            <button onClick={() => onUpdateStatus(appointment.id, 'completed')} className="flex-1 py-2 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Complete</button>
                            <button onClick={() => onUpdateStatus(appointment.id, 'cancelled')} className="flex-1 py-2 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
