import { useState } from "react";
import { Modal } from "./Modal";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";
import { useParams } from "react-router";
import { toast } from "sonner";

interface CreateBulkClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (count: number) => void;
    tenantId?: string;
    locations?: any[];
    instructors?: any[];
    plans?: any[];
    courses?: any[];
}

export function CreateBulkClassModal({ isOpen, onClose, onSuccess, locations = [], instructors = [], plans = [], courses = [] }: CreateBulkClassModalProps) {
    const { getToken } = useAuth();
    const { slug } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        instructorIds: [] as string[],
        locationId: "",
        durationMinutes: 60,
        capacity: 20,
        price: 0,
        createZoom: false,
        minEnrollment: 1,
        autoCancelThreshold: 2,
        autoCancelEnabled: false,
        type: 'class',
        memberPrice: "",
        allowCredits: true,
        payrollModel: 'default', // default, flat, percentage, hourly
        payrollValue: "",

        includedPlanIds: [] as string[],

        // Bulk Scheduling Specific
        startDate: "",
        endDate: "",
        startTime: "09:00",
        daysOfWeek: [] as number[],

        // Course Management
        isCourse: false,
        courseId: "",
        recordingPrice: "",
        contentCollectionId: ""
    });

    // Class types that allow multiple instructors; regular class and private appointment are single-instructor only.
    const allowMultipleInstructors = ['event', 'workshop', 'course'].includes(formData.type);

    const handleTypeChange = (newType: string) => {
        const allowMulti = ['event', 'workshop', 'course'].includes(newType);
        setFormData(prev => ({
            ...prev,
            type: newType,
            instructorIds: allowMulti ? prev.instructorIds : prev.instructorIds.slice(0, 1),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (!formData.startDate || !formData.endDate) {
            setError("Start Date and End Date are required.");
            setLoading(false);
            return;
        }

        if (formData.daysOfWeek.length === 0) {
            setError("At least one day of the week must be selected.");
            setLoading(false);
            return;
        }

        if (!formData.startTime) {
            setError("Start Time is required.");
            setLoading(false);
            return;
        }

        try {
            const token = await getToken();

            const res: any = await apiRequest("/classes/bulk-create", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    title: formData.name,
                    description: formData.description,
                    instructorIds: formData.instructorIds.length > 0 ? formData.instructorIds : undefined,
                    locationId: formData.locationId || undefined,
                    durationMinutes: Number(formData.durationMinutes),
                    capacity: Number(formData.capacity),
                    price: Number(formData.price),
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    startTime: formData.startTime,
                    daysOfWeek: formData.daysOfWeek,
                    zoomEnabled: (formData as any).createZoom,
                    createZoomMeeting: (formData as any).createZoom,
                    minStudents: Number(formData.minEnrollment),
                    autoCancelThreshold: Number(formData.autoCancelThreshold),
                    autoCancelEnabled: formData.autoCancelEnabled,
                    type: formData.type,
                    memberPrice: formData.memberPrice ? Number(formData.memberPrice) : null,
                    allowCredits: formData.allowCredits,
                    includedPlanIds: formData.includedPlanIds,
                    payrollModel: formData.payrollModel === 'default' ? null : formData.payrollModel,
                    payrollValue: formData.payrollModel !== 'default' && formData.payrollValue ? Number(formData.payrollValue) : null,
                    isCourse: formData.isCourse,
                    courseId: formData.courseId || undefined,
                    recordingPrice: (formData.isCourse || formData.courseId) && formData.recordingPrice ? Number(formData.recordingPrice) : null,
                    contentCollectionId: (formData.isCourse || formData.courseId) && formData.contentCollectionId ? formData.contentCollectionId : null,
                })
            });

            if (res.error) {
                const errMsg = typeof res.error === 'string'
                    ? res.error
                    : (res.error.message || res.error.error || (typeof res.error === 'object' ? JSON.stringify(res.error) : String(res.error)));
                setError(errMsg);
            } else {
                toast.success(`Successfully scheduled ${res.created} classes!`);
                onSuccess(res.created);
                onClose();
                setFormData({
                    name: "",
                    description: "",
                    instructorIds: [],
                    locationId: "",
                    durationMinutes: 60,
                    capacity: 20,
                    price: 0,
                    createZoom: false,
                    minEnrollment: 1,
                    autoCancelThreshold: 2,
                    autoCancelEnabled: false,
                    type: 'class',
                    memberPrice: "",
                    allowCredits: true,
                    payrollModel: 'default',
                    payrollValue: "",
                    includedPlanIds: [],
                    startDate: "",
                    endDate: "",
                    startTime: "09:00",
                    daysOfWeek: [],
                    isCourse: false,
                    courseId: "",
                    recordingPrice: "",
                    contentCollectionId: ""
                });
            }
        } catch (e: any) {
            const errMsg = e.data?.error || e.message || "Failed to create bulk classes";
            setError(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Schedule Classes">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 border-b border-blue-200 pb-2">Schedule Range & Days</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-blue-800 mb-1">Start Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-blue-800 mb-1">End Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                min={formData.startDate}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-blue-800 mb-2">Days of the Week</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: 'Mon', value: 1 },
                                    { label: 'Tue', value: 2 },
                                    { label: 'Wed', value: 3 },
                                    { label: 'Thu', value: 4 },
                                    { label: 'Fri', value: 5 },
                                    { label: 'Sat', value: 6 },
                                    { label: 'Sun', value: 0 }
                                ].map((day) => (
                                    <label key={day.value} className={`
                                        flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium cursor-pointer transition-colors border
                                        ${formData.daysOfWeek.includes(day.value)
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-blue-800 border-blue-200 hover:border-blue-300'
                                        }
                                    `}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={formData.daysOfWeek.includes(day.value)}
                                            onChange={(e) => {
                                                const newDays = e.target.checked
                                                    ? [...formData.daysOfWeek, day.value]
                                                    : formData.daysOfWeek.filter(d => d !== day.value);
                                                setFormData({ ...formData, daysOfWeek: newDays });
                                            }}
                                        />
                                        {day.label[0]}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-blue-800 mb-1">Time of Day</label>
                            <input
                                type="time"
                                required
                                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            />
                            <p className="text-[10px] text-blue-600 mt-1">All classes will start at this time.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="classNameBulk" className="block text-sm font-medium text-zinc-700 mb-1">Class Name</label>
                        <input
                            id="classNameBulk"
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Morning Vinyasa"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">{allowMultipleInstructors ? "Instructors" : "Instructor"}</label>
                        {allowMultipleInstructors ? (
                            <div className="max-h-32 overflow-y-auto border border-zinc-300 rounded-md bg-white p-2 space-y-1">
                                {instructors.length === 0 ? (
                                    <span className="text-sm text-zinc-500 italic">No instructors available</span>
                                ) : (
                                    instructors.map((inst: any) => (
                                        <label key={inst.id} className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer hover:bg-zinc-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={formData.instructorIds.includes(inst.id)}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...formData.instructorIds, inst.id]
                                                        : formData.instructorIds.filter(id => id !== inst.id);
                                                    setFormData({ ...formData, instructorIds: newIds });
                                                }}
                                                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>{inst.user?.profile?.firstName} {inst.user?.profile?.lastName}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        ) : (
                            <select
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={formData.instructorIds[0] ?? ""}
                                onChange={(e) => setFormData({ ...formData, instructorIds: e.target.value ? [e.target.value] : [] })}
                            >
                                <option value="">No instructor</option>
                                {instructors.map((inst: any) => (
                                    <option key={inst.id} value={inst.id}>
                                        {inst.user?.profile?.firstName} {inst.user?.profile?.lastName}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Class Type</label>
                    <select
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={formData.type}
                        onChange={(e) => handleTypeChange(e.target.value)}
                    >
                        <option value="class">Regular Class</option>
                        <option value="workshop">Workshop</option>
                        <option value="event">Event</option>
                        <option value="appointment">Appointment (Private)</option>
                        <option value="course">Course Session</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
                    <select
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={formData.locationId}
                        onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    >
                        <option value="">Select Location (Optional)</option>
                        {locations.map((loc: any) => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={(formData as any).createZoom}
                            onChange={(e) => setFormData({ ...formData, createZoom: e.target.checked } as any)}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Enable Zoom (Virtual Access)</span>
                    </label>
                </div>

                <div className={formData.type === 'course' ? "w-1/2" : "grid grid-cols-3 gap-4"}>
                    <div>
                        <label htmlFor="durationBulk" className="block text-sm font-medium text-zinc-700 mb-1">Duration (min)</label>
                        <input
                            id="durationBulk"
                            type="number"
                            required
                            min="15"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.durationMinutes}
                            onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label htmlFor="capacityBulk" className="block text-sm font-medium text-zinc-700 mb-1">Capacity</label>
                        <input
                            id="capacityBulk"
                            type="number"
                            required
                            min="1"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                        />
                    </div>
                    {formData.type !== 'course' && (
                        <div>
                            <label htmlFor="priceBulk" className="block text-sm font-medium text-zinc-700 mb-1">Price ($)</label>
                            <input
                                id="priceBulk"
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                            />
                        </div>
                    )}
                </div>

                {/* Submit buttons */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "Scheduling..." : "Generate Classes"}
                    </button>
                </div>
            </form >
        </Modal >
    );
}
