// @ts-ignore
import { useLoaderData, useFetcher, useNavigate } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { ArrowLeft, Calendar, Check, Clock, User } from "lucide-react";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    const slug = args.params.slug;

    // Allow public view? No, usually need to be logged in to book.
    // But we can show services publicly.
    const token = userId ? await getToken() : undefined;

    // Fetch Services
    let services = [];
    try {
        // If public, might fail if API requires auth. 
        // My implementation of GET /services requires tenant context but not strictly auth user?
        // Let's assume tenant context comes from header/subdomain.
        // I need to ensure apiRequest works without token if public.
        // Actually my previous implementation of apiRequest might assume token.
        // But let's try.
        if (token) {
            const res: any = await apiRequest("/appointments/services", token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            services = res.services || [];
        }
    } catch (e) {
        console.error("Failed to load services", e);
    }

    return { services, slug, userId, token };
};


export default function AppointmentsPage() {
    const { services, slug, userId, token } = useLoaderData<any>();
    const [step, setStep] = useState<"service" | "slot" | "confirm">("service");
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [slots, setSlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // For date selection
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const navigate = useNavigate();

    async function loadSlots(service: any, date: string) {
        setLoadingSlots(true);
        try {
            const res: any = await apiRequest(`/appointments/availability?serviceId=${service.id}&date=${date}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            setSlots(res.slots || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSlots(false);
        }
    }

    async function handleBook() {
        if (!selectedSlot || !selectedService) return;

        if (!userId) {
            alert("Please login to book");
            return;
        }

        try {
            const res = await apiRequest("/appointments/book", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    serviceId: selectedService.id,
                    instructorId: selectedSlot.instructorId,
                    startTime: selectedSlot.startTime
                })
            });

            if ((res as any).error) {
                alert((res as any).error);
            } else {
                alert("Booking Confirmed!");
                setStep("service");
                setSelectedService(null);
                setSelectedSlot(null);
            }
        } catch (e: any) {
            alert("Booking failed: " + e.message);
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="flex items-center gap-4 mb-8">
                {step !== 'service' && (
                    <button onClick={() => setStep("service")} className="p-2 hover:bg-zinc-100 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                )}
                <h1 className="text-2xl font-bold">Book a Session</h1>
            </div>

            {/* Step 1: Select Service */}
            {step === 'service' && (
                <div className="grid gap-4">
                    {services.length === 0 && <p className="text-zinc-500">No services available.</p>}

                    {services.map((s: any) => (
                        <div key={s.id}
                            onClick={() => {
                                setSelectedService(s);
                                setStep("slot");
                                loadSlots(s, selectedDate);
                            }}
                            className="bg-white p-6 rounded-lg border border-zinc-200 hover:border-blue-500 cursor-pointer shadow-sm transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-lg">{s.title}</h3>
                                    <p className="text-zinc-500 text-sm mt-1">{s.description}</p>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-zinc-600">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {s.durationMinutes} min
                                        </div>
                                        <div className="flex items-center gap-1 font-medium">
                                            ${s.price < 1 ? 'Free' : s.price}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-zinc-100 p-2 rounded-full">
                                    <ArrowLeft className="h-5 w-5 rotate-180 text-zinc-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Step 2: Select Slot */}
            {step === 'slot' && selectedService && (
                <div>
                    <div className="bg-zinc-50 p-4 rounded-lg mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="font-medium">{selectedService.title}</h3>
                            <p className="text-sm text-zinc-500">{selectedService.durationMinutes} mins • ${selectedService.price}</p>
                        </div>
                        <button onClick={() => setStep("service")} className="text-sm text-blue-600 hover:underline">Change</button>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">Select Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                                setSelectedDate(e.target.value);
                                loadSlots(selectedService, e.target.value);
                            }}
                            className="border border-zinc-300 rounded px-3 py-2 w-full md:w-auto"
                        />
                    </div>

                    {loadingSlots ? (
                        <div className="text-center py-8 text-zinc-500">Finding available times...</div>
                    ) : (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            {slots.length === 0 ? (
                                <div className="col-span-full text-center py-8 text-zinc-500 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                                    No availability on this date.
                                </div>
                            ) : (
                                slots.map((slot, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setSelectedSlot(slot);
                                            setStep("confirm");
                                        }}
                                        className="py-2 px-4 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-sm transition-colors"
                                    >
                                        {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && selectedSlot && selectedService && (
                <div>
                    <h2 className="text-xl font-bold mb-6">Confirm Booking</h2>

                    <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6 shadow-sm">
                        <div className="flex gap-4 mb-4 pb-4 border-b border-zinc-100">
                            <div className="bg-blue-100 p-3 rounded-lg h-fit">
                                <Calendar className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{selectedService.title}</h3>
                                <p className="text-zinc-500">with (Instructor ID: {selectedSlot.instructorId.substring(0, 8)}...)</p>
                            </div>
                        </div>

                        <div className="grid gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Date</span>
                                <span className="font-medium">{new Date(selectedSlot.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Time</span>
                                <span className="font-medium">
                                    {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSlot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Price</span>
                                <span className="font-medium">${selectedService.price}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep("slot")}
                            className="flex-1 py-3 border border-zinc-300 rounded-lg font-medium hover:bg-zinc-50"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleBook}
                            className="flex-1 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800"
                        >
                            Confirm Booking
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
