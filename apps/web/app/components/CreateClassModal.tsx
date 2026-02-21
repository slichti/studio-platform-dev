import { useState } from "react";
import { Modal } from "./Modal";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";

import { useParams } from "react-router";

interface CreateClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newClass: any) => void;
    tenantId?: string;
    locations?: any[];
    instructors?: any[];
    plans?: any[];
    courses?: any[];
}

export function CreateClassModal({ isOpen, onClose, onSuccess, locations = [], instructors = [], plans = [], courses = [] }: CreateClassModalProps) {
    const { getToken } = useAuth();
    const { slug } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        instructorId: "",
        locationId: "",
        startTime: "",
        durationMinutes: 60,
        capacity: 20,
        price: 0,
        isRecurring: false,
        recurrencePattern: "weekly", // daily, weekly
        recurrenceEndDate: "",
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
        recurringDays: [] as string[],

        // Course Management
        isCourse: false,
        courseId: "", // Link to standalone course
        recordingPrice: "",
        contentCollectionId: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const token = await getToken();

            let recurrenceRule = undefined;
            if (formData.isRecurring) {
                // const { RRule } = await import("rrule"); // Not strictly needed if we build string manually
                recurrenceRule = formData.recurrencePattern === "weekly" ? "FREQ=WEEKLY" : "FREQ=DAILY";

                if (formData.recurrencePattern === "weekly" && formData.recurringDays.length > 0) {
                    recurrenceRule += `;BYDAY=${formData.recurringDays.join(',')}`;
                }
            }

            const res: any = await apiRequest("/classes", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    title: formData.name,
                    description: formData.description,
                    instructorId: formData.instructorId || undefined,
                    locationId: formData.locationId || undefined,
                    startTime: new Date(formData.startTime).toISOString(),
                    durationMinutes: Number(formData.durationMinutes),
                    capacity: Number(formData.capacity),
                    price: Number(formData.price),
                    createZoomMeeting: (formData as any).createZoom,
                    isRecurring: formData.isRecurring,
                    recurrenceRule: recurrenceRule,
                    recurrenceEnd: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : undefined,
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
                    contentCollectionId: (formData.isCourse || formData.courseId) && formData.contentCollectionId ? formData.contentCollectionId : null
                })
            });

            if (res.error) {
                const errMsg = typeof res.error === 'string'
                    ? res.error
                    : (res.error.message || res.error.error || (typeof res.error === 'object' ? JSON.stringify(res.error) : String(res.error)));
                setError(errMsg);
            } else {
                onSuccess(res.class || res);
                onClose();
                setFormData({
                    name: "",
                    description: "",
                    instructorId: "",
                    locationId: "",
                    startTime: "",
                    durationMinutes: 60,
                    capacity: 20,
                    price: 0,
                    isRecurring: false,
                    recurrencePattern: "weekly",
                    recurrenceEndDate: "",
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
                    recurringDays: [],
                    isCourse: false,
                    courseId: "",
                    recordingPrice: "",
                    contentCollectionId: ""
                });
            }
        } catch (e: any) {
            const errMsg = e.data?.error || e.message || "Failed to create class";
            setError(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Schedule Class">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="className" className="block text-sm font-medium text-zinc-700 mb-1">Class Name</label>
                        <input
                            id="className"
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Morning Vinyasa"
                        />
                    </div>
                    <div>
                        <label htmlFor="instructor" className="block text-sm font-medium text-zinc-700 mb-1">Instructor</label>
                        <select
                            id="instructor"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={formData.instructorId}
                            onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
                        >
                            <option value="">TBA (No Instructor)</option>
                            {instructors.map((inst: any) => (
                                <option key={inst.id} value={inst.id}>
                                    {inst.user?.profile?.firstName} {inst.user?.profile?.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Class Type</label>
                    <select
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                        <option value="class">Regular Class</option>
                        <option value="workshop">Workshop</option>
                        <option value="event">Event</option>
                        <option value="appointment">Appointment (Private)</option>
                        <option value="course">Course Session</option>
                    </select>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-blue-900">Course & Monetization</h3>
                            <p className="text-xs text-blue-700">Mark as a premium course with standalone pricing.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.isCourse}
                                onChange={(e) => setFormData({ ...formData, isCourse: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none ring-0 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {formData.isCourse && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                            <div>
                                <label className="block text-xs font-medium text-blue-800 mb-1">Recording Price ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                    value={formData.recordingPrice}
                                    onChange={(e) => setFormData({ ...formData, recordingPrice: e.target.value })}
                                    placeholder="Standalone VOD price"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-800 mb-1">Content Collection</label>
                                <select
                                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                    value={formData.contentCollectionId}
                                    onChange={(e) => setFormData({ ...formData, contentCollectionId: e.target.value })}
                                >
                                    <option value="">No Collection</option>
                                    {/* Future: Map collections here */}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-blue-100 flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-blue-800">Or Link to Standalone Course</label>
                        <select
                            className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            value={formData.courseId}
                            onChange={(e) => setFormData({ ...formData, courseId: e.target.value, isCourse: e.target.value ? false : formData.isCourse })}
                        >
                            <option value="">Not part of a standalone course</option>
                            {courses.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-blue-600">Linking will automatically associate this session with the course curriculum.</p>
                    </div>
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
                    {(formData as any).createZoom && (
                        <p className="text-xs text-zinc-500 ml-6 mt-1">A Zoom meeting will be created automatically.</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startTime" className="block text-sm font-medium text-zinc-700 mb-1">Start Time</label>
                        <input
                            id="startTime"
                            type="datetime-local"
                            required
                            step="300"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.startTime}
                            onChange={(e) => {
                                let val = e.target.value;
                                if (val) {
                                    const d = new Date(val);
                                    const minutes = d.getMinutes();
                                    const snapped = Math.round(minutes / 5) * 5;
                                    d.setMinutes(snapped);

                                    const year = d.getFullYear();
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const hours = String(d.getHours()).padStart(2, '0');
                                    const mins = String(d.getMinutes()).padStart(2, '0');
                                    val = `${year}-${month}-${day}T${hours}:${mins}`;
                                }
                                setFormData({ ...formData, startTime: val });
                            }}
                        />
                    </div>
                    <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-zinc-700 mb-1">Duration (min)</label>
                        <input
                            id="duration"
                            type="number"
                            required
                            min="15"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.durationMinutes}
                            onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className={formData.type === 'course' ? "w-1/2" : "grid grid-cols-2 gap-4"}>
                    <div>
                        <label htmlFor="capacity" className="block text-sm font-medium text-zinc-700 mb-1">Capacity</label>
                        <input
                            id="capacity"
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
                            <label htmlFor="price" className="block text-sm font-medium text-zinc-700 mb-1">Price ($)</label>
                            <input
                                id="price"
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

                {formData.type !== 'course' && (
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-200 pb-2">Access & Pricing Rules</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 mb-1">Member Price ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    value={formData.memberPrice}
                                    onChange={(e) => setFormData({ ...formData, memberPrice: e.target.value })}
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.allowCredits}
                                        onChange={(e) => setFormData({ ...formData, allowCredits: e.target.checked })}
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Accept Class Packs/Credits?</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Included Free in Plans:</label>
                            <div className="max-h-24 overflow-y-auto border border-zinc-300 rounded bg-white p-2 space-y-1">
                                {plans.map((plan: any) => (
                                    <label key={plan.id} className="flex items-center gap-2 text-xs hover:bg-zinc-50 p-1 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.includedPlanIds.includes(plan.id)}
                                            onChange={(e) => {
                                                const newIds = e.target.checked
                                                    ? [...formData.includedPlanIds, plan.id]
                                                    : formData.includedPlanIds.filter(id => id !== plan.id);
                                                setFormData({ ...formData, includedPlanIds: newIds });
                                            }}
                                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>{plan.name}</span>
                                    </label>
                                ))}
                                {plans.length === 0 && <span className="text-zinc-400 italic">No plans found.</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Payroll Configuration */}
                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-200 pb-2">Instructor Payroll (Smart Pricing)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Payroll Model</label>
                            <select
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                value={formData.payrollModel}
                                onChange={(e) => setFormData({ ...formData, payrollModel: e.target.value as any })}
                            >
                                <option value="default">Use Instructor Default</option>
                                <option value="flat">Flat Rate Per Class</option>
                                <option value="hourly">Hourly Rate</option>
                                <option value="percentage">Percentage of Revenue</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">
                                {formData.payrollModel === 'percentage' ? 'Percentage (%)' : 'Rate ($)'}
                            </label>
                            <input
                                type="number"
                                min="0"
                                step={formData.payrollModel === 'percentage' ? "1" : "0.01"}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                value={formData.payrollValue}
                                onChange={(e) => setFormData({ ...formData, payrollValue: e.target.value })}
                                disabled={formData.payrollModel === 'default'}
                                placeholder={formData.payrollModel === 'default' ? 'Using Default' : 'Enter value'}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-200 pb-2">Enrollment Policies</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Min. Enrollment to Run</label>
                            <input
                                type="number"
                                min="1"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                value={formData.minEnrollment}
                                onChange={(e) => setFormData({ ...formData, minEnrollment: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Auto-Cancel Cutoff (hrs)</label>
                            <input
                                type="number"
                                min="1"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                value={formData.autoCancelThreshold}
                                onChange={(e) => setFormData({ ...formData, autoCancelThreshold: Number(e.target.value) })}
                                placeholder="Hours before start"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.autoCancelEnabled}
                            onChange={(e) => setFormData({ ...formData, autoCancelEnabled: e.target.checked })}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Enable automatic cancellation if minimum is not met</span>
                    </label>
                </div>

                <div className="border-t border-zinc-200 pt-4 mt-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Repeat this class</span>
                    </label>

                    {formData.isRecurring && (
                        <div className="mt-3 p-3 bg-zinc-50 rounded border border-zinc-200 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">Frequency</label>
                                    <select
                                        className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                        value={formData.recurrencePattern}
                                        onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value })}
                                    >
                                        <option value="weekly">Weekly</option>
                                        <option value="daily">Daily</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        required={formData.isRecurring}
                                        className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                        value={formData.recurrenceEndDate}
                                        onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                                        min={formData.startTime ? new Date(formData.startTime).toISOString().split('T')[0] : undefined}
                                    />
                                </div>
                            </div>

                            {formData.recurrencePattern === 'weekly' && (
                                <div>
                                    <label className="block text-xs font-medium text-zinc-600 mb-2">Repeat On</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: 'Mon', value: 'MO' },
                                            { label: 'Tue', value: 'TU' },
                                            { label: 'Wed', value: 'WE' },
                                            { label: 'Thu', value: 'TH' },
                                            { label: 'Fri', value: 'FR' },
                                            { label: 'Sat', value: 'SA' },
                                            { label: 'Sun', value: 'SU' }
                                        ].map((day) => (
                                            <label key={day.value} className={`
                                                flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium cursor-pointer transition-colors border
                                                ${formData.recurringDays.includes(day.value)
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-blue-300'
                                                }
                                            `}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={formData.recurringDays.includes(day.value)}
                                                    onChange={(e) => {
                                                        const newDays = e.target.checked
                                                            ? [...formData.recurringDays, day.value]
                                                            : formData.recurringDays.filter(d => d !== day.value);
                                                        setFormData({ ...formData, recurringDays: newDays });
                                                    }}
                                                />
                                                {day.label[0]}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

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
                        {loading ? "Scheduling..." : "Schedule Class"}
                    </button>
                </div>
            </form >
        </Modal >
    );
}
