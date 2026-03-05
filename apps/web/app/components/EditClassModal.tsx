import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";
import { CardCreator } from "./CardCreator";
import { ChevronDown, ChevronUp, Image as ImageIcon, Repeat, Unlink } from "lucide-react";

import { useParams } from "react-router";
import { DateTimePicker } from "./ui/DateTimePicker";

interface EditClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedClass: any) => void;
    tenantId?: string;
    locations?: any[];
    instructors?: any[];
    plans?: any[];
    courses?: any[];
    initialData: any;
}

export function EditClassModal({ isOpen, onClose, onSuccess, locations = [], instructors = [], plans = [], courses = [], initialData }: EditClassModalProps) {
    const { getToken } = useAuth();
    const { slug } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Setup initial data
    const [formData, setFormData] = useState({
        name: initialData.title || "",
        description: initialData.description || "",
        instructorId: initialData.instructorId || "",
        locationId: initialData.locationId || "",
        startTime: initialData.startTime || "",
        durationMinutes: initialData.durationMinutes || 60,
        capacity: initialData.capacity || 20,
        price: initialData.price || 0,
        createZoom: initialData.zoomEnabled || false,
        minEnrollment: initialData.minStudents || initialData.minEnrollment || 1,
        autoCancelThreshold: initialData.autoCancelThreshold || 2,
        autoCancelEnabled: initialData.autoCancelEnabled || false,
        type: initialData.type || 'class',
        memberPrice: initialData.memberPrice || "",
        allowCredits: initialData.allowCredits !== false,
        payrollModel: initialData.payrollModel || 'default',
        payrollValue: initialData.payrollValue || "",

        includedPlanIds: (initialData.includedPlanIds || initialData.includedPlans || []).map((p: any) => p.id || p) as string[],

        isCourse: initialData.isCourse || false,
        courseId: initialData.courseId || "",
        recordingPrice: initialData.recordingPrice || "",
        contentCollectionId: initialData.contentCollectionId || "",
        gradient: (initialData.gradientPreset || initialData.gradientColor1) ? {
            preset: initialData.gradientPreset || null,
            color1: initialData.gradientColor1,
            color2: initialData.gradientColor2,
            direction: initialData.gradientDirection
        } : undefined
    });

    // Recurrence state
    const isSeries = !!initialData.seriesId;
    const [showScopeDialog, setShowScopeDialog] = useState(false);
    const [pendingScope, setPendingScope] = useState<'single' | 'future' | 'all'>('single');
    const [makeRecurring, setMakeRecurring] = useState(false);
    const [editingRecurrence, setEditingRecurrence] = useState(false);
    const [recurrencePattern, setRecurrencePattern] = useState('weekly');
    const [recurringDays, setRecurringDays] = useState<string[]>([]);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
    const [recurrenceLoading, setRecurrenceLoading] = useState(false);
    const [seriesInfo, setSeriesInfo] = useState<{
        recurrenceRule: string; validFrom: string; validUntil: string | null;
        totalActive: number; futureActive: number;
    } | null>(null);

    // Fetch series info when the modal opens for a series class
    useEffect(() => {
        if (!isSeries || !initialData.id) return;
        const fetchSeriesInfo = async () => {
            try {
                const token = await getToken();
                const res = await apiRequest(`/classes/${initialData.id}/series`, token, {
                    headers: { 'X-Tenant-Slug': slug! }
                });
                if (res && !res.error) setSeriesInfo(res as any);
            } catch { /* ignore */ }
        };
        fetchSeriesInfo();
    }, [isSeries, initialData.id]);

    // Parse RRule into human-readable text
    const formatRecurrenceRule = (rule: string): string => {
        if (!rule) return 'Unknown pattern';
        const parts = rule.split(';');
        let freq = '', days = '';
        for (const p of parts) {
            if (p.startsWith('FREQ=')) freq = p.replace('FREQ=', '');
            if (p.startsWith('BYDAY=')) {
                const dayMap: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
                days = p.replace('BYDAY=', '').split(',').map(d => dayMap[d] || d).join(', ');
            }
        }
        if (freq === 'DAILY') return 'Daily';
        if (freq === 'WEEKLY' && days) return `Weekly on ${days}`;
        if (freq === 'WEEKLY') return 'Weekly';
        return rule;
    };

    // Resolve relative /uploads/ paths to full API URLs
    const resolveImageUrl = (url: string | null | undefined): string => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
        const apiBase = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
        return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // Image state
    const [showImageSection, setShowImageSection] = useState(!!initialData.thumbnailUrl || !!initialData.gradientColor1);
    const [imageBlob, setImageBlob] = useState<Blob | null>(null);
    const [imagePreview, setImagePreview] = useState<string>(resolveImageUrl(initialData.thumbnailUrl));


    const handleSubmit = async (e: React.FormEvent, scope: 'single' | 'future' | 'all' = 'single') => {
        e.preventDefault?.();
        setLoading(true);
        setError("");

        try {
            const token = await getToken();

            // Upload image if present
            let thumbnailUrl: string | undefined;
            if (imageBlob) {
                const imgFormData = new FormData();
                const file = new File([imageBlob], 'class-card.jpg', { type: 'image/jpeg' });
                imgFormData.append('file', file);

                const apiUrl = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
                const uploadRes = await fetch(`${apiUrl}/uploads/r2-image`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'X-Tenant-Slug': slug!,
                    },
                    body: imgFormData,
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json() as { url: string };
                    thumbnailUrl = uploadData.url;
                }
            }

            const res: any = await apiRequest(`/classes/${initialData.id}?scope=${scope}`, token, {
                method: "PATCH",
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
                    createZoomMeeting: formData.createZoom,
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
                    ...(thumbnailUrl ? { thumbnailUrl } : {}),
                    gradientPreset: formData.gradient?.preset,
                    gradientColor1: formData.gradient?.color1,
                    gradientColor2: formData.gradient?.color2,
                    gradientDirection: formData.gradient?.direction,
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
            }
        } catch (e: any) {
            const errMsg = e.data?.error || e.message || "Failed to edit class";
            setError(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
        } finally {
            setLoading(false);
            setShowScopeDialog(false);
        }
    };

    const handleMakeRecurring = async () => {
        setRecurrenceLoading(true);
        setError('');
        try {
            const token = await getToken();
            let rule = recurrencePattern === 'weekly' ? 'FREQ=WEEKLY' : 'FREQ=DAILY';
            if (recurrencePattern === 'weekly' && recurringDays.length > 0) {
                rule += `;BYDAY=${recurringDays.join(',')}`;
            }
            const res: any = await apiRequest(`/classes/${initialData.id}/make-recurring`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    recurrenceRule: rule,
                    recurrenceEnd: new Date(recurrenceEndDate).toISOString()
                })
            });
            if (res.error) {
                setError(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
            } else {
                onSuccess(res);
                onClose();
            }
        } catch (e: any) {
            setError(e.message || 'Failed to make recurring');
        } finally {
            setRecurrenceLoading(false);
        }
    };

    const handleRemoveRecurrence = async (cancelFuture: boolean) => {
        setRecurrenceLoading(true);
        setError('');
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/classes/${initialData.id}/remove-recurrence`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ cancelFuture })
            });
            if (res.error) {
                setError(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
            } else {
                onSuccess(res);
                onClose();
            }
        } catch (e: any) {
            setError(e.message || 'Failed to remove recurrence');
        } finally {
            setRecurrenceLoading(false);
        }
    };

    const onFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSeries) {
            // Show scope dialog for series classes
            setShowScopeDialog(true);
        } else {
            handleSubmit(e, 'single');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Class">
            {/* Scope selector dialog for series classes */}
            {showScopeDialog && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
                        <h3 className="text-lg font-semibold text-zinc-900">Edit Recurring Class</h3>
                        <p className="text-sm text-zinc-500">This class is part of a recurring series. How would you like to apply your changes?</p>
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e as any, 'single')}
                                disabled={loading}
                                className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                                <span className="font-medium text-sm">This event only</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Changes apply to just this one class</p>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e as any, 'future')}
                                disabled={loading}
                                className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                                <span className="font-medium text-sm">This and all future events</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Changes apply to this class and all upcoming ones in the series</p>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e as any, 'all')}
                                disabled={loading}
                                className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                                <span className="font-medium text-sm">All events in this series</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Changes apply to every class in the entire series</p>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowScopeDialog(false)}
                            className="w-full text-sm text-zinc-500 hover:text-zinc-700 py-2"
                        >
                            Cancel
                        </button>
                        {loading && <p className="text-center text-sm text-blue-600">Saving...</p>}
                    </div>
                </div>
            )}

            <form onSubmit={onFormSubmit} className="space-y-4">
                {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

                {/* Series indicator with info */}
                {isSeries && (
                    <div className="px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-1">
                        <div className="flex items-center gap-2 text-blue-700">
                            <Repeat size={16} />
                            <span className="font-medium">Part of recurring series</span>
                        </div>
                        {seriesInfo ? (
                            <div className="text-xs text-blue-600 space-y-0.5 ml-6">
                                <p><span className="font-medium">Pattern:</span> {formatRecurrenceRule(seriesInfo.recurrenceRule)}</p>
                                {seriesInfo.validUntil && (
                                    <p><span className="font-medium">Until:</span> {new Date(seriesInfo.validUntil).toLocaleDateString()}</p>
                                )}
                                <p><span className="font-medium">Classes:</span> {seriesInfo.totalActive} total ({seriesInfo.futureActive} upcoming)</p>
                                {seriesInfo.futureActive <= 1 && (
                                    <p className="text-amber-600 font-medium mt-1">⚠ No future events in series — recurrence may not have been created properly. Try editing the recurrence below.</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-blue-500 ml-6">Loading series info...</p>
                        )}
                    </div>
                )}

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

                {/* Cover Image Section */}
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowImageSection(!showImageSection)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
                    >
                        <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                            <ImageIcon className="w-4 h-4" />
                            Cover Image
                            {imagePreview && <span className="text-green-600 text-xs">(Added)</span>}
                        </span>
                        {showImageSection ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </button>
                    {showImageSection && (
                        <div className="p-4 border-t border-zinc-200">
                            <CardCreator
                                initialImage={imagePreview || resolveImageUrl(initialData.thumbnailUrl)}
                                initialTitle={formData.name}
                                initialSubtitle={formData.description}
                                initialGradient={formData.gradient}
                                onChange={(data) => {
                                    if (data.image !== undefined) setImageBlob(data.image);
                                    if (data.previewUrl) setImagePreview(data.previewUrl);
                                    setFormData(prev => ({
                                        ...prev,
                                        name: data.title || prev.name,
                                        description: data.subtitle || prev.description,
                                        gradient: data.gradient
                                    }));
                                }}
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                Upload or generate a 600×450 (4:3) cover image. Optional for classes and events.
                            </p>
                        </div>
                    )}
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
                        <label htmlFor="startTime" className="block text-sm font-medium text-zinc-700 mb-1">Start Date & Time</label>
                        <DateTimePicker
                            value={formData.startTime}
                            onChange={(iso: string) => setFormData({ ...formData, startTime: iso })}
                            placeholder="Select start date & time"
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

                {/* Recurrence Section */}
                <div className="border-t border-zinc-200 pt-4 mt-2 space-y-3">
                    {!isSeries ? (
                        /* Make Recurring for standalone classes */
                        <>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={makeRecurring}
                                    onChange={(e) => setMakeRecurring(e.target.checked)}
                                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Repeat size={14} />
                                <span>Make this a repeating class</span>
                            </label>

                            {makeRecurring && (
                                <div className="p-3 bg-zinc-50 rounded border border-zinc-200 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-600 mb-1">Frequency</label>
                                            <select
                                                className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                                value={recurrencePattern}
                                                onChange={(e) => setRecurrencePattern(e.target.value)}
                                            >
                                                <option value="weekly">Weekly</option>
                                                <option value="daily">Daily</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
                                            <input
                                                type="date"
                                                required={makeRecurring}
                                                className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                                value={recurrenceEndDate}
                                                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                                min={formData.startTime ? new Date(formData.startTime).toISOString().split('T')[0] : undefined}
                                            />
                                        </div>
                                    </div>

                                    {recurrencePattern === 'weekly' && (
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
                                                        ${recurringDays.includes(day.value)
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-blue-300'
                                                        }
                                                    `}>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={recurringDays.includes(day.value)}
                                                            onChange={(e) => {
                                                                const newDays = e.target.checked
                                                                    ? [...recurringDays, day.value]
                                                                    : recurringDays.filter(d => d !== day.value);
                                                                setRecurringDays(newDays);
                                                            }}
                                                        />
                                                        {day.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleMakeRecurring}
                                        disabled={recurrenceLoading || !recurrenceEndDate}
                                        className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {recurrenceLoading ? 'Creating series...' : <><Repeat size={14} /> Create Recurring Series</>}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Series management for series classes */
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-zinc-600">Series Management</p>

                            {/* Edit Recurrence controls */}
                            {!editingRecurrence ? (
                                <button
                                    type="button"
                                    onClick={() => setEditingRecurrence(true)}
                                    className="w-full px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center justify-center gap-1"
                                >
                                    <Repeat size={12} />
                                    Edit Recurrence
                                </button>
                            ) : (
                                <div className="p-3 bg-zinc-50 rounded border border-zinc-200 space-y-3">
                                    <p className="text-xs text-zinc-500">This will cancel existing future events and create new ones with the updated pattern.</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-600 mb-1">Frequency</label>
                                            <select
                                                className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                                value={recurrencePattern}
                                                onChange={(e) => setRecurrencePattern(e.target.value)}
                                            >
                                                <option value="weekly">Weekly</option>
                                                <option value="daily">Daily</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
                                            <input
                                                type="date"
                                                className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:ring-blue-500 outline-none"
                                                value={recurrenceEndDate}
                                                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                                min={formData.startTime ? new Date(formData.startTime).toISOString().split('T')[0] : undefined}
                                            />
                                        </div>
                                    </div>
                                    {recurrencePattern === 'weekly' && (
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
                                                        ${recurringDays.includes(day.value)
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-blue-300'
                                                        }
                                                    `}>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={recurringDays.includes(day.value)}
                                                            onChange={(e) => {
                                                                const newDays = e.target.checked
                                                                    ? [...recurringDays, day.value]
                                                                    : recurringDays.filter(d => d !== day.value);
                                                                setRecurringDays(newDays);
                                                            }}
                                                        />
                                                        {day.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                // First remove old recurrence (cancel future), then make recurring with new pattern
                                                setRecurrenceLoading(true);
                                                try {
                                                    const token = await getToken();
                                                    // Remove current recurrence and cancel future
                                                    await apiRequest(`/classes/${initialData.id}/remove-recurrence`, token, {
                                                        method: 'POST',
                                                        headers: { 'X-Tenant-Slug': slug! },
                                                        body: JSON.stringify({ cancelFuture: true })
                                                    });
                                                    // Now create new recurrence
                                                    let rule = recurrencePattern === 'weekly' ? 'FREQ=WEEKLY' : 'FREQ=DAILY';
                                                    if (recurrencePattern === 'weekly' && recurringDays.length > 0) {
                                                        rule += `;BYDAY=${recurringDays.join(',')}`;
                                                    }
                                                    const res: any = await apiRequest(`/classes/${initialData.id}/make-recurring`, token, {
                                                        method: 'POST',
                                                        headers: { 'X-Tenant-Slug': slug! },
                                                        body: JSON.stringify({
                                                            recurrenceRule: rule,
                                                            recurrenceEnd: new Date(recurrenceEndDate).toISOString()
                                                        })
                                                    });
                                                    if (res.error) {
                                                        setError(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
                                                    } else {
                                                        onSuccess(res);
                                                        onClose();
                                                    }
                                                } catch (e: any) {
                                                    setError(e.message || 'Failed to update recurrence');
                                                } finally {
                                                    setRecurrenceLoading(false);
                                                }
                                            }}
                                            disabled={recurrenceLoading || !recurrenceEndDate}
                                            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {recurrenceLoading ? 'Updating...' : <><Repeat size={14} /> Update Recurrence</>}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingRecurrence(false)}
                                            className="px-3 py-2 text-sm font-medium text-zinc-600 border border-zinc-300 rounded-md hover:bg-zinc-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleRemoveRecurrence(false)}
                                    disabled={recurrenceLoading}
                                    className="flex-1 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    <Unlink size={12} />
                                    {recurrenceLoading ? 'Working...' : 'Detach this event'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm('This will cancel all future events in this series. Continue?')) {
                                            handleRemoveRecurrence(true);
                                        }
                                    }}
                                    disabled={recurrenceLoading}
                                    className="flex-1 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    <Unlink size={12} />
                                    {recurrenceLoading ? 'Working...' : 'End series (cancel future)'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-6">
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
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form >
        </Modal >
    );
}
