import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { X, Video, Loader2, Trash2, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { apiRequest } from '../utils/api';
import { useAuth } from '@clerk/react-router'; // Use Clerk hook or pass token

interface ClassDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    classEvent: any | null; // The class object from calendar
    onRecordingAdded: (classId: string, videoId: string) => void;
    onRecordingDeleted: (classId: string) => void;
    canAttachRecording?: boolean;
    currentUserMemberId?: string;
    userRoles?: string[];
    tenantSlug?: string;
    onSubRequested?: (classId: string) => void;
    onBookRequested?: () => void;
    onEditRequested?: () => void;
    onClassUpdated?: () => void;
}

export function ClassDetailModal({
    isOpen,
    onClose,
    classEvent,
    onRecordingAdded,
    onRecordingDeleted,
    canAttachRecording = false,
    currentUserMemberId,
    userRoles = [],
    tenantSlug,
    onSubRequested,
    onBookRequested,
    onEditRequested,
    onClassUpdated
}: ClassDetailModalProps) {
    const [recordingUrl, setRecordingUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmState, setConfirmState] = useState<{ type: 'delete_recording' | 'request_sub' | 'claim_sub' | 'restore', subId?: string } | null>(null);
    const { getToken } = useAuth();

    // Enrollment policy editing
    const [isEditingPolicies, setIsEditingPolicies] = useState(false);
    const [policyMinEnrollment, setPolicyMinEnrollment] = useState(1);
    const [policyAutoCancelThreshold, setPolicyAutoCancelThreshold] = useState(2);
    const [policyAutoCancelEnabled, setPolicyAutoCancelEnabled] = useState(false);
    const [isSavingPolicies, setIsSavingPolicies] = useState(false);

    // Reset state when opening different class
    useEffect(() => {
        setRecordingUrl('');
        setError(null);
        setIsSubmitting(false);
    }, [classEvent?.id]);

    // Sync enrollment policy state when classEvent changes
    useEffect(() => {
        if (classEvent) {
            setPolicyMinEnrollment(classEvent.minStudents || 1);
            setPolicyAutoCancelThreshold(classEvent.autoCancelThreshold || 2);
            setPolicyAutoCancelEnabled(!!classEvent.autoCancelEnabled);
            setIsEditingPolicies(false);
        }
    }, [classEvent?.id, classEvent?.minStudents, classEvent?.autoCancelThreshold, classEvent?.autoCancelEnabled]);

    if (!classEvent) return null;

    const isAdmin = userRoles?.some((r: string) => ['admin', 'owner'].includes(r));
    const isCancelled = classEvent.status === 'cancelled';

    const handleSavePolicies = async () => {
        setIsSavingPolicies(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/classes/${classEvent.id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': tenantSlug! },
                body: JSON.stringify({
                    minStudents: policyMinEnrollment,
                    autoCancelThreshold: policyAutoCancelThreshold,
                    autoCancelEnabled: policyAutoCancelEnabled
                })
            });
            if (res.error) throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
            setIsEditingPolicies(false);
            // Optimistically update display values while waiting for refetch
            if (classEvent) {
                classEvent.minStudents = policyMinEnrollment;
                classEvent.autoCancelThreshold = policyAutoCancelThreshold;
                classEvent.autoCancelEnabled = policyAutoCancelEnabled;
            }
            onClassUpdated?.();
        } catch (err: any) {
            alert(err.message || 'Failed to save enrollment policies');
        } finally {
            setIsSavingPolicies(false);
        }
    };

    const handleRestoreClass = () => {
        setConfirmState({ type: 'restore' });
    };

    const executeRestoreClass = async () => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/classes/${classEvent.id}/restore`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenantSlug! }
            });
            if (res.error) throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
            onClassUpdated?.();
            onClose();
        } catch (err: any) {
            alert(err.message || 'Failed to restore class');
        } finally {
            setIsSubmitting(false);
        }
    };

    // status can be passed in classEvent or we assume 'ready' if streamId exists
    const hasRecording = !!classEvent.cloudflareStreamId;
    const streamStatus = classEvent.recordingStatus;

    const handleAddRecording = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await apiRequest(`/classes/${classEvent.id}/recording`, token, {
                method: 'POST',
                body: JSON.stringify({ url: recordingUrl })
            }) as any;

            if (res.error) throw new Error(res.error);

            onRecordingAdded(classEvent.id, res.videoId);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to add recording");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRecording = async () => {
        setConfirmState({ type: 'delete_recording' });
    };

    const executeDeleteRecording = async () => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res = await apiRequest(`/classes/${classEvent.id}/recording`, token, {
                method: 'DELETE'
            }) as any;

            if (res.error) throw new Error(res.error);

            onRecordingDeleted(classEvent.id);
            onClose();
        } catch (err: any) {
            alert(err.message || "Failed to delete recording");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestSub = async () => {
        setConfirmState({ type: 'request_sub' });
    };

    const executeRequestSub = async () => {
        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/substitutions/request`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenantSlug! },
                body: JSON.stringify({ classId: classEvent.id })
            });
            if (res.error) throw new Error(res.error);
            alert("Substitute check requested! Staff will be notified.");
            onSubRequested?.(classEvent.id);
            onClose();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClaimSub = async (subId: string) => {
        setConfirmState({ type: 'claim_sub', subId });
    };

    const executeClaimSub = async () => {
        const subId = confirmState?.subId;
        if (!subId) return;

        setIsSubmitting(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/substitutions/${subId}/claim`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenantSlug! }
            });
            if (res.error) throw new Error(res.error);
            alert("Shift claimed! Pending approval.");
            onClose();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Transition appear show={isOpen} as={Fragment as any}>
                <Dialog as="div" className="relative z-50" onClose={onClose}>
                    <Transition.Child
                        as={Fragment as any}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment as any}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                                                {classEvent.title}
                                            </Dialog.Title>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {new Date(classEvent.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {onEditRequested && userRoles?.some((r: string) => ['admin', 'owner', 'instructor'].includes(r)) && (
                                                <button onClick={onEditRequested} className="text-zinc-500 hover:text-zinc-700 p-1 text-sm bg-zinc-100 rounded-md">
                                                    Edit
                                                </button>
                                            )}
                                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Info Section */}
                                        <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <p><strong>Instructor:</strong> {classEvent.instructor?.user?.profile?.firstName || 'Unknown'}</p>
                                                <p><strong>Duration:</strong> {classEvent.durationMinutes} min</p>
                                            </div>
                                            {classEvent.location && <p><strong>Location:</strong> {classEvent.location.name}</p>}

                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-semibold text-gray-900">Bookings</span>
                                                    <a
                                                        href={`/studio/${window.location.pathname.split('/')[2]}/classes/${classEvent.id}/roster`}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                    >
                                                        View Roster &rarr;
                                                    </a>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div className="bg-white p-2 rounded border border-gray-200">
                                                        <span className="block text-gray-500">Confirmed</span>
                                                        <span className="block text-lg font-bold text-gray-900">
                                                            {classEvent.bookingCount || 0}
                                                            <span className="text-gray-400 font-normal text-xs ml-1">
                                                                / {classEvent.capacity || '∞'}
                                                            </span>
                                                        </span>
                                                    </div>
                                                    <div className="bg-white p-2 rounded border border-gray-200">
                                                        <span className="block text-gray-500">Waitlist</span>
                                                        <span className={`block text-lg font-bold ${classEvent.waitlistCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                                                            {classEvent.waitlistCount || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cancelled Banner + Restore */}
                                        {isCancelled && (
                                            <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertTriangle size={16} className="text-red-600" />
                                                    <span className="text-sm font-semibold text-red-800">This class is cancelled</span>
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        onClick={handleRestoreClass}
                                                        disabled={isSubmitting}
                                                        className="w-full flex items-center justify-center gap-2 bg-white text-red-700 border border-red-300 py-2 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={14} />
                                                        Restore Class
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Enrollment Policies */}
                                        {isAdmin && (
                                            <div className="bg-gray-50 p-3 rounded-md text-sm border border-gray-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-semibold text-gray-900 flex items-center gap-1.5">
                                                        <Settings size={14} />
                                                        Enrollment Policies
                                                    </h4>
                                                    {!isEditingPolicies ? (
                                                        <button
                                                            onClick={() => setIsEditingPolicies(true)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setIsEditingPolicies(false);
                                                                    setPolicyMinEnrollment(classEvent.minStudents || 1);
                                                                    setPolicyAutoCancelThreshold(classEvent.autoCancelThreshold || 2);
                                                                    setPolicyAutoCancelEnabled(!!classEvent.autoCancelEnabled);
                                                                }}
                                                                className="text-xs text-gray-500 hover:text-gray-700"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleSavePolicies}
                                                                disabled={isSavingPolicies}
                                                                className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 disabled:opacity-50"
                                                            >
                                                                {isSavingPolicies ? 'Saving...' : 'Save'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {isEditingPolicies ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs text-gray-600 mb-0.5">Min. Enrollment</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                                    value={policyMinEnrollment}
                                                                    onChange={(e) => setPolicyMinEnrollment(Number(e.target.value))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-600 mb-0.5">Auto-Cancel (hrs before)</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                                    value={policyAutoCancelThreshold}
                                                                    onChange={(e) => setPolicyAutoCancelThreshold(Number(e.target.value))}
                                                                />
                                                            </div>
                                                        </div>
                                                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={policyAutoCancelEnabled}
                                                                onChange={(e) => setPolicyAutoCancelEnabled(e.target.checked)}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            Enable automatic cancellation
                                                        </label>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                                                        <div className="bg-white p-2 rounded border border-gray-200 text-center">
                                                            <span className="block text-gray-400">Min. Enrollment</span>
                                                            <span className="block text-base font-bold text-gray-900">{classEvent.minStudents || 1}</span>
                                                        </div>
                                                        <div className="bg-white p-2 rounded border border-gray-200 text-center">
                                                            <span className="block text-gray-400">Cancel Cutoff</span>
                                                            <span className="block text-base font-bold text-gray-900">{classEvent.autoCancelThreshold || '—'}h</span>
                                                        </div>
                                                        <div className="bg-white p-2 rounded border border-gray-200 text-center">
                                                            <span className="block text-gray-400">Auto-Cancel</span>
                                                            <span className={`block text-base font-bold ${classEvent.autoCancelEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                                                                {classEvent.autoCancelEnabled ? 'ON' : 'OFF'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Zoom Section */}
                                        {(classEvent.myBooking?.zoomMeetingUrl || classEvent.zoomEnabled || classEvent.zoomMeetingUrl) && (
                                            <div className="bg-blue-50 p-3 rounded-md text-sm border border-blue-100">
                                                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                                    <Video size={16} />
                                                    Virtual Class Access
                                                </h4>

                                                {(classEvent.myBooking?.zoomMeetingUrl || classEvent.zoomMeetingUrl) ? (
                                                    <div className="space-y-2">
                                                        <a
                                                            href={classEvent.myBooking?.zoomMeetingUrl || classEvent.zoomMeetingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block w-full text-center bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 transition"
                                                        >
                                                            Launch Zoom Meeting
                                                        </a>

                                                        {(classEvent.myBooking?.zoomPassword || classEvent.zoomMeetingId) && (
                                                            <div className="text-xs text-blue-800 space-y-1 mt-2 pt-2 border-t border-blue-200">
                                                                {classEvent.zoomMeetingId && (
                                                                    <div className="flex justify-between">
                                                                        <span className="font-medium">Meeting ID:</span>
                                                                        <span className="font-mono select-all">{classEvent.zoomMeetingId}</span>
                                                                    </div>
                                                                )}
                                                                {(classEvent.myBooking?.zoomPassword || classEvent.zoomPassword) && (
                                                                    <div className="flex justify-between">
                                                                        <span className="font-medium">Passcode:</span>
                                                                        <span className="font-mono select-all">{classEvent.myBooking?.zoomPassword || classEvent.zoomPassword}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-blue-700 text-xs italic">
                                                        {classEvent.myBooking ? "Zoom link will be available here." : "Book this class to access the Zoom link."}
                                                    </div>
                                                )}
                                            </div>
                                        )}


                                        {/* Student Booking Section */}
                                        {onBookRequested && !userRoles.includes('instructor') && !classEvent.myBooking && (
                                            <div className="border-t pt-4">
                                                <button
                                                    onClick={onBookRequested}
                                                    className="w-full bg-zinc-900 text-white py-3 rounded-md font-medium text-sm hover:bg-zinc-800 shadow-sm"
                                                >
                                                    Book This Class
                                                </button>
                                            </div>
                                        )}
                                        {classEvent.myBooking && (
                                            <div className="border-t pt-4">
                                                <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm text-center font-medium border border-green-200">
                                                    {classEvent.myBooking.status === 'waitlisted' ? 'On Waitlist for this Class' : 'You are booked for this class!'}
                                                </div>
                                            </div>
                                        )}

                                        {/* Substitution Section */}
                                        <div className="border-t pt-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-semibold text-gray-900">Shift Coverage</h4>
                                                {classEvent.substitutions?.length > 0 && (
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${classEvent.substitutions[0].status === 'approved' ? 'bg-green-100 text-green-700' :
                                                        classEvent.substitutions[0].status === 'claimed' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        Sub: {classEvent.substitutions[0].status}
                                                    </span>
                                                )}
                                            </div>

                                            {classEvent.substitutions?.length > 0 ? (
                                                <div className="bg-zinc-50 p-4 rounded-lg text-sm border border-zinc-200">
                                                    <p className="text-zinc-600">
                                                        {classEvent.substitutions[0].status === 'pending' ? 'Seeking coverage...' :
                                                            classEvent.substitutions[0].status === 'claimed' ? 'Claimed - Awaiting approval' :
                                                                'Substitution approved'}
                                                    </p>
                                                    {classEvent.substitutions[0].status === 'pending' && currentUserMemberId !== classEvent.instructorId && (
                                                        <button
                                                            onClick={() => handleClaimSub(classEvent.substitutions[0].id)}
                                                            className="mt-3 w-full bg-blue-600 text-white py-2 rounded-md font-medium text-xs hover:bg-blue-700"
                                                        >
                                                            Claim this shift
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    {currentUserMemberId === classEvent.instructorId && (
                                                        <button
                                                            onClick={handleRequestSub}
                                                            disabled={isSubmitting}
                                                            className="w-full border border-zinc-300 py-2 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                                        >
                                                            Request Substitute
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Recording Section */}
                                        {canAttachRecording && (
                                            <div className="border-t pt-4">
                                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                    <Video size={16} />
                                                    Class Recording
                                                </h4>

                                                {hasRecording ? (
                                                    <div className="space-y-3">
                                                        <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                            <span>
                                                                Recording attached ({streamStatus || 'processed'})
                                                            </span>
                                                            <button
                                                                onClick={handleDeleteRecording}
                                                                type="button"
                                                                disabled={isSubmitting}
                                                                className="ml-auto text-green-700 hover:text-red-600 p-1"
                                                                title="Delete Recording"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Player */}
                                                        <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                                                            <iframe
                                                                src={`https://iframe.videodelivery.net/${classEvent.cloudflareStreamId}`}
                                                                className="border-none absolute top-0 left-0 w-full h-full"
                                                                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                                                allowFullScreen={true}
                                                                title="Class Recording"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <form onSubmit={handleAddRecording}>
                                                        <div className="mb-3">
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                                Add External Video URL (e.g. Zoom Cloud Link)
                                                            </label>
                                                            <input
                                                                type="url"
                                                                required
                                                                placeholder="https://zoom.us/rec/..."
                                                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                                                value={recordingUrl}
                                                                onChange={(e) => setRecordingUrl(e.target.value)}
                                                            />
                                                        </div>
                                                        {error && (
                                                            <p className="text-xs text-red-600 mb-2">{error}</p>
                                                        )}
                                                        <button
                                                            type="submit"
                                                            disabled={isSubmitting}
                                                            className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                                                        >
                                                            {isSubmitting ? (
                                                                <span className="flex items-center gap-2">
                                                                    <Loader2 size={16} className="animate-spin" /> Uploading...
                                                                </span>
                                                            ) : "Attach Recording"}
                                                        </button>
                                                    </form>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <ConfirmDialog
                open={!!confirmState}
                onOpenChange={(open) => !open && setConfirmState(null)}
                onConfirm={() => {
                    if (confirmState?.type === 'delete_recording') executeDeleteRecording();
                    else if (confirmState?.type === 'request_sub') executeRequestSub();
                    else if (confirmState?.type === 'claim_sub') executeClaimSub();
                    else if (confirmState?.type === 'restore') executeRestoreClass();
                }}
                title={
                    confirmState?.type === 'delete_recording' ? "Delete Recording" :
                        confirmState?.type === 'request_sub' ? "Request Substitute" :
                            confirmState?.type === 'restore' ? "Restore Class" : "Claim Shift"
                }
                description={
                    confirmState?.type === 'delete_recording' ? "Are you sure you want to delete this recording? This cannot be undone." :
                        confirmState?.type === 'request_sub' ? "Are you sure you want to request a substitute? Instructors will be notified." :
                            confirmState?.type === 'restore' ? "Restore this class? All previously cancelled bookings will be re-confirmed and students will be able to attend." :
                                "Are you sure you want to claim this shift?"
                }
                confirmText={confirmState?.type === 'delete_recording' ? "Delete" : "Confirm"}
                variant={confirmState?.type === 'delete_recording' ? "destructive" : "default"}
            />
        </>
    );
}
